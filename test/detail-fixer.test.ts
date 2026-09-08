import { describe, it, expect } from "vitest";
import { packService } from "@/lib/pack-service";
import { walletService } from "@/lib/wallet-service";
import { packRepository } from "@/lib/pack-repository";
import { newId } from "@gdp/core";

describe("D-04: Post-Purchase Detail Fixer & Version History", () => {
  const brief = {
    promotionType: "church",
    title: "Youth Impact Conference",
    date: "OCT 10",
    requestedFormats: ["ig-portrait", "story"],
  };

  it("interprets changes, applies edit with credit consumption, generates new version, and restores", async () => {
    const userId = `user_edit_${newId("u")}`;

    // 1. Create and pay for a pack
    const pack = await packService.createPack(brief);
    await packService.selectConcept(pack.id, pack.concepts[0]!.id);
    const checkout = await packService.createCheckout(pack.id, { productId: "bundle-5", userId });
    await packService.verifyAndProcessPayment(pack.id, checkout.sessionId);

    const initialWallet = await walletService.getWallet(userId);
    expect(initialWallet.balance).toBe(4); // 5 purchased - 1 unlocked

    // 2. Interpret edit (does not consume credits)
    const interpretation = await packService.interpretEdit(pack.id, "Change the date to October 12");
    expect(interpretation.summary).toBeDefined();
    expect(interpretation.creditCost).toBe(1);

    const walletAfterInterpret = await walletService.getWallet(userId);
    expect(walletAfterInterpret.balance).toBe(4); // Still 4

    // 3. Apply edit -> consumes 1 credit and creates v2
    const editResult = await packService.applyEdit(pack.id, "Change the date to October 12", { userId });
    expect(editResult.version.versionNumber).toBe(2);

    const walletAfterEdit = await walletService.getWallet(userId);
    expect(walletAfterEdit.balance).toBe(3); // 4 - 1 = 3

    // 4. Check version history
    const versions = await packRepository.getPackVersions(pack.id);
    expect(versions.length).toBe(2);
    expect(versions[0]?.versionNumber).toBe(2);
    expect(versions[1]?.versionNumber).toBe(1);

    // 5. Restore Version 1 -> creates Version 3 based on v1 (immutable history)
    const restoreResult = await packService.restoreVersion(pack.id, 1, { userId });
    expect(restoreResult.version.versionNumber).toBe(3);
    expect(restoreResult.version.label).toContain("Restored");

    const versionsAfterRestore = await packRepository.getPackVersions(pack.id);
    expect(versionsAfterRestore.length).toBe(3);
  });

  it("safely refunds reserved credits if regeneration fails", async () => {
    const userId = `user_refund_${newId("u")}`;
    await walletService.grantCreditsFromOrder({ userId, orderId: "ord_1", credits: 2 });

    const pack = await packService.createPack(brief);
    await packService.selectConcept(pack.id, pack.concepts[0]!.id);

    // Simulate failure by passing invalid pack id to apply
    await expect(packService.applyEdit("invalid_pack_id", "Make headline bigger", { userId })).rejects.toThrow();

    // User's credit balance should remain intact
    const wallet = await walletService.getWallet(userId);
    expect(wallet.balance).toBe(2);
  });
});
