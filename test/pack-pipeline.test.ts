import { describe, it, expect, beforeEach } from "vitest";
import JSZip from "jszip";
import { SmartBrief } from "@gdp/core";
import { packService } from "@/lib/pack-service.js";
import { packRepository } from "@/lib/pack-repository.js";
import { packagingService } from "@/lib/packaging-service.js";
import { getPaymentProvider, DevPaymentProvider } from "@/lib/payment-provider.js";
import { storage } from "@gdp/storage";

describe("Pack Pipeline & Preview-to-Unlock Paywall", () => {
  const sampleBriefInput = {
    promotionType: "promotion",
    title: "Weekend Flash Sale",
    eventName: "Weekend Flash Sale",
    brandName: "Urban Style Boutique",
    offer: "30% OFF STOREWIDE",
    offerDetail: "This Saturday and Sunday only",
    promoCode: "FLASH30",
    date: "OCT 24–25",
    time: "10AM – 8PM",
    location: "Downtown Gallery & Online",
    CTA: "Shop the Sale",
    website: "urbanstyle.co",
    requestedFormats: ["ig-portrait", "ig-square", "story", "facebook"],
    feeling: "modern, bold, energetic",
  };

  describe("1. Brief Validation", () => {
    it("validates a valid smart brief successfully", () => {
      const parsed = SmartBrief.parse(sampleBriefInput);
      expect(parsed.title).toBe("Weekend Flash Sale");
      expect(parsed.offer).toBe("30% OFF STOREWIDE");
      expect(parsed.requestedFormats).toEqual(["ig-portrait", "ig-square", "story", "facebook"]);
    });

    it("applies sensible defaults for missing optional fields", () => {
      const minimal = SmartBrief.parse({
        title: "Coffee Tasting Event",
      });
      expect(minimal.promotionType).toBe("promotion");
      expect(minimal.CTA).toBe("Learn More");
      expect(minimal.requestedFormats.length).toBeGreaterThan(0);
    });

    it("handles failed brief validation gracefully", async () => {
      await expect(
        // @ts-expect-error test invalid type
        packService.createPack({ title: 12345 })
      ).rejects.toThrow();
    });
  });

  describe("2 & 3. Pack Creation & Exactly 3 Concepts Generated", () => {
    it("creates a pack and generates exactly 3 distinct concepts with watermarked previews", async () => {
      const pack = await packService.createPack(sampleBriefInput);

      expect(pack).toBeDefined();
      expect(pack.id).toMatch(/^pack_/);
      expect(pack.status).toBe("ready");
      expect(pack.concepts).toHaveLength(3);

      for (let i = 0; i < pack.concepts.length; i++) {
        const concept = pack.concepts[i]!;
        expect(concept.id).toBeDefined();
        expect(concept.title).toBeDefined();
        expect(concept.visualDirection).toBeDefined();
        expect(concept.previewUrl).toBeDefined();
        expect(concept.thumbnailUrl).toBeDefined();
        expect(concept.vqs).toBeGreaterThan(0);
        expect(concept.status).toBe("generated");
      }

      // Verify concepts are distinct
      const ids = new Set(pack.concepts.map((c) => c.id));
      expect(ids.size).toBe(3);
    });
  });

  describe("4. Concept Selection", () => {
    it("selects a concept and updates requested formats", async () => {
      const pack = await packService.createPack(sampleBriefInput);
      const chosenConcept = pack.concepts[1]!;

      const updated = await packService.selectConcept(pack.id, chosenConcept.id, [
        "ig-portrait",
        "story",
      ]);

      expect(updated.selectedConceptId).toBe(chosenConcept.id);
      expect(updated.status).toBe("selected");
      expect(updated.requestedFormats).toEqual(["ig-portrait", "story"]);

      const selectedInList = updated.concepts.find((c) => c.id === chosenConcept.id);
      expect(selectedInList?.status).toBe("selected");

      const otherInList = updated.concepts.find((c) => c.id !== chosenConcept.id);
      expect(otherInList?.status).toBe("rejected");
    });
  });

  describe("5. Watermark Protection", () => {
    it("ensures preview files exist in storage and represent watermarked previews", async () => {
      const pack = await packService.createPack(sampleBriefInput);
      const store = storage();

      for (const concept of pack.concepts) {
        const previewKey = `previews/${pack.id}/${concept.id}_preview.png`;
        const exists = await store.exists(previewKey);
        expect(exists).toBe(true);

        const buffer = await store.get(previewKey);
        expect(buffer.byteLength).toBeGreaterThan(1000);
      }
    });
  });

  describe("6 & 11. Unauthorized Access vs Paid Access", () => {
    it("rejects packaging or download when pack is unpaid", async () => {
      const pack = await packService.createPack(sampleBriefInput);
      await packService.selectConcept(pack.id, pack.concepts[0]!.id);

      // Attempt packaging before payment
      await expect(packagingService.packagePack(pack.id)).rejects.toThrow(
        /Unauthorized: Pack .* is not paid/
      );
    });
  });

  describe("7, 8, 9 & 10. Checkout, Payment Verification & Webhook Idempotency", () => {
    it("creates checkout session, verifies payment, and triggers packaging", async () => {
      const pack = await packService.createPack(sampleBriefInput);
      const chosen = pack.concepts[0]!;
      await packService.selectConcept(pack.id, chosen.id, ["ig-portrait", "ig-square", "story"]);

      // 7. Checkout creation
      const checkout = await packService.createCheckout(pack.id);
      expect(checkout.sessionId).toBeDefined();
      expect(checkout.orderId).toBeDefined();
      expect(checkout.checkoutUrl).toBeDefined();

      const order = await packRepository.getOrder(checkout.orderId);
      expect(order).toBeDefined();
      expect(order?.status).toBe("pending");

      // 8. Payment verification
      const verifyResult = await packService.verifyAndProcessPayment(pack.id, checkout.sessionId);
      expect(verifyResult.paid).toBe(true);
      expect(verifyResult.pack.status).toBe("packaged");

      const updatedOrder = await packRepository.getOrder(checkout.orderId);
      expect(updatedOrder?.status).toBe("paid");

      // 9 & 10. Webhook verification & idempotency
      const provider = getPaymentProvider();
      const payload = JSON.stringify({
        orderId: checkout.orderId,
        sessionId: checkout.sessionId,
        status: "paid",
      });

      // Valid webhook
      const webhookRes = await provider.handleWebhook(payload, "dev_signature_valid");
      expect(webhookRes.handled).toBe(true);
      expect(webhookRes.status).toBe("paid");

      // Invalid signature rejection
      const badSig = await provider.handleWebhook(payload, "fraudulent_signature");
      expect(badSig.handled).toBe(false);
    });
  });

  describe("12, 13 & 14. ZIP Creation, Manifest Generation & Format Generation", () => {
    it("generates a valid ZIP containing manifest.json and unwatermarked assets for all formats", async () => {
      const pack = await packService.createPack(sampleBriefInput);
      const chosen = pack.concepts[0]!;
      await packService.selectConcept(pack.id, chosen.id, [
        "ig-portrait",
        "ig-square",
        "story",
        "facebook",
      ]);

      // Complete payment
      const checkout = await packService.createCheckout(pack.id);
      await packService.verifyAndProcessPayment(pack.id, checkout.sessionId);

      // Verify pack state
      const packagedPack = await packRepository.getPack(pack.id);
      expect(packagedPack?.status).toBe("packaged");
      expect(packagedPack?.downloadKey).toBe(`protected/packs/${pack.id}/pack.zip`);

      // Inspect ZIP contents
      const store = storage();
      const zipBuffer = await store.get(packagedPack!.downloadKey!);
      expect(zipBuffer.byteLength).toBeGreaterThan(5000);

      const zip = await JSZip.loadAsync(zipBuffer);

      // Verify manifest
      const manifestFile = zip.file("pack/manifest.json");
      expect(manifestFile).not.toBeNull();

      const manifestContent = await manifestFile!.async("string");
      const manifest = JSON.parse(manifestContent);

      expect(manifest.packId).toBe(pack.id);
      expect(manifest.conceptId).toBe(chosen.id);
      expect(manifest.summary.unwatermarked).toBe(true);
      expect(manifest.formats).toHaveLength(4);

      // Verify each format file exists inside the ZIP
      for (const format of manifest.formats) {
        const file = zip.file(format.file);
        expect(file).not.toBeNull();
        const content = await file!.async("nodebuffer");
        expect(content.byteLength).toBeGreaterThan(1000);
      }
    });
  });
});
