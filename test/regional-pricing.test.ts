import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import {
  detectPricingContext,
  getProductPlans,
  formatMoney,
  getProductPlan,
} from "@/lib/pricing";
import {
  PaystackPaymentProvider,
  FlutterwavePaymentProvider,
  StripePaymentProvider,
  getPaymentProvider,
} from "@/lib/payment-provider";
import { packService } from "@/lib/pack-service";

describe("D-06: Regional Pricing & Payment Providers", () => {
  it("detects country and sets appropriate currency and pricing", () => {
    // 1. Nigeria -> NGN (₦5,000 single, ₦18,000 bundle)
    const ngCtx = detectPricingContext({ "x-country-code": "NG" });
    expect(ngCtx.region).toBe("NG");
    expect(ngCtx.currency).toBe("ngn");
    const ngPlans = getProductPlans(ngCtx);
    expect(ngPlans[0]?.price).toBe(500000);
    expect(formatMoney(ngPlans[0]!.price, "ngn")).toContain("5,000");

    // 2. United Kingdom -> GBP (£15.00 single, £39.00 bundle)
    const gbCtx = detectPricingContext({ "cf-ipcountry": "GB" });
    expect(gbCtx.region).toBe("GB");
    expect(gbCtx.currency).toBe("gbp");
    const gbPlans = getProductPlans(gbCtx);
    expect(gbPlans[0]?.price).toBe(1500);
    expect(formatMoney(gbPlans[0]!.price, "gbp")).toContain("15.00");

    // 3. United States -> USD ($19.00 single, $49.00 bundle)
    const usCtx = detectPricingContext({ "x-vercel-ip-country": "US" });
    expect(usCtx.region).toBe("US");
    expect(usCtx.currency).toBe("usd");
    const usPlans = getProductPlans(usCtx);
    expect(usPlans[0]?.price).toBe(1900);
    expect(formatMoney(usPlans[0]!.price, "usd")).toContain("19.00");

    // 4. Fallback unknown -> DEFAULT ($2.99 single, $9.99 bundle)
    const defaultCtx = detectPricingContext({});
    expect(defaultCtx.region).toBe("DEFAULT");
    expect(defaultCtx.currency).toBe("usd");
    const defPlans = getProductPlans(defaultCtx);
    expect(defPlans[0]?.price).toBe(299);
  });

  it("Paystack provider creates session and verifies signature securely", async () => {
    const paystack = new PaystackPaymentProvider("sk_test_mock_paystack", "secret_paystack_key");

    const pack = await packService.createPack({
      promotionType: "church",
      title: "Lagos Ministry Summit",
      email: "pastor@church.ng",
    });

    const session = await paystack.createCheckoutSession(pack, {
      id: "ord_ng_1",
      packId: pack.id,
      amount: 500000,
      currency: "ngn",
      provider: "paystack",
      providerSessionId: "",
      status: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    expect(session.sessionId).toBe("ord_ng_1");
    expect(session.checkoutUrl).toBeDefined();

    // Webhook verification with valid HMAC SHA512
    const webhookPayload = JSON.stringify({
      event: "charge.success",
      data: { reference: "ord_ng_1", status: "success", amount: 500000 },
    });
    const validSignature = crypto
      .createHmac("sha512", "secret_paystack_key")
      .update(webhookPayload)
      .digest("hex");

    const webhookRes = await paystack.handleWebhook(webhookPayload, validSignature);
    expect(webhookRes.handled).toBe(true);
    expect(webhookRes.orderId).toBe("ord_ng_1");
    expect(webhookRes.status).toBe("paid");

    // Webhook with invalid signature fails
    const badWebhookRes = await paystack.handleWebhook(webhookPayload, "invalid_sig");
    expect(badWebhookRes.handled).toBe(false);
  });

  it("Flutterwave provider verifies webhook hash properly", async () => {
    const flutterwave = new FlutterwavePaymentProvider("flw_sec_key", "my_secret_verif_hash");

    const payload = JSON.stringify({
      event: "charge.completed",
      status: "successful",
      data: { tx_ref: "ord_flw_1", status: "successful", amount: 50 },
    });

    // Valid hash
    const validRes = await flutterwave.handleWebhook(payload, { "verif-hash": "my_secret_verif_hash" });
    expect(validRes.handled).toBe(true);
    expect(validRes.orderId).toBe("ord_flw_1");

    // Invalid hash
    const invalidRes = await flutterwave.handleWebhook(payload, { "verif-hash": "wrong_hash" });
    expect(invalidRes.handled).toBe(false);
  });
});
