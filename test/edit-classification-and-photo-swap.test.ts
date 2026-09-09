import { describe, it, expect } from "vitest";
import { classifyEdit } from "@/lib/edit-classifier";
import { packService } from "@/lib/pack-service";
import { packRepository } from "@/lib/pack-repository";
import { walletService } from "@/lib/wallet-service";
import { newId } from "@gdp/core";

describe("D-04 Free Edits, Metered Regenerations & Photo Swapping", () => {
  it("correctly classifies free text fixes as zero credit cost", () => {
    const textFix = classifyEdit({
      instructions: "Change title to Youth Conference",
      targetLayerId: "headline",
      patch: { content: "Youth Conference" },
    });

    expect(textFix.category).toBe("TEXT_CORRECTION");
    expect(textFix.creditCost).toBe(0);
    expect(textFix.isFree).toBe(true);
  });

  it("correctly classifies date/time corrections as zero credit cost", () => {
    const dateFix = classifyEdit({
      instructions: "Change the date to 10am Sunday Oct 12",
      targetLayerId: "date",
      patch: { content: "Sunday Oct 12, 10:00 AM" },
    });

    expect(dateFix.category).toBe("DATE_TIME_CORRECTION");
    expect(dateFix.creditCost).toBe(0);
    expect(dateFix.isFree).toBe(true);
  });

  it("classifies creative and structural layout regenerations as metered (1 credit)", () => {
    const styleChange = classifyEdit({
      instructions: "Make the background dark neon purple with glowing accents",
      patch: {
        fill: { type: "solid", color: "#4c1d95" },
        filters: [{ type: "neon-glow" }],
      },
    });

    expect(styleChange.category).toBe("CREATIVE_REGENERATION");
    expect(styleChange.creditCost).toBe(1);
    expect(styleChange.isFree).toBe(false);

    const layoutRegen = classifyEdit({
      instructions: "Completely change the layout and rearrange all elements",
      patch: {
        layers: [],
        layoutType: "split-horizontal",
      },
    });

    expect(layoutRegen.category).toBe("STRUCTURAL_REGENERATION");
    expect(layoutRegen.creditCost).toBe(1);
  });

  it("performs post-purchase photo swap without consuming wallet credits", async () => {
    const userId = `user_${newId("u")}`;

    // 1. Create and unlock pack
    const pack = await packService.createPack({
      promotionType: "music",
      title: "Album Release Concert",
      requestedFormats: ["ig-portrait"],
      email: "artist@gdp.design",
    });
    await packService.selectConcept(pack.id, pack.concepts[0]!.id);

    const checkout = await packService.createCheckout(pack.id, {
      productId: "single",
      userId,
    });
    await packService.verifyAndProcessPayment(pack.id, checkout.sessionId);

    // Initial wallet balance should be 0 (single pack purchased and consumed)
    const wallet = await walletService.getWallet(userId);
    expect(wallet.balance).toBe(0);

    // 2. Perform Photo Swap with valid PNG bytes (1x1 transparent PNG)
    const validPngBase64 =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

    const swapResult = await packService.swapPhoto(pack.id, {
      userId,
      imageBase64: validPngBase64,
      mimeType: "image/png",
    });

    expect(swapResult.success).toBe(true);
    expect(swapResult.versionNumber).toBeGreaterThan(1);
    expect(swapResult.assetUrl).toBeDefined();

    // Verify wallet balance remained 0 (no credits were deducted!)
    const walletAfter = await walletService.getWallet(userId);
    expect(walletAfter.balance).toBe(0);

    // Verify pack version recorded PHOTO_SWAP category
    const versions = await packRepository.getPackVersions(pack.id);
    const latestVersion = versions[0];
    expect(latestVersion?.editCategory).toBe("PHOTO_SWAP");
  });

  it("rejects photo swap with invalid file type or corrupt magic bytes", async () => {
    const pack = await packService.createPack({
      promotionType: "retail",
      title: "Flash Sale",
      requestedFormats: ["ig-square"],
    });
    await packService.selectConcept(pack.id, pack.concepts[0]!.id);
    const checkout = await packService.createCheckout(pack.id, { productId: "single" });
    await packService.verifyAndProcessPayment(pack.id, checkout.sessionId);

    // Plain text encoded as base64
    const fakeImageBase64 = Buffer.from("THIS IS NOT A VALID IMAGE").toString("base64");

    await expect(
      packService.swapPhoto(pack.id, {
        imageBase64: `data:image/png;base64,${fakeImageBase64}`,
        mimeType: "image/png",
      }),
    ).rejects.toThrow(/invalid image format/i);
  });
});
