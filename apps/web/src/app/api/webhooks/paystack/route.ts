import { NextRequest, NextResponse } from "next/server";
import { getPaymentProvider } from "@/lib/payment-provider";
import { packRepository } from "@/lib/pack-repository";
import { packagingService } from "@/lib/packaging-service";
import { walletService } from "@/lib/wallet-service";
import { trackEvent } from "@/lib/analytics";
import { createLogger } from "@gdp/core";

const log = createLogger("webhook:paystack");

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-paystack-signature") || "";

    const provider = getPaymentProvider("NG", "ngn");
    const result = await provider.handleWebhook(rawBody, signature);

    if (!result.handled) {
      log.warn("Paystack webhook signature invalid", { error: result.error });
      return NextResponse.json({ error: result.error || "Invalid webhook signature" }, { status: 400 });
    }

    if (result.eventId) {
      const isNew = await packRepository.recordProcessedWebhook("paystack", result.eventId, result.eventType);
      if (!isNew) {
        log.info("Duplicate Paystack webhook eventId skipped", { eventId: result.eventId });
        return NextResponse.json({ received: true, duplicate: true });
      }
    }

    if (result.orderId && result.status === "paid") {
      const order = await packRepository.getOrder(result.orderId);
      if (order) {
        if (order.status === "paid") {
          return NextResponse.json({ received: true, duplicate: true });
        }

        await packRepository.updateOrder(order.id, { status: "paid" });
        await packRepository.updatePack(order.packId, { status: "paid" });

        const userId = order.userId || "anon_user";
        const creditsToGrant = order.creditsGranted || (order.productId === "bundle-5" ? 5 : 1);

        await walletService.grantCreditsFromOrder({
          userId,
          orderId: order.id,
          credits: creditsToGrant,
        });

        await walletService.consumeCreditForPack({
          userId,
          packId: order.packId,
        });

        packagingService.packagePack(order.packId).catch((err: any) => {
          log.error("Paystack packaging failed", { error: String(err), packId: order.packId });
        });

        await trackEvent({
          type: "payment_succeeded",
          userId,
          packId: order.packId,
          payload: {
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            provider: "paystack",
          },
        });
      }
    }

    return NextResponse.json({ status: "success" });
  } catch (err: any) {
    log.error("Paystack webhook error", { error: String(err) });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
