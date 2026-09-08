import { createLogger, newId } from "@gdp/core";
import type { FunnelMetrics } from "@gdp/core";
import { db, dbAvailable, events } from "@gdp/db";

const log = createLogger("analytics");

export interface TrackEventParams {
  type: string;
  userId?: string;
  sessionId?: string;
  packId?: string;
  conceptId?: string;
  payload?: Record<string, any>;
}

export interface StoredEvent {
  id: string;
  type: string;
  userId?: string;
  sessionId?: string;
  packId?: string;
  payload: Record<string, any>;
  createdAt: string;
}

// In-memory fallback for D-16 local-first degradation
const memoryEvents: StoredEvent[] = [];

/**
 * Tracks a behavioural or commerce event.
 * Core events:
 * - brief_started, brief_completed
 * - pack_generation_started, pack_generation_completed
 * - preview_viewed, concept_selected
 * - checkout_started, checkout_completed, checkout_failed
 * - payment_started, payment_succeeded, payment_failed
 * - pack_downloaded
 * - share_created, share_viewed, share_cta_clicked
 * - detail_fixer_opened, edit_submitted, edit_confirmed, edit_completed, edit_failed
 * - credit_purchase, credit_consumed, credit_refunded
 * - referral_creation_started, referral_purchase
 */
export async function trackEvent(params: TrackEventParams): Promise<void> {
  const eventId = newId("evt");
  const now = new Date();

  const stored: StoredEvent = {
    id: eventId,
    type: params.type,
    userId: params.userId,
    sessionId: params.sessionId,
    packId: params.packId,
    payload: {
      ...params.payload,
      conceptId: params.conceptId,
    },
    createdAt: now.toISOString(),
  };

  memoryEvents.push(stored);
  log.info(`[Analytics] ${params.type}`, {
    eventId,
    packId: params.packId,
    userId: params.userId,
    sessionId: params.sessionId,
  });

  if (await dbAvailable()) {
    try {
      const database = db();
      await database.insert(events).values({
        id: eventId,
        type: params.type,
        userId: params.userId ?? null,
        packId: params.packId ?? null,
        sessionId: params.sessionId ?? null,
        payload: stored.payload,
        createdAt: now,
      });
    } catch (err) {
      log.warn("Failed saving analytics event to PostgreSQL", { error: String(err) });
    }
  }
}

/**
 * Computes end-to-end funnel metrics.
 * Primary Headline Metric: preview → purchase conversion rate = (purchases / unique preview viewers) * 100
 */
export async function getFunnelMetrics(): Promise<FunnelMetrics> {
  let allEvents = memoryEvents;

  if (await dbAvailable()) {
    try {
      const database = db();
      const rows = await database.select().from(events);
      if (rows.length > 0) {
        allEvents = rows.map((r) => ({
          id: r.id,
          type: r.type,
          userId: r.userId ?? undefined,
          sessionId: r.sessionId ?? undefined,
          packId: r.packId ?? undefined,
          payload: (r.payload as Record<string, any>) || {},
          createdAt: r.createdAt.toISOString(),
        }));
      }
    } catch (err) {
      log.warn("Failed to fetch analytics from DB, falling back to memory", { error: String(err) });
    }
  }

  const previewSessions = new Set<string>();
  const checkoutSessions = new Set<string>();
  const purchaseSessions = new Set<string>();

  let singlePurchases = 0;
  let bundlePurchases = 0;
  let creditsPurchased = 0;
  let creditsConsumed = 0;
  let sharesCreated = 0;
  let shareViews = 0;
  let referralPurchases = 0;

  for (const ev of allEvents) {
    const sessionKey = ev.sessionId || ev.userId || ev.packId || ev.id;

    switch (ev.type) {
      case "preview_viewed":
        previewSessions.add(sessionKey);
        break;
      case "checkout_started":
        checkoutSessions.add(sessionKey);
        break;
      case "payment_succeeded":
      case "checkout_completed":
        purchaseSessions.add(sessionKey);
        if (ev.payload?.productId === "bundle-5") {
          bundlePurchases++;
        } else {
          singlePurchases++;
        }
        break;
      case "credit_purchase":
        creditsPurchased += Number(ev.payload?.credits || 0);
        break;
      case "credit_consumed":
        creditsConsumed += Number(ev.payload?.credits || 1);
        break;
      case "share_created":
        sharesCreated++;
        break;
      case "share_viewed":
        shareViews++;
        break;
      case "referral_purchase":
        referralPurchases++;
        break;
    }
  }

  const previewCount = previewSessions.size;
  const purchaseCount = purchaseSessions.size;
  const conversionRate = previewCount > 0 ? (purchaseCount / previewCount) * 100 : 0;

  return {
    previewViews: previewCount,
    checkoutStarts: checkoutSessions.size,
    purchases: purchaseCount,
    previewToPurchaseConversionRate: Math.round(conversionRate * 10) / 10,
    singlePurchases,
    bundlePurchases,
    creditsPurchased,
    creditsConsumed,
    sharesCreated,
    shareViews,
    referralPurchases,
  };
}
