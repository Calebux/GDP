import { describe, it, expect } from "vitest";
import { packService } from "@/lib/pack-service";
import { walletService } from "@/lib/wallet-service";
import { packRepository } from "@/lib/pack-repository";
import { newId } from "@gdp/core";

describe("D-02: Bundles & Credit Wallet", () => {
  const brief = {
    promotionType: "retail",
    title: "Summer Solstice Sale",
    offer: "30% Off Storewide",
    requestedFormats: ["ig-portrait", "ig-square"],
  };

  it("grants 5 credits for a 5-pack bundle and allows multi-pack unlocking", async () => {
    const userId = `user_test_${newId("u")}`;
    const initialWallet = await walletService.getWallet(userId);
    expect(initialWallet.balance).toBe(0);

    // 1. Create a pack
    const pack = await packService.createPack(brief);
    await packService.selectConcept(pack.id, pack.concepts[0]!.id);

    // 2. Checkout 5-pack bundle
    const checkout = await packService.createCheckout(pack.id, {
      productId: "bundle-5",
      userId,
    });
    expect(checkout.sessionId).toBeDefined();

    // 3. Verify payment: should grant 5 credits, consume 1 to unlock pack -> 4 credits remaining
    const payment = await packService.verifyAndProcessPayment(pack.id, checkout.sessionId);
    expect(payment.paid).toBe(true);

    const updatedWallet = await walletService.getWallet(userId);
    expect(updatedWallet.balance).toBe(4);
    expect(updatedWallet.lifetimePurchased).toBe(5);
    expect(updatedWallet.lifetimeUsed).toBe(1);

    // 4. Create second pack and unlock directly using 1 wallet credit
    const pack2 = await packService.createPack({ ...brief, title: "Second Promo" });
    await packService.selectConcept(pack2.id, pack2.concepts[0]!.id);

    const creditCheckout = await packService.createCheckout(pack2.id, {
      productId: "wallet_credit",
      userId,
    });
    expect(creditCheckout.unlockedWithCredit).toBe(true);

    const walletAfterPack2 = await walletService.getWallet(userId);
    expect(walletAfterPack2.balance).toBe(3);
    expect(walletAfterPack2.lifetimeUsed).toBe(2);
  });

  it("enforces credit integrity and prevents balance < 0", async () => {
    const poorUserId = `user_poor_${newId("u")}`;
    const wallet = await walletService.getWallet(poorUserId);
    expect(wallet.balance).toBe(0);

    const pack = await packService.createPack(brief);
    await packService.selectConcept(pack.id, pack.concepts[0]!.id);

    await expect(
      packService.createCheckout(pack.id, {
        productId: "wallet_credit",
        userId: poorUserId,
      })
    ).rejects.toThrow(/insufficient/i);

    const checkWallet = await walletService.getWallet(poorUserId);
    expect(checkWallet.balance).toBe(0);
  });

  it("ensures duplicate order fulfillment does not double-credit wallet (idempotency)", async () => {
    const userId = `user_idem_${newId("u")}`;
    const orderId = `ord_idem_${newId("o")}`;

    await walletService.grantCreditsFromOrder({
      userId,
      orderId,
      credits: 5,
    });

    const w1 = await walletService.getWallet(userId);
    expect(w1.balance).toBe(5);

    // Duplicate call with same orderId
    await walletService.grantCreditsFromOrder({
      userId,
      orderId,
      credits: 5,
    });

    const w2 = await walletService.getWallet(userId);
    expect(w2.balance).toBe(5);
  });
});
