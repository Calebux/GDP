import { describe, it, expect } from "vitest";
import {
  getPaymentProvider,
  DevPaymentProvider,
  PaystackPaymentProvider,
  FlutterwavePaymentProvider,
} from "@/lib/payment-provider";
import { packRepository } from "@/lib/pack-repository";
import { newId } from "@gdp/core";
import crypto from "node:crypto";

describe("D-06 Live-Payment Readiness & Reconciliation", () => {
  it("defaults to DevPaymentProvider when ENABLE_LIVE_PAYMENTS=false", () => {
    // In test environment ENABLE_LIVE_PAYMENTS defaults to false
    const provider = getPaymentProvider("NG", "ngn");
    expect(provider).toBeInstanceOf(DevPaymentProvider);
  });

  it("blocks DevPaymentProvider in production when DEV_PAYMENT_OVERRIDE is false", async () => {
    const origNodeEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = "production";
      const devProvider = new DevPaymentProvider();

      await expect(
        devProvider.createCheckoutSession(
          { id: "pack_prod_test", brief: { title: "Test" }, requestedFormats: [] } as any,
          { id: "ord_prod_test", packId: "pack_prod_test", amount: 299, currency: "usd" } as any,
        ),
      ).rejects.toThrow(/DEV_PAYMENT_OVERRIDE/i);
    } finally {
      process.env.NODE_ENV = origNodeEnv;
    }
  });

  it("verifies Paystack webhook using timing-safe HMAC check", async () => {
    const secret = "test_paystack_secret_key_123";
    const provider = new PaystackPaymentProvider(secret, secret);

    const payload = JSON.stringify({
      event: "charge.success",
      data: {
        id: 998877,
        reference: "ord_ref_12345",
        status: "success",
        amount: 450000,
        currency: "NGN",
      },
    });

    const validSignature = crypto
      .createHmac("sha512", secret)
      .update(payload)
      .digest("hex");

    // 1. Valid signature succeeds
    const validResult = await provider.handleWebhook(payload, validSignature);
    expect(validResult.handled).toBe(true);
    expect(validResult.orderId).toBe("ord_ref_12345");
    expect(validResult.status).toBe("paid");
    expect(validResult.eventId).toBe("998877");

    // 2. Invalid signature fails
    const invalidResult = await provider.handleWebhook(payload, "invalid_tampered_signature");
    expect(invalidResult.handled).toBe(false);
    expect(invalidResult.error).toBe("Invalid signature");
  });

  it("verifies Flutterwave webhook using constant-time verif-hash check", async () => {
    const secret = "flw_verif_hash_secret_token";
    const provider = new FlutterwavePaymentProvider("flw_secret", secret);

    const payload = JSON.stringify({
      event: "charge.completed",
      data: {
        id: 554433,
        tx_ref: "ord_flw_67890",
        status: "successful",
        amount: 2.99,
        currency: "USD",
      },
    });

    // 1. Valid hash succeeds
    const validResult = await provider.handleWebhook(payload, secret);
    expect(validResult.handled).toBe(true);
    expect(validResult.orderId).toBe("ord_flw_67890");
    expect(validResult.status).toBe("paid");

    // 2. Invalid hash fails
    const invalidResult = await provider.handleWebhook(payload, "wrong_hash_token");
    expect(invalidResult.handled).toBe(false);
    expect(invalidResult.error).toBe("Invalid verif-hash");
  });

  it("prevents duplicate webhook processing via processedWebhooks repository", async () => {
    const eventId = `evt_stripe_${newId("wh")}`;

    // First arrival: should be accepted as new
    const firstCheck = await packRepository.recordProcessedWebhook("stripe", eventId, "checkout.session.completed");
    expect(firstCheck).toBe(true);

    // Second arrival: duplicate must be detected and rejected
    const secondCheck = await packRepository.recordProcessedWebhook("stripe", eventId, "checkout.session.completed");
    expect(secondCheck).toBe(false);

    const isProcessed = await packRepository.isWebhookProcessed(eventId);
    expect(isProcessed).toBe(true);
  });
});
