/**
 * Regression tests for the paywall holes found reviewing the promo-pack flow.
 * Each case is an exploit that worked before the fix; none of them assert
 * implementation detail, only that a pack cannot be unlocked without paying
 * for that pack.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST as createPackRoute } from "@/app/api/packs/route.js";
import { POST as selectConceptRoute } from "@/app/api/packs/[id]/select/route.js";
import { POST as checkoutRoute } from "@/app/api/packs/[id]/checkout/route.js";
import { GET as paymentStatusRoute } from "@/app/api/packs/[id]/payment-status/route.js";
import { GET as downloadRoute } from "@/app/api/packs/[id]/download/route.js";
import { GET as assetsRoute } from "@/app/api/assets/[...key]/route.js";
import { POST as webhookRoute } from "@/app/api/webhooks/payment/route.js";
import { getPaymentProvider, resetPaymentProvider, DEV_WEBHOOK_SIGNATURE } from "@/lib/payment-provider.js";
import { resetEnv } from "@gdp/core";

const brief = {
  promotionType: "restaurant",
  title: "Paywall Regression",
  offer: "2-for-1 Tacos",
  requestedFormats: ["ig-portrait"],
};

const params = (id: string) => ({ params: Promise.resolve({ id }) });

/** A pack with a concept selected — i.e. sitting at the paywall, unpaid. */
async function packAtPaywall(): Promise<string> {
  const res = await createPackRoute(
    new NextRequest("http://localhost:3000/api/packs", {
      method: "POST",
      body: JSON.stringify(brief),
    })
  );
  const { packId, pack } = await res.json();
  await selectConceptRoute(
    new NextRequest(`http://localhost:3000/api/packs/${packId}/select`, {
      method: "POST",
      body: JSON.stringify({ conceptId: pack.concepts[0].id }),
    }),
    params(packId)
  );
  return packId as string;
}

async function checkout(packId: string) {
  const res = await checkoutRoute(
    new NextRequest(`http://localhost:3000/api/packs/${packId}/checkout`, { method: "POST" }),
    params(packId)
  );
  return res.json() as Promise<{ sessionId: string; orderId: string }>;
}

const download = (packId: string) =>
  downloadRoute(new NextRequest(`http://localhost:3000/api/packs/${packId}/download`), params(packId));

const paymentStatus = (packId: string, sessionId: string) =>
  paymentStatusRoute(
    new NextRequest(`http://localhost:3000/api/packs/${packId}/payment-status?session_id=${sessionId}`),
    params(packId)
  );

describe("paywall regressions", () => {
  it("does not accept a forged session id that merely looks like a dev session", async () => {
    const packId = await packAtPaywall();

    const res = await paymentStatus(packId, "dev_sess_forged_by_attacker");
    expect(res.status).toBe(400);

    const dl = await download(packId);
    expect(dl.status).toBe(403);
  });

  it("does not unlock one pack with another pack's paid session", async () => {
    const paidPack = await packAtPaywall();
    const { sessionId } = await checkout(paidPack);
    expect((await paymentStatus(paidPack, sessionId)).status).toBe(200);

    // Same customer, same real session id, a different pack.
    const targetPack = await packAtPaywall();
    await checkout(targetPack);

    const res = await paymentStatus(targetPack, sessionId);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/does not belong/i);

    expect((await download(targetPack)).status).toBe(403);
    expect((await download(paidPack)).status).toBe(200);
  });

  it("serves a paid pack after a second checkout click on the same pack", async () => {
    const packId = await packAtPaywall();

    const first = await checkout(packId);
    const second = await checkout(packId);
    // One pack, one open order — otherwise payment lands on an order the
    // download check does not consult.
    expect(second.orderId).toBe(first.orderId);

    const res = await webhookRoute(
      new NextRequest("http://localhost:3000/api/webhooks/payment", {
        method: "POST",
        headers: { "x-signature": DEV_WEBHOOK_SIGNATURE },
        body: JSON.stringify({ orderId: second.orderId, status: "paid" }),
      })
    );
    expect(res.status).toBe(200);

    const dl = await download(packId);
    expect(dl.status).toBe(200);
    expect(dl.headers.get("Content-Type")).toBe("application/zip");
  });

  it("rejects a webhook whose signature does not verify", async () => {
    const packId = await packAtPaywall();
    const { orderId } = await checkout(packId);

    const res = await webhookRoute(
      new NextRequest("http://localhost:3000/api/webhooks/payment", {
        method: "POST",
        headers: { "x-signature": "test-signature" },
        body: JSON.stringify({ orderId, status: "paid" }),
      })
    );
    expect(res.status).toBe(400);
    expect((await download(packId)).status).toBe(403);
  });

  it("will not serve the protected archive through the public asset route", async () => {
    const packId = await packAtPaywall();
    const { sessionId } = await checkout(packId);
    await paymentStatus(packId, sessionId);
    expect((await download(packId)).status).toBe(200);

    const key = ["protected", "packs", packId, "pack.zip"];
    const direct = await assetsRoute(new NextRequest("http://localhost:3000/api/assets"), {
      params: Promise.resolve({ key }),
    });
    expect(direct.status).toBe(403);

    // "../protected/…" does not start with "protected/", but used to resolve
    // there anyway once the storage driver stripped the "..".
    for (const traversal of [["..", ...key], ["previews", "..", ...key], [".", ...key]]) {
      const res = await assetsRoute(new NextRequest("http://localhost:3000/api/assets"), {
        params: Promise.resolve({ key: traversal }),
      });
      expect([400, 403]).toContain(res.status);
    }
  });

  it("refuses to run the simulated payment provider in production", async () => {
    const original = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = "production";
      delete process.env.STRIPE_SECRET_KEY;
      resetEnv();
      resetPaymentProvider();

      expect(() => getPaymentProvider()).toThrow(/production/i);
    } finally {
      process.env.NODE_ENV = original;
      resetEnv();
      resetPaymentProvider();
    }
  });
});
