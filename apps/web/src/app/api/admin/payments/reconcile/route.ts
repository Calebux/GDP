import { NextRequest, NextResponse } from "next/server";
import { packRepository } from "@/lib/pack-repository";
import { getPaymentProvider } from "@/lib/payment-provider";
import { walletService } from "@/lib/wallet-service";
import { packagingService } from "@/lib/packaging-service";
import { trackEvent } from "@/lib/analytics";
import { createLogger, env } from "@gdp/core";
import type { PackOrder } from "@gdp/core";

const log = createLogger("admin:payments:reconcile");

export interface ReconciliationReport {
  timestamp: string;
  totalOrders: number;
  totalRevenue: Record<string, number>;
  statusCounts: {
    paid: number;
    pending: number;
    failed: number;
    refunded: number;
  };
  discrepancies: Array<{
    orderId: string;
    packId: string;
    provider: string;
    localStatus: string;
    providerStatus: string;
    amount: number;
    currency: string;
    actionTaken: "healed_to_paid" | "flagged_manual_review" | "none";
  }>;
  summary: {
    matched: number;
    healed: number;
    unresolved: number;
  };
}

export async function POST(req: NextRequest) {
  try {
    const e = env();
    const authHeader = req.headers.get("authorization");
    const adminKey = req.headers.get("x-admin-key") || (authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null);

    // Basic admin authentication
    const expectedSecret = e.VISION_SERVICE_SECRET || "gdp-admin-key";
    if (adminKey !== expectedSecret && process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const autoHeal = searchParams.get("autoHeal") === "true";

    const orders: PackOrder[] = await packRepository.getAllOrders();

    const report: ReconciliationReport = {
      timestamp: new Date().toISOString(),
      totalOrders: orders.length,
      totalRevenue: {},
      statusCounts: {
        paid: 0,
        pending: 0,
        failed: 0,
        refunded: 0,
      },
      discrepancies: [],
      summary: {
        matched: 0,
        healed: 0,
        unresolved: 0,
      },
    };

    for (const order of orders) {
      // Tally statuses
      const s = order.status;
      if (s === "paid") report.statusCounts.paid++;
      else if (s === "pending") report.statusCounts.pending++;
      else if (s === "failed") report.statusCounts.failed++;
      else if (s === "refunded") report.statusCounts.refunded++;

      if (order.status === "paid") {
        const curr = order.currency.toUpperCase();
        report.totalRevenue[curr] = (report.totalRevenue[curr] || 0) + order.amount;
      }

      // If pending, reconcile with provider
      if (order.status === "pending") {
        const sessionId = order.providerSessionId || order.id;
        const provider = getPaymentProvider(undefined, order.currency);

        try {
          const verification = await provider.verifyPayment(sessionId);

          if (verification.paid) {
            let action: "healed_to_paid" | "flagged_manual_review" | "none" = "none";

            if (autoHeal) {
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

              packagingService.packagePack(order.packId).catch((err) => {
                log.error("Reconcile packaging error", { error: String(err), packId: order.packId });
              });

              await trackEvent({
                type: "payment_succeeded",
                userId,
                packId: order.packId,
                payload: {
                  orderId: order.id,
                  amount: order.amount,
                  currency: order.currency,
                  reconciled: true,
                },
              });

              action = "healed_to_paid";
              report.summary.healed++;
            } else {
              action = "flagged_manual_review";
              report.summary.unresolved++;
            }

            report.discrepancies.push({
              orderId: order.id,
              packId: order.packId,
              provider: order.provider,
              localStatus: "pending",
              providerStatus: "paid",
              amount: order.amount,
              currency: order.currency,
              actionTaken: action,
            });
          } else {
            report.summary.matched++;
          }
        } catch (verifErr) {
          log.warn("Reconciliation verifyPayment error", { orderId: order.id, error: String(verifErr) });
          report.discrepancies.push({
            orderId: order.id,
            packId: order.packId,
            provider: order.provider,
            localStatus: "pending",
            providerStatus: "verification_error",
            amount: order.amount,
            currency: order.currency,
            actionTaken: "flagged_manual_review",
          });
          report.summary.unresolved++;
        }
      } else {
        report.summary.matched++;
      }
    }

    return NextResponse.json(report);
  } catch (err: any) {
    log.error("Reconciliation error", { error: String(err) });
    return NextResponse.json({ error: "Reconciliation failed", details: String(err) }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
