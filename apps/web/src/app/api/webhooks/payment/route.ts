import { NextRequest, NextResponse } from "next/server";
import { getPaymentProvider } from "@/lib/payment-provider";
import { packRepository } from "@/lib/pack-repository";
import { packagingService } from "@/lib/packaging-service";
import { createLogger } from "@gdp/core";

const log = createLogger("webhook:payment");

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("stripe-signature") || req.headers.get("x-signature") || "";

    const provider = getPaymentProvider();
    const result = await provider.handleWebhook(rawBody, signature);

    if (!result.handled) {
      log.warn("Webhook unhandled or invalid", { error: result.error });
      return NextResponse.json({ error: result.error || "Webhook not handled" }, { status: 400 });
    }

    if (result.orderId && result.status === "paid") {
      const order = await packRepository.getOrder(result.orderId);
      if (order) {
        // Idempotency check: if already paid, return 200 immediately
        if (order.status === "paid") {
          log.info("Order already paid, duplicate webhook skipped", { orderId: order.id });
          return NextResponse.json({ received: true, duplicate: true });
        }

        await packRepository.updateOrder(order.id, { status: "paid" });
        await packRepository.updatePack(order.packId, { status: "paid" });

        // Trigger packaging
        packagingService.packagePack(order.packId).catch((err: any) => {
          log.error("Async packaging failed after webhook", { error: String(err), packId: order.packId });
        });
      }
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    log.error("Webhook processing exception", { error: String(err) });
    return NextResponse.json({ error: "Webhook internal error" }, { status: 500 });
  }
}
