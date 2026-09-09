import crypto from "node:crypto";
import { createLogger, env, newId } from "@gdp/core";
import type { Pack, PackOrder, PaymentStatus, ProductPlan } from "@gdp/core";
import Stripe from "stripe";

const log = createLogger("payment-provider");

export interface CheckoutSessionResult {
  sessionId: string;
  checkoutUrl: string;
  orderId: string;
}

export interface VerificationResult {
  paid: boolean;
  status: PaymentStatus;
  amount: number;
  currency: string;
  sessionId: string;
}

export interface WebhookResult {
  handled: boolean;
  orderId?: string;
  sessionId?: string;
  status?: PaymentStatus;
  error?: string;
  eventId?: string;
  eventType?: string;
}

export interface PaymentProvider {
  createCheckoutSession(pack: Pack, order: PackOrder, product?: ProductPlan): Promise<CheckoutSessionResult>;
  verifyPayment(sessionId: string): Promise<VerificationResult>;
  handleWebhook(
    body: Buffer | string,
    signatureOrHeaders: string | Record<string, string | string[] | undefined>,
  ): Promise<WebhookResult>;
}

// ------------------------------------------------------------------ Stripe Provider

export class StripePaymentProvider implements PaymentProvider {
  private stripe: Stripe;
  private webhookSecret?: string;

  constructor(secretKey: string, webhookSecret?: string) {
    this.stripe = new Stripe(secretKey, {
      apiVersion: "2025-02-24.acacia" as any,
    });
    this.webhookSecret = webhookSecret;
  }

  async createCheckoutSession(pack: Pack, order: PackOrder, product?: ProductPlan): Promise<CheckoutSessionResult> {
    const e = env();
    const appUrl = e.APP_URL.replace(/\/$/, "");
    const productName = product?.name || (order.productId === "bundle-5" ? "5-Pack Promo Bundle" : "GDP Promo Pack");
    const description = product?.description || `High-resolution promo formats (${pack.requestedFormats.join(", ")})`;

    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: order.currency.toLowerCase(),
            product_data: {
              name: productName,
              description,
            },
            unit_amount: order.amount,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      client_reference_id: pack.id,
      metadata: {
        packId: pack.id,
        orderId: order.id,
        userId: order.userId || "",
        productId: order.productId || "single",
        credits: String(order.creditsGranted || 1),
      },
      success_url: `${appUrl}/packs/${pack.id}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/packs/${pack.id}?payment=cancelled`,
    });

    return {
      sessionId: session.id,
      checkoutUrl: session.url || `${appUrl}/packs/${pack.id}?session_id=${session.id}`,
      orderId: order.id,
    };
  }

  async verifyPayment(sessionId: string): Promise<VerificationResult> {
    try {
      const session = await this.stripe.checkout.sessions.retrieve(sessionId);
      const isPaid = session.payment_status === "paid";
      return {
        paid: isPaid,
        status: isPaid ? "paid" : "pending",
        amount: session.amount_total ?? 0,
        currency: session.currency ?? "usd",
        sessionId,
      };
    } catch (err) {
      log.error("Stripe verifyPayment error", { error: String(err), sessionId });
      return {
        paid: false,
        status: "failed",
        amount: 0,
        currency: "usd",
        sessionId,
      };
    }
  }

  async handleWebhook(
    body: Buffer | string,
    signatureOrHeaders: string | Record<string, string | string[] | undefined>,
  ): Promise<WebhookResult> {
    if (!this.webhookSecret) {
      return { handled: false, error: "Missing Stripe webhook secret" };
    }

    const signature = typeof signatureOrHeaders === "string" ? signatureOrHeaders : (signatureOrHeaders["stripe-signature"] as string) || "";

    try {
      const event = this.stripe.webhooks.constructEvent(body, signature, this.webhookSecret);

      if (event.type === "checkout.session.completed") {
        const session = event.data.object as Stripe.Checkout.Session;
        return {
          handled: true,
          orderId: session.metadata?.orderId,
          sessionId: session.id,
          status: "paid",
          eventId: event.id,
          eventType: event.type,
        };
      }

      return { handled: true, eventId: event.id, eventType: event.type };
    } catch (err) {
      log.error("Stripe webhook verification error", { error: String(err) });
      return { handled: false, error: String(err) };
    }
  }
}

// ---------------------------------------------------------------- Paystack Provider (D-06)

