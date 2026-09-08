import crypto from "node:crypto";
import { createLogger, env, newId } from "@gdp/core";
import {
  type ConceptPreview,
  type Pack,
  type PackOrder,
  type PackShare,
  type PackVersion,
  type PaymentProviderType,
  type PricingContext,
  SmartBrief,
} from "@gdp/core";
import {
  DesignBrief,
  FORMATS,
  type FormatId,
} from "@gdp/design-schema";
import { canvasFor } from "@gdp/layout-engine";
import { generateConcepts, interpretEdit as runInterpretEdit, applyPatch } from "@gdp/planner";
import { renderDocument } from "@gdp/renderer";
import { storage } from "@gdp/storage";
import { packRepository } from "./pack-repository";
import { getPaymentProvider } from "./payment-provider";
import { packagingService } from "./packaging-service";
import { getProductPlan } from "./pricing";
import { walletService } from "./wallet-service";
import { trackEvent } from "./analytics";

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

    await trackEvent({
      type: "preview_viewed",
      packId,
      payload: {
        conceptCount: conceptsToStore.length,
        formats: pack.requestedFormats,
      },
    });

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

    await trackEvent({
      type: "concept_selected",
      packId,
      conceptId,
    });

    return updated!;
  }

  async createCheckout(
    packId: string,
    options: {
      productId?: string;
      pricingContext?: PricingContext;
      userId?: string;
    } = {},
  ): Promise<{ checkoutUrl: string; sessionId: string; orderId: string; unlockedWithCredit?: boolean }> {
    const pack = await packRepository.getPack(packId);
    if (!pack) throw new Error(`Pack ${packId} not found`);
    if (!pack.selectedConceptId) throw new Error(`Please select a concept before checkout`);

    const effectiveUserId = options.userId || pack.userId || "anon_user";
    const ctx = options.pricingContext || { country: "DEFAULT", region: "DEFAULT", currency: "usd" };
    const product = getProductPlan(options.productId || "single", ctx);

    // Option: Unlock directly with available wallet credits
    if (options.productId === "wallet_credit") {
      const wallet = await walletService.getWallet(effectiveUserId);
      if (wallet.balance < 1) {
        throw new Error(`Insufficient wallet credits. Current balance: ${wallet.balance}`);
      }

      const consumeRes = await walletService.consumeCreditForPack({ userId: effectiveUserId, packId });
      if (!consumeRes.success) throw new Error(consumeRes.error || "Failed to consume credit");

      const orderId = newId("ord");
      const order: PackOrder = {
        id: orderId,
        packId,
        userId: effectiveUserId,
        productId: "wallet_credit",
        creditsGranted: 0,
        amount: 0,
        currency: product.currency,
        provider: "dev",
        providerSessionId: `credit_unlock_${orderId}`,
        status: "paid",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await packRepository.saveOrder(order);
      await packRepository.updatePack(packId, { status: "paid" });
      await packagingService.packagePack(packId);

      return {
        checkoutUrl: `/packs/${packId}?payment=success`,
        sessionId: order.providerSessionId,
        orderId,
        unlockedWithCredit: true,
      };
    }

    const orderId = newId("ord");
    const e = env();
    const order: PackOrder = {
      id: orderId,
      packId,
      userId: effectiveUserId,
      productId: product.id,
      creditsGranted: product.credits,
      amount: product.price,
      currency: product.currency,
      provider: (e.PAYMENT_PROVIDER as PaymentProviderType) || "dev",
      providerSessionId: "",
      status: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await packRepository.saveOrder(order);

    const provider = getPaymentProvider(product.region, product.currency);
    const session = await provider.createCheckoutSession(pack, order, product);

    await packRepository.updateOrder(orderId, {
      providerSessionId: session.sessionId,
      checkoutUrl: session.checkoutUrl,
    });

    await trackEvent({
      type: "checkout_started",
      userId: effectiveUserId,
      packId,
      payload: {
        orderId,
        productId: product.id,
        creditsGranted: product.credits,
        amount: product.price,
        currency: product.currency,
        region: product.region,
      },
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

    const provider = getPaymentProvider(undefined, order.currency);
    const verification = await provider.verifyPayment(order.providerSessionId || sessionId || "");

    if (verification.paid) {
      await packRepository.updateOrder(order.id, { status: "paid" });
      await packRepository.updatePack(packId, { status: "paid" });

      const userId = order.userId || pack.userId || "anon_user";
      const creditsToGrant = order.creditsGranted || (order.productId === "bundle-5" ? 5 : 1);

      // 1. Grant purchased credits to wallet
      await walletService.grantCreditsFromOrder({
        userId,
        orderId: order.id,
        credits: creditsToGrant,
      });

      // 2. Consume 1 credit to unlock current pack
      await walletService.consumeCreditForPack({
        userId,
        packId,
      });

      // 3. Trigger high-resolution multi-format packaging
      const packagedPack = await packagingService.packagePack(packId);

      await trackEvent({
        type: "payment_succeeded",
        userId,
        packId,
        payload: {
          orderId: order.id,
          amount: order.amount,
          currency: order.currency,
          productId: order.productId,
          creditsGranted: creditsToGrant,
        },
      });

      return { paid: true, pack: packagedPack };
    }

    return { paid: false, pack };
  }

  // ------------------------------------------------------------- D-04 Detail Fixer Engine

  async interpretEdit(packId: string, instruction: string): Promise<{ patch: any; summary: string; opsCount: number; creditCost: number }> {
    const pack = await packRepository.getPack(packId);
    if (!pack) throw new Error(`Pack ${packId} not found`);
    if (!pack.selectedConceptId) throw new Error(`Pack ${packId} has no concept selected`);

    const stored = await packRepository.getStoredConcept(packId, pack.selectedConceptId);
    if (!stored) throw new Error(`Concept document not found for pack ${packId}`);

    const result = await runInterpretEdit({
      doc: stored.doc,
      instruction,
    });

    return {
      patch: result.patch,
      summary: result.patch.summary || "Apply changes",
      opsCount: result.patch.ops.length,
      creditCost: 1,
    };
  }

  async applyEdit(
    packId: string,
    instruction: string,
    options: { userId?: string } = {},
  ): Promise<{ pack: Pack; version: PackVersion; summary: string }> {
    const pack = await packRepository.getPack(packId);
    if (!pack) throw new Error(`Pack ${packId} not found`);
    if (!pack.selectedConceptId) throw new Error(`Pack ${packId} has no concept selected`);

    const stored = await packRepository.getStoredConcept(packId, pack.selectedConceptId);
    if (!stored) throw new Error(`Concept document not found for pack ${packId}`);

    const userId = options.userId || pack.userId || "anon_user";

    // 1. Consume 1 credit for regeneration
    const consumeRes = await walletService.consumeCreditForEdit({
      userId,
      packId,
      description: instruction,
    });

    if (!consumeRes.success) {
      throw new Error(consumeRes.error || "Insufficient credits for regeneration");
    }

    try {
      // 2. Interpret edit instruction
      const { patch } = await runInterpretEdit({
        doc: stored.doc,
        instruction,
      });

      // 3. Apply patch
      const applied = applyPatch(stored.doc, patch);

      // 4. Update stored concept with new document
      stored.doc = applied.doc;

      // 5. Re-render updated preview
      const renderPreview = await renderDocument(applied.doc, {
        format: "png",
        scale: 0.6,
        watermark: undefined, // unwatermarked for paid preview
      });

      const store = storage();
      const existingVersions = await packRepository.getPackVersions(packId);
      const nextVersionNum = existingVersions.length + 1;
      const previewKey = `previews/${packId}/${pack.selectedConceptId}_v${nextVersionNum}.png`;

      await store.put({
        key: previewKey,
        body: renderPreview.buffer,
        contentType: "image/png",
      });

      // Update concept previewUrl
      stored.preview.previewUrl = store.url(previewKey);
      await packRepository.updatePack(packId, {
        concepts: pack.concepts.map((c) => (c.id === pack.selectedConceptId ? stored.preview : c)),
      });

      // 6. Repackage pack into new ZIP version
      const packagedPack = await packagingService.packagePack(packId, {
        versionNumber: nextVersionNum,
        label: patch.summary || instruction,
        patch,
      });

      const versions = await packRepository.getPackVersions(packId);
      const latestVersion = versions[0]!;

      await trackEvent({
        type: "edit_completed",
        userId,
        packId,
        payload: {
          versionNumber: nextVersionNum,
          summary: patch.summary,
        },
      });

      return {
        pack: packagedPack,
        version: latestVersion,
        summary: patch.summary,
      };
    } catch (err: any) {
      // Refund reserved credit if regeneration fails
      await walletService.refundCreditForFailedEdit({
        userId,
        packId,
        reason: err?.message || "Regeneration failed",
      });
      throw err;
    }
  }

  async restoreVersion(packId: string, versionNumber: number, options: { userId?: string } = {}): Promise<{ pack: Pack; version: PackVersion }> {
    const pack = await packRepository.getPack(packId);
    if (!pack) throw new Error(`Pack ${packId} not found`);

    const versions = await packRepository.getPackVersions(packId);
    const target = versions.find((v) => v.versionNumber === versionNumber);
    if (!target) throw new Error(`Version ${versionNumber} not found for pack ${packId}`);

    const stored = await packRepository.getStoredConcept(packId, target.conceptId);
    if (!stored) throw new Error(`Concept document not found`);

    // Restoring does not overwrite older versions — it creates a new version based on target (v4 <- v1)
    stored.doc = target.document;
    const nextVersionNum = versions.length + 1;

    const packagedPack = await packagingService.packagePack(packId, {
      versionNumber: nextVersionNum,
      parentVersionId: target.id,
      label: `Restored from v${target.versionNumber}`,
      patch: { restoredFrom: target.versionNumber },
    });

    const updatedVersions = await packRepository.getPackVersions(packId);
    return {
      pack: packagedPack,
      version: updatedVersions[0]!,
    };
  }

  // ------------------------------------------------------------- D-05 Distribution & Shares

  async createShare(packId: string, conceptId?: string): Promise<PackShare> {
    const pack = await packRepository.getPack(packId);
    if (!pack) throw new Error(`Pack ${packId} not found`);

    const cId = conceptId || pack.selectedConceptId || pack.concepts[0]?.id;
    if (!cId) throw new Error(`No concept available for share`);

    const token = crypto.randomBytes(12).toString("hex");
    const share: PackShare = {
      id: newId("shr"),
      packId,
      conceptId: cId,
      token,
      viewsCount: 0,
      createdAt: new Date().toISOString(),
    };

    await packRepository.createPackShare(share);

    await trackEvent({
      type: "share_created",
      packId,
      conceptId: cId,
      payload: { token },
    });

    return share;
  }
}

export const packService = new PackService();

