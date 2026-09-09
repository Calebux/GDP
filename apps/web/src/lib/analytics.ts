import { createLogger, newId } from "@gdp/core";
import type { FunnelMetrics } from "@gdp/core";
import { db, dbAvailable, events, analyticsEvents } from "@gdp/db";

const log = createLogger("analytics");

export interface TrackEventParams {
  type: string;
  userId?: string;
  sessionId?: string;
  packId?: string;
  conceptId?: string;
  referralToken?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  payload?: Record<string, any>;
}

export interface StoredEvent {
  id: string;
  type: string;
  userId?: string;
  sessionId?: string;
  packId?: string;
  referralToken?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
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
    referralToken: params.referralToken,
    utmSource: params.utmSource,
    utmMedium: params.utmMedium,
    utmCampaign: params.utmCampaign,
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
    referralToken: params.referralToken,
    utmSource: params.utmSource,
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

      await database.insert(analyticsEvents).values({
        id: eventId,
        eventName: params.type,
        userId: params.userId ?? null,
        packId: params.packId ?? null,
        sessionId: params.sessionId ?? null,
        conceptId: params.conceptId ?? null,
        shareToken: params.referralToken ?? null,
        cohortId: null,
        referralSource: params.utmSource ?? null,
        metadata: {
          utmMedium: params.utmMedium,
          utmCampaign: params.utmCampaign,
          payload: stored.payload,
        },
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

// ------------------------------------------------------------- D-05 Distribution Loop & Cohorts

export interface CohortMetrics {
  cohortWeek: string;
  newUsersCount: number;
  packsCreated: number;
  purchasesCount: number;
  conversionRate: number; // preview to purchase %
  sharesCreated: number;
  referralPurchases: number;
  kFactor: number; // referralPurchases / purchasesCount
  viralCycleHoursAvg: number;
  byChannel: Record<string, { users: number; purchases: number }>;
}

export interface DistributionReport {
  timestamp: string;
  totalUsers: number;
  totalPurchases: number;
  totalShares: number;
  totalShareViews: number;
  totalReferralPurchases: number;
  globalKFactor: number;
  cohorts: CohortMetrics[];
}

export async function getCohortReport(): Promise<DistributionReport> {
  let allEvents = memoryEvents;

  if (await dbAvailable()) {
    try {
      const database = db();
      const rows = await database.select().from(analyticsEvents);
      if (rows.length > 0) {
        allEvents = rows.map((r) => {
          const meta = (r.metadata as Record<string, any>) || {};
          return {
            id: r.id,
            type: r.eventName,
            userId: r.userId ?? undefined,
            sessionId: r.sessionId ?? undefined,
            packId: r.packId ?? undefined,
            referralToken: r.shareToken ?? undefined,
            utmSource: r.referralSource ?? undefined,
            utmMedium: (meta.utmMedium as string) ?? undefined,
            utmCampaign: (meta.utmCampaign as string) ?? undefined,
            payload: (meta.payload as Record<string, any>) || {},
            createdAt: r.createdAt.toISOString(),
          };
        });
      }
    } catch (err) {
      log.warn("Failed to fetch analyticsEvents from DB, falling back to memory", { error: String(err) });
    }
  }

  // Find user first-seen time and attribution channel
  const userFirstSeen = new Map<string, { date: Date; channel: string }>();
  const shareTimestamps = new Map<string, number>(); // token -> timestamp
  const viralCycles: number[] = [];

  for (const ev of allEvents) {
    const uid = ev.userId || ev.sessionId;
    const evDate = new Date(ev.createdAt);
    const channel = ev.utmSource || (ev.referralToken ? "referral" : "direct");

    if (uid && !userFirstSeen.has(uid)) {
      userFirstSeen.set(uid, { date: evDate, channel });
    }

    if (ev.type === "share_created" && ev.payload?.token) {
      shareTimestamps.set(ev.payload.token, evDate.getTime());
    }

    if (ev.type === "referral_purchase" && ev.referralToken) {
      const shareTime = shareTimestamps.get(ev.referralToken);
      if (shareTime) {
        const diffHours = (evDate.getTime() - shareTime) / (1000 * 60 * 60);
        if (diffHours >= 0 && diffHours < 720) {
          // within 30 days
          viralCycles.push(diffHours);
        }
      }
    }
  }

  // Helper to format ISO week string: YYYY-Www
  function getWeekKey(d: Date): string {
    const target = new Date(d.valueOf());
    const dayNr = (d.getDay() + 6) % 7;
    target.setDate(target.getDate() - dayNr + 3);
    const firstThursday = target.valueOf();
    target.setMonth(0, 1);
    if (target.getDay() !== 4) {
      target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
    }
    const weekNum = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
    return `${target.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
  }

  // Group by cohort week
  const cohortMap = new Map<
    string,
    {
      users: Set<string>;
      packs: Set<string>;
      purchases: number;
      previews: number;
      shares: number;
      referrals: number;
      channels: Record<string, { users: number; purchases: number }>;
    }
  >();

  for (const ev of allEvents) {
    const uid = ev.userId || ev.sessionId || "anon";
    const userMeta = userFirstSeen.get(uid) || { date: new Date(ev.createdAt), channel: "direct" };
    const weekKey = getWeekKey(userMeta.date);

    if (!cohortMap.has(weekKey)) {
      cohortMap.set(weekKey, {
        users: new Set(),
        packs: new Set(),
        purchases: 0,
        previews: 0,
        shares: 0,
        referrals: 0,
        channels: {},
      });
    }

    const c = cohortMap.get(weekKey)!;
    c.users.add(uid);

    const ch = userMeta.channel;
    if (!c.channels[ch]) {
      c.channels[ch] = { users: 0, purchases: 0 };
    }

    if (ev.packId) c.packs.add(ev.packId);

    if (ev.type === "preview_viewed") {
      c.previews++;
    } else if (ev.type === "payment_succeeded" || ev.type === "checkout_completed") {
      c.purchases++;
      c.channels[ch].purchases++;
    } else if (ev.type === "share_created") {
      c.shares++;
    } else if (ev.type === "referral_purchase") {
      c.referrals++;
    }
  }

  // Count channel users
  for (const [uid, meta] of userFirstSeen.entries()) {
    const weekKey = getWeekKey(meta.date);
    const c = cohortMap.get(weekKey);
    if (c) {
      if (!c.channels[meta.channel]) {
        c.channels[meta.channel] = { users: 0, purchases: 0 };
      }
      c.channels[meta.channel]!.users++;
    }
  }

  const cohorts: CohortMetrics[] = [];
  let globalPurchases = 0;
  let globalShares = 0;
  let globalReferrals = 0;
  let globalUsers = userFirstSeen.size;

  const sortedWeeks = Array.from(cohortMap.keys()).sort();
  for (const wk of sortedWeeks) {
    const c = cohortMap.get(wk)!;
    const usersCount = c.users.size;
    const conversionRate = usersCount > 0 ? (c.purchases / usersCount) * 100 : 0;
    // K-Factor: viral referral purchases / initial direct purchases
    const kFactor = c.purchases > 0 ? c.referrals / c.purchases : 0;

    cohorts.push({
      cohortWeek: wk,
      newUsersCount: usersCount,
      packsCreated: c.packs.size,
      purchasesCount: c.purchases,
      conversionRate: Math.round(conversionRate * 10) / 10,
      sharesCreated: c.shares,
      referralPurchases: c.referrals,
      kFactor: Math.round(kFactor * 100) / 100,
      viralCycleHoursAvg: viralCycles.length > 0 ? Math.round(viralCycles.reduce((a, b) => a + b, 0) / viralCycles.length) : 0,
      byChannel: c.channels,
    });

    globalPurchases += c.purchases;
    globalShares += c.shares;
    globalReferrals += c.referrals;
  }

  const globalK = globalPurchases > 0 ? globalReferrals / globalPurchases : 0;

  return {
    timestamp: new Date().toISOString(),
    totalUsers: globalUsers,
    totalPurchases: globalPurchases,
    totalShares: globalShares,
    totalShareViews: allEvents.filter((e) => e.type === "share_viewed").length,
    totalReferralPurchases: globalReferrals,
    globalKFactor: Math.round(globalK * 100) / 100,
    cohorts,
  };
}

export function clearAnalyticsMemory(): void {
  memoryEvents.length = 0;
}