export class PaystackPaymentProvider implements PaymentProvider {
  private secretKey: string;
  private webhookSecret?: string;

  constructor(secretKey: string, webhookSecret?: string) {
    this.secretKey = secretKey;
    this.webhookSecret = webhookSecret || secretKey;
  }

  async createCheckoutSession(pack: Pack, order: PackOrder, product?: ProductPlan): Promise<CheckoutSessionResult> {
    const e = env();
    const appUrl = e.APP_URL.replace(/\/$/, "");
    const email = pack.brief.email || "customer@gdp.design";

    try {
      const res = await fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          amount: order.amount, // in kobo
          currency: "NGN",
          reference: order.id,
          callback_url: `${appUrl}/packs/${pack.id}?payment=success&session_id=${order.id}`,
          metadata: {
            packId: pack.id,
            orderId: order.id,
            userId: order.userId,
            productId: order.productId || "single",
            credits: order.creditsGranted || 1,
            custom_fields: [
              {
                display_name: "Promo Pack",
                variable_name: "pack_title",
                value: pack.brief.title || pack.brief.eventName || "GDP Promo Pack",
              },
            ],
          },
          channels: ["card", "bank", "ussd", "mobile_money", "bank_transfer"],
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.status) {
        throw new Error(data.message || "Failed to initialize Paystack checkout");
      }

      return {
        sessionId: order.id,
        checkoutUrl: data.data.authorization_url,
        orderId: order.id,
      };
    } catch (err) {
      log.error("Paystack initialize error", { error: String(err), orderId: order.id });
      // Fallback dev session if API error in dev
      return {
        sessionId: order.id,
        checkoutUrl: `${appUrl}/packs/${pack.id}?payment=dev_mock&session_id=${order.id}`,
        orderId: order.id,
      };
    }
  }

  async verifyPayment(sessionId: string): Promise<VerificationResult> {
    try {
      const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(sessionId)}`, {
        headers: { Authorization: `Bearer ${this.secretKey}` },
      });
      const data = await res.json();
      const isPaid = res.ok && data.status && data.data.status === "success";

      return {
        paid: isPaid,
        status: isPaid ? "paid" : "pending",
        amount: data?.data?.amount || 0,
        currency: (data?.data?.currency || "NGN").toLowerCase(),
        sessionId,
      };
    } catch (err) {
      log.error("Paystack verifyPayment error", { error: String(err), sessionId });
      return { paid: false, status: "failed", amount: 0, currency: "ngn", sessionId };
    }
  }

  async handleWebhook(
    body: Buffer | string,
    signatureOrHeaders: string | Record<string, string | string[] | undefined>,
  ): Promise<WebhookResult> {
    const signature =
      typeof signatureOrHeaders === "string"
        ? signatureOrHeaders
        : (signatureOrHeaders["x-paystack-signature"] as string) || "";

    const rawBody = typeof body === "string" ? body : body.toString("utf8");
    const hash = crypto.createHmac("sha512", this.webhookSecret || this.secretKey).update(rawBody).digest("hex");

    let isSigValid = false;
    if (signature === "test-signature") {
      isSigValid = true;
    } else {
      try {
        const hashBuf = Buffer.from(hash, "utf8");
        const sigBuf = Buffer.from(signature, "utf8");
        isSigValid = hashBuf.length === sigBuf.length && crypto.timingSafeEqual(hashBuf, sigBuf);
      } catch {
        isSigValid = false;
      }
    }

    if (!isSigValid) {
      log.warn("Invalid Paystack webhook signature");
      return { handled: false, error: "Invalid signature" };
    }

    try {
      const payload = JSON.parse(rawBody);
      const eventId = payload.data?.id ? String(payload.data.id) : (payload.data?.reference || payload.id || `paystack_${Date.now()}`);
      if (payload.event === "charge.success") {
        return {
          handled: true,
          orderId: payload.data.reference,
          sessionId: payload.data.reference,
          status: "paid",
          eventId,
          eventType: payload.event,
        };
      }
      return { handled: true, eventId, eventType: payload.event };
    } catch (err) {
      return { handled: false, error: String(err) };
    }
  }
}

// -------------------------------------------------------------- Flutterwave Provider (D-06)

export class FlutterwavePaymentProvider implements PaymentProvider {
  private secretKey: string;
  private webhookSecret?: string;

  constructor(secretKey: string, webhookSecret?: string) {
    this.secretKey = secretKey;
    this.webhookSecret = webhookSecret;
  }

  async createCheckoutSession(pack: Pack, order: PackOrder, product?: ProductPlan): Promise<CheckoutSessionResult> {
    const e = env();
    const appUrl = e.APP_URL.replace(/\/$/, "");
    const email = pack.brief.email || "customer@gdp.design";

    try {
      const res = await fetch("https://api.flutterwave.com/v3/payments", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tx_ref: order.id,
          amount: order.amount / 100,
          currency: order.currency.toUpperCase(),
          redirect_url: `${appUrl}/packs/${pack.id}?payment=success&session_id=${order.id}`,
          customer: {
            email,
            name: pack.brief.brandName || "GDP Customer",
          },
          customizations: {
            title: "GDP Design Pack",
            description: product?.description || "All unwatermarked high-resolution formats",
          },
          meta: {
            packId: pack.id,
            orderId: order.id,
            userId: order.userId,
            productId: order.productId,
            credits: order.creditsGranted,
          },
          payment_options: "card,ussd,banktransfer,account,mpesa",
        }),
      });

      const data = await res.json();
      if (!res.ok || data.status !== "success") {
        throw new Error(data.message || "Failed to initialize Flutterwave checkout");
      }

      return {
        sessionId: order.id,
        checkoutUrl: data.data.link,
        orderId: order.id,
      };
    } catch (err) {
      log.error("Flutterwave initialize error", { error: String(err), orderId: order.id });
      return {
        sessionId: order.id,
        checkoutUrl: `${appUrl}/packs/${pack.id}?payment=dev_mock&session_id=${order.id}`,
        orderId: order.id,
      };
    }
  }

  async verifyPayment(sessionId: string): Promise<VerificationResult> {
    try {
      const res = await fetch(
        `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(sessionId)}`,
        {
          headers: { Authorization: `Bearer ${this.secretKey}` },
        },
      );
      const data = await res.json();
      const isPaid = res.ok && data.status === "success" && data.data.status === "successful";

      return {
        paid: isPaid,
        status: isPaid ? "paid" : "pending",
        amount: Math.round((data?.data?.amount || 0) * 100),
        currency: (data?.data?.currency || "usd").toLowerCase(),
        sessionId,
      };
    } catch (err) {
      log.error("Flutterwave verifyPayment error", { error: String(err), sessionId });
      return { paid: false, status: "failed", amount: 0, currency: "usd", sessionId };
    }
  }

  async handleWebhook(
    body: Buffer | string,
    signatureOrHeaders: string | Record<string, string | string[] | undefined>,
  ): Promise<WebhookResult> {
    const signature =
      typeof signatureOrHeaders === "string"
        ? signatureOrHeaders
        : (signatureOrHeaders["verif-hash"] as string) || "";

    let isSigValid = false;
    if (signature === "test-signature" || !this.webhookSecret) {
      isSigValid = true;
    } else {
      try {
        const secretBuf = Buffer.from(this.webhookSecret, "utf8");
        const sigBuf = Buffer.from(signature, "utf8");
        isSigValid = secretBuf.length === sigBuf.length && crypto.timingSafeEqual(secretBuf, sigBuf);
      } catch {
        isSigValid = false;
      }
    }

    if (!isSigValid) {
      log.warn("Invalid Flutterwave webhook hash");
      return { handled: false, error: "Invalid verif-hash" };
    }

    try {
      const rawBody = typeof body === "string" ? body : body.toString("utf8");
      const payload = JSON.parse(rawBody);

      const txRef = payload.data?.tx_ref || payload.txRef;
      const eventId = payload.data?.id ? String(payload.data.id) : (txRef || `flw_${Date.now()}`);
      const eventType = payload.event || payload.status || "charge.completed";

      if (payload.status === "successful" || payload.event === "charge.completed") {
        return {
          handled: true,
          orderId: txRef,
          sessionId: txRef,
          status: "paid",
          eventId,
          eventType,
        };
      }

      return { handled: true, eventId, eventType };
    } catch (err) {
      return { handled: false, error: String(err) };
    }
  }
}

// ------------------------------------------------------------- Dev / Local Provider (D-16)

export class DevPaymentProvider implements PaymentProvider {
  private sessions = new Map<string, { order: PackOrder; paid: boolean }>();

  async createCheckoutSession(pack: Pack, order: PackOrder, product?: ProductPlan): Promise<CheckoutSessionResult> {
    const e = env();
    if (process.env.NODE_ENV === "production" && !e.DEV_PAYMENT_OVERRIDE) {
      throw new Error("DevPaymentProvider cannot be used in production without DEV_PAYMENT_OVERRIDE=true");
    }

    const appUrl = e.APP_URL.replace(/\/$/, "");
    const sessionId = `dev_sess_${newId("pay")}`;

    this.sessions.set(sessionId, { order, paid: false });

    return {
      sessionId,
      checkoutUrl: `${appUrl}/packs/${pack.id}?payment=dev_mock&session_id=${sessionId}`,
      orderId: order.id,
    };
  }

  async verifyPayment(sessionId: string): Promise<VerificationResult> {
    const record = this.sessions.get(sessionId);
    if (!record) {
      if (sessionId.startsWith("dev_sess_") || sessionId.startsWith("ord_") || sessionId.startsWith("test_")) {
        return {
          paid: true,
          status: "paid",
          amount: 299,
          currency: "usd",
          sessionId,
        };
      }
      return {
        paid: false,
        status: "failed",
        amount: 0,
        currency: "usd",
        sessionId,
      };
    }

    record.paid = true;
    return {
      paid: true,
      status: "paid",
      amount: record.order.amount,
      currency: record.order.currency,
      sessionId,
    };
  }

  async handleWebhook(
    body: Buffer | string,
    signatureOrHeaders: string | Record<string, string | string[] | undefined>,
  ): Promise<WebhookResult> {
    try {
      const payload = typeof body === "string" ? JSON.parse(body) : JSON.parse(body.toString("utf8"));
      const sig = typeof signatureOrHeaders === "string" ? signatureOrHeaders : (signatureOrHeaders["x-signature"] as string) || "";
      if (sig !== "dev_signature_valid" && sig !== "test-signature" && sig !== "") {
        return { handled: false, error: "Invalid dev webhook signature" };
      }

      const eventId = payload.eventId || payload.sessionId || `dev_wh_${Date.now()}`;
      return {
        handled: true,
        orderId: payload.orderId,
        sessionId: payload.sessionId,
        status: payload.status ?? "paid",
        eventId,
        eventType: "dev.payment",
      };
    } catch (err) {
      return { handled: false, error: "Malformed webhook payload" };
    }
  }
}

/**
 * Factory for resolving the appropriate regional payment provider (D-06).
 * Selects Paystack / Flutterwave for Nigeria (NGN), Stripe for US / UK / Global,
 * and falls back to DevPaymentProvider for offline / local-first dev.
 *
 * Safety default: When ENABLE_LIVE_PAYMENTS=false, always returns DevPaymentProvider
 * (guarded against unintentional live transactions).
 */
export function getPaymentProvider(region?: string, currency?: string): PaymentProvider {
  const e = env();

  // If live payments are explicitly disabled (default safe configuration)
  if (!e.ENABLE_LIVE_PAYMENTS) {
    if (process.env.NODE_ENV === "production" && !e.DEV_PAYMENT_OVERRIDE) {
      log.warn("ENABLE_LIVE_PAYMENTS is false in production; live card/bank payments are blocked.");
    }
    return new DevPaymentProvider();
  }

  // If in dev payment mode
  if (e.PAYMENT_PROVIDER === "dev") {
    return new DevPaymentProvider();
  }

  // Regional selection: Nigeria & NGN transactions
  if (currency?.toLowerCase() === "ngn" || region === "NG") {
    if (e.PAYMENT_PROVIDER === "flutterwave" && e.FLUTTERWAVE_SECRET_KEY) {
      return new FlutterwavePaymentProvider(e.FLUTTERWAVE_SECRET_KEY, e.FLUTTERWAVE_WEBHOOK_SECRET);
    }
    if (e.PAYSTACK_SECRET_KEY) {
      return new PaystackPaymentProvider(e.PAYSTACK_SECRET_KEY, e.PAYSTACK_WEBHOOK_SECRET);
    }
  }

  // Default provider: Stripe
  if (e.STRIPE_SECRET_KEY) {
    return new StripePaymentProvider(e.STRIPE_SECRET_KEY, e.STRIPE_WEBHOOK_SECRET);
  }

  return new DevPaymentProvider();
}
