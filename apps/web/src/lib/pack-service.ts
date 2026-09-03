import { createLogger, env, newId } from "@gdp/core";
import {
  type ConceptPreview,
  type Pack,
  type PackOrder,
  SmartBrief,
} from "@gdp/core";
import {
  DesignBrief,
  FORMATS,
  type FormatId,
} from "@gdp/design-schema";
import { canvasFor } from "@gdp/layout-engine";
import { generateConcepts } from "@gdp/planner";
import { renderDocument } from "@gdp/renderer";
import { storage } from "@gdp/storage";
import { packRepository } from "./pack-repository";
import { getPaymentProvider } from "./payment-provider";
import { packagingService } from "./packaging-service";

const log = createLogger("pack-service");

export function smartBriefToDesignBrief(brief: SmartBrief): DesignBrief {
  const isChurch = brief.promotionType.toLowerCase().includes("church");
  const category = isChurch ? "church" : "smb";
  const subcategory = isChurch ? "sunday-service" : "promotion";

  const eventTitle = brief.eventName || brief.title || "Special Promotion";
  const businessType = isChurch ? "" : brief.promotionType || "retail";

  return DesignBrief.parse({
    category,
    subcategory,
    eventTitle,
    offer: brief.offer || "",
    offerDetail: brief.offerDetail || "",
    promoCode: brief.promoCode || "",
    businessType,
    organisationName: brief.brandName || "",
    date: brief.date || "",
    time: brief.time || "",
    location: brief.location || "",
    callToAction: brief.CTA || "Learn More",
    website: brief.website || "",
    socials: brief.socialHandles || "",
    extraLines: [brief.description, brief.targetAudience].filter(Boolean),
    feeling: brief.feeling || brief.description || "clean, modern, high impact",
    format: (brief.requestedFormats[0] as FormatId) || "ig-portrait",
    styleDirection: brief.styleDirection || "",
  });
}

export class PackService {
  async createPack(input: unknown): Promise<Pack> {
    const brief = SmartBrief.parse(input);
    const packId = newId("pack");
    const now = new Date().toISOString();

    log.info("Creating pack", { packId, title: brief.title || brief.eventName });

    const designBrief = smartBriefToDesignBrief(brief);
    const canvas = canvasFor((brief.requestedFormats[0] as FormatId) || "ig-portrait");

    // Generate candidate concepts using planner
    const result = await generateConcepts({
      designId: packId,
      brief: designBrief,
      canvas,
      assets: [],
      candidateCount: 10,
      conceptsShown: 3,
    });

    const conceptsToStore: Array<{ preview: ConceptPreview; doc: any }> = [];
    const store = storage();

    // Render watermarked previews for exactly the shown concepts
    for (let i = 0; i < result.concepts.length; i++) {
      const candidate = result.concepts[i]!;
      const conceptId = candidate.id;

      // 1. Watermarked Preview (D-03: Free preview with non-bypassable watermark)
      const renderPreview = await renderDocument(candidate.doc, {
        format: "png",
        scale: 0.6,
        watermark: "PREVIEW \u2022 GDP PLATFORM",
      });

      const previewKey = `previews/${packId}/${conceptId}_preview.png`;
      await store.put({
        key: previewKey,
        body: renderPreview.buffer,
        contentType: "image/png",
      });

      // 2. Thumbnail
      const renderThumb = await renderDocument(candidate.doc, {
        format: "webp",
        scale: 0.3,
        watermark: "PREVIEW",
      });
      const thumbKey = `previews/${packId}/${conceptId}_thumb.webp`;
      await store.put({
        key: thumbKey,
        body: renderThumb.buffer,
        contentType: "image/webp",
      });

      const preview: ConceptPreview = {
        id: conceptId,
        title: candidate.plan.conceptName || `Concept 0${i + 1}`,
        description: candidate.plan.rationale || `Visual direction: ${candidate.doc.meta.styleDirection}`,
        visualDirection: candidate.doc.meta.styleDirection || result.direction,
        previewUrl: store.url(previewKey),
        thumbnailUrl: store.url(thumbKey),
        vqs: Math.round(candidate.report.total),
        status: "generated",
      };

      conceptsToStore.push({
        preview,
        doc: candidate.doc,
      });
    }

    const pack: Pack = {
      id: packId,
      brief,
      status: "ready",
      concepts: conceptsToStore.map((c) => c.preview),
      requestedFormats: brief.requestedFormats.length > 0 ? brief.requestedFormats : ["ig-portrait", "ig-square", "story", "facebook"],
      createdAt: now,
      updatedAt: now,
    };

    await packRepository.savePack(pack, conceptsToStore);
    return pack;
  }

