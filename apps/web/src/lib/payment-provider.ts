import { createLogger, env, newId } from "@gdp/core";
import type { Pack, PackOrder, PaymentStatus } from "@gdp/core";
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
}

export interface PaymentProvider {
  createCheckoutSession(pack: Pack, order: PackOrder): Promise<CheckoutSessionResult>;
  verifyPayment(sessionId: string): Promise<VerificationResult>;
  handleWebhook(body: Buffer | string, signature: string): Promise<WebhookResult>;
}

export class StripePaymentProvider implements PaymentProvider {
  private stripe: Stripe;
  private webhookSecret?: string;

  constructor(secretKey: string, webhookSecret?: string) {
    this.stripe = new Stripe(secretKey, {
      apiVersion: "2025-02-24.acacia" as any,
    });
    this.webhookSecret = webhookSecret;
  }

  async createCheckoutSession(pack: Pack, order: PackOrder): Promise<CheckoutSessionResult> {
    const e = env();
    const appUrl = e.APP_URL.replace(/\/$/, "");

    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: order.currency.toLowerCase(),
            product_data: {
              name: `GDP Promo Pack: ${pack.brief.eventName || pack.brief.title || "Social Promo"}`,
              description: `All unwatermarked high-resolution formats (${pack.requestedFormats.join(", ")})`,
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

  async handleWebhook(body: Buffer | string, signature: string): Promise<WebhookResult> {
    if (!this.webhookSecret) {
      return { handled: false, error: "Missing Stripe webhook secret" };
    }

    try {
      const event = this.stripe.webhooks.constructEvent(body, signature, this.webhookSecret);

      if (event.type === "checkout.session.completed") {
        const session = event.data.object as Stripe.Checkout.Session;
        return {
          handled: true,
          orderId: session.metadata?.orderId,
          sessionId: session.id,
          status: "paid",
        };
      }

      return { handled: true };
    } catch (err) {
      log.error("Stripe webhook verification error", { error: String(err) });
      return { handled: false, error: String(err) };
    }
  }
}

/** Dev / Local Test payment provider (zero external dependency per D-16) */
export class DevPaymentProvider implements PaymentProvider {
  private sessions = new Map<string, { order: PackOrder; paid: boolean }>();

  async createCheckoutSession(pack: Pack, order: PackOrder): Promise<CheckoutSessionResult> {
    const e = env();
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
      // allow instant verification if session has prefix dev_sess_
      if (sessionId.startsWith("dev_sess_")) {
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

    // In dev mode, verify marks it as paid
    record.paid = true;
    return {
      paid: true,
      status: "paid",
      amount: record.order.amount,
      currency: record.order.currency,
      sessionId,
    };
  }

  async handleWebhook(body: Buffer | string, signature: string): Promise<WebhookResult> {
    try {
      const payload = typeof body === "string" ? JSON.parse(body) : JSON.parse(body.toString("utf8"));
      if (signature !== "dev_signature_valid" && signature !== "test-signature") {
        return { handled: false, error: "Invalid dev webhook signature" };
      }

      return {
        handled: true,
        orderId: payload.orderId,
        sessionId: payload.sessionId,
        status: payload.status ?? "paid",
      };
    } catch (err) {
      return { handled: false, error: "Malformed webhook payload" };
    }
  }
}

export function getPaymentProvider(): PaymentProvider {
  const e = env();
  if (e.PAYMENT_PROVIDER === "stripe" && e.STRIPE_SECRET_KEY) {
    return new StripePaymentProvider(e.STRIPE_SECRET_KEY, e.STRIPE_WEBHOOK_SECRET);
  }
  return new DevPaymentProvider();
}
