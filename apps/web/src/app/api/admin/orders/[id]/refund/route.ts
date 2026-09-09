import { NextRequest, NextResponse } from "next/server";
import { packRepository } from "@/lib/pack-repository";
import { walletService } from "@/lib/wallet-service";
import { trackEvent } from "@/lib/analytics";
import { env, createLogger } from "@gdp/core";

const log = createLogger("admin:orders:refund");

interface RefundBody {
  reason: "packaging_failure" | "duplicate_billing" | "rendering_error" | "customer_service";
  comment?: string;
  remedy?: "refund_to_card" | "credit_wallet";
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: orderId } = await params;
    const e = env();

    // Admin authentication
    const authHeader = req.headers.get("authorization");
    const adminKey =
      req.headers.get("x-admin-key") ||
      (authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null);

    const expectedSecret = e.VISION_SERVICE_SECRET || "gdp-admin-key";
    if (adminKey !== expectedSecret && process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const order = await packRepository.getOrder(orderId);
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (order.status === "refunded") {
      return NextResponse.json(
        { error: "Order has already been refunded", refundedAt: (order as any).refundedAt },
        { status: 400 },
      );
    }

    const body: RefundBody = await req.json();
    const reason = body.reason || "customer_service";
    const remedy = body.remedy || "refund_to_card";
    const now = new Date().toISOString();

    if (remedy === "credit_wallet" && order.userId) {
      // Grant 2 replacement credits for inconvenience
      await walletService.grantCreditsFromOrder({
        userId: order.userId,
        orderId: `comp_${order.id}`,
        credits: 2,
      });
      log.info("Granted replacement credits for order", { orderId, userId: order.userId });
    }

    // Update order status
    await packRepository.updateOrder(order.id, {
      status: "refunded",
      refundReason: `${reason}: ${body.comment || "Admin initiated refund"}`,
      refundedAt: now,
    } as any);

    // Track analytics event
    await trackEvent({
      type: "order_refunded",
      userId: order.userId,
      packId: order.packId,
      payload: {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        provider: order.provider,
        reason,
        remedy,
        autoRefundsEnabled: e.ENABLE_AUTO_REFUNDS,
      },
    });

    return NextResponse.json({
      success: true,
      orderId: order.id,
      status: "refunded",
      reason,
      remedy,
      refundedAt: now,
      autoRefundedOnGateway: e.ENABLE_AUTO_REFUNDS,
    });
  } catch (err: any) {
    log.error("Refund execution failed", { error: String(err) });
    return NextResponse.json(
      { error: "Refund execution failed", details: String(err) },
      { status: 500 },
    );
  }
}