  async getPack(id: string): Promise<Pack | null> {
    return packRepository.getPack(id);
  }

  async selectConcept(packId: string, conceptId: string, requestedFormats?: FormatId[]): Promise<Pack> {
    const pack = await packRepository.getPack(packId);
    if (!pack) {
      throw new Error(`Pack ${packId} not found`);
    }

    const concept = pack.concepts.find((c) => c.id === conceptId);
    if (!concept) {
      throw new Error(`Concept ${conceptId} does not belong to pack ${packId}`);
    }

    const updatedConcepts = pack.concepts.map((c) => ({
      ...c,
      status: (c.id === conceptId ? "selected" : "rejected") as ConceptPreview["status"],
    }));

    const formats = requestedFormats && requestedFormats.length > 0 ? requestedFormats : pack.requestedFormats;

    const updated = await packRepository.updatePack(packId, {
      selectedConceptId: conceptId,
      status: "selected",
      concepts: updatedConcepts,
      requestedFormats: formats,
    });

    return updated!;
  }

  async createCheckout(packId: string): Promise<{ checkoutUrl: string; sessionId: string; orderId: string }> {
    const pack = await packRepository.getPack(packId);
    if (!pack) throw new Error(`Pack ${packId} not found`);
    if (!pack.selectedConceptId) throw new Error(`Please select a concept before checkout`);

    const e = env();
    const orderId = newId("ord");
    const order: PackOrder = {
      id: orderId,
      packId,
      amount: e.PACK_PRICE_CENTS,
      currency: "usd",
      provider: e.PAYMENT_PROVIDER,
      providerSessionId: "",
      status: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await packRepository.saveOrder(order);

    const provider = getPaymentProvider();
    const session = await provider.createCheckoutSession(pack, order);

    await packRepository.updateOrder(orderId, {
      providerSessionId: session.sessionId,
      checkoutUrl: session.checkoutUrl,
    });

    return session;
  }

  async verifyAndProcessPayment(packId: string, sessionId?: string): Promise<{ paid: boolean; pack: Pack }> {
    const pack = await packRepository.getPack(packId);
    if (!pack) throw new Error(`Pack ${packId} not found`);

    let order = sessionId
      ? await packRepository.getOrderByProviderSessionId(sessionId)
      : await packRepository.getOrderByPackId(packId);

    if (!order) {
      // If sessionId was provided and looks like a dev session, create/match order
      if (sessionId && sessionId.startsWith("dev_sess_")) {
        order = {
          id: newId("ord"),
          packId,
          amount: env().PACK_PRICE_CENTS,
          currency: "usd",
          provider: "dev",
          providerSessionId: sessionId,
          status: "pending",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await packRepository.saveOrder(order);
      } else {
        throw new Error(`No active order found for pack ${packId}`);
      }
    }

    if (order.status === "paid" && pack.status === "packaged") {
      return { paid: true, pack };
    }

    const provider = getPaymentProvider();
    const verification = await provider.verifyPayment(order.providerSessionId || sessionId || "");

    if (verification.paid) {
      await packRepository.updateOrder(order.id, { status: "paid" });
      await packRepository.updatePack(packId, { status: "paid" });

      // Trigger high-resolution multi-format packaging
      const packagedPack = await packagingService.packagePack(packId);
      return { paid: true, pack: packagedPack };
    }

    return { paid: false, pack };
  }
}

export const packService = new PackService();
