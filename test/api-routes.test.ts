import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { POST as createPackRoute } from "@/app/api/packs/route.js";
import { GET as getPackRoute } from "@/app/api/packs/[id]/route.js";
import { POST as selectConceptRoute } from "@/app/api/packs/[id]/select/route.js";
import { POST as checkoutRoute } from "@/app/api/packs/[id]/checkout/route.js";
import { GET as paymentStatusRoute } from "@/app/api/packs/[id]/payment-status/route.js";
import { GET as downloadRoute } from "@/app/api/packs/[id]/download/route.js";
import { POST as webhookRoute } from "@/app/api/webhooks/payment/route.js";

describe("API Route Endpoints", () => {
  const brief = {
    promotionType: "restaurant",
    title: "Taco Tuesday Fiesta",
    brandName: "La Taqueria",
    offer: "2-for-1 Tacos All Evening",
    date: "Every Tuesday",
    time: "5PM - 10PM",
    CTA: "See Menu",
    requestedFormats: ["ig-portrait", "story"],
  };

  it("handles the complete lifecycle through HTTP route handlers", async () => {
    // 1. POST /api/packs
    const reqCreate = new NextRequest("http://localhost:3000/api/packs", {
      method: "POST",
      body: JSON.stringify(brief),
    });
    const resCreate = await createPackRoute(reqCreate);
    expect(resCreate.status).toBe(200);
    const createData = await resCreate.json();
    expect(createData.packId).toBeDefined();
    expect(createData.pack.concepts).toHaveLength(3);

    const packId = createData.packId;
    const conceptId = createData.pack.concepts[0].id;

    // 2. GET /api/packs/:id
    const reqGet = new NextRequest(`http://localhost:3000/api/packs/${packId}`);
    const resGet = await getPackRoute(reqGet, { params: Promise.resolve({ id: packId }) });
    expect(resGet.status).toBe(200);
    const getData = await resGet.json();
    expect(getData.pack.id).toBe(packId);

    // 3. POST /api/packs/:id/select
    const reqSelect = new NextRequest(`http://localhost:3000/api/packs/${packId}/select`, {
      method: "POST",
      body: JSON.stringify({ conceptId, requestedFormats: ["ig-portrait", "story"] }),
    });
    const resSelect = await selectConceptRoute(reqSelect, { params: Promise.resolve({ id: packId }) });
    expect(resSelect.status).toBe(200);

    // 4. GET /api/packs/:id/download before payment -> MUST BE 403 FORBIDDEN
    const reqDownloadUnpaid = new NextRequest(`http://localhost:3000/api/packs/${packId}/download`);
    const resDownloadUnpaid = await downloadRoute(reqDownloadUnpaid, {
      params: Promise.resolve({ id: packId }),
    });
    expect(resDownloadUnpaid.status).toBe(403);

    // 5. POST /api/packs/:id/checkout
    const reqCheckout = new NextRequest(`http://localhost:3000/api/packs/${packId}/checkout`, {
      method: "POST",
    });
    const resCheckout = await checkoutRoute(reqCheckout, {
      params: Promise.resolve({ id: packId }),
    });
    expect(resCheckout.status).toBe(200);
    const checkoutData = await resCheckout.json();
    expect(checkoutData.sessionId).toBeDefined();

    // 6. GET /api/packs/:id/payment-status?session_id=...
    const reqPaymentStatus = new NextRequest(
      `http://localhost:3000/api/packs/${packId}/payment-status?session_id=${checkoutData.sessionId}`
    );
    const resPaymentStatus = await paymentStatusRoute(reqPaymentStatus, {
      params: Promise.resolve({ id: packId }),
    });
    expect(resPaymentStatus.status).toBe(200);
    const paymentData = await resPaymentStatus.json();
    expect(paymentData.paid).toBe(true);

    // 7. GET /api/packs/:id/download after payment -> MUST BE 200 OK (application/zip)
    const reqDownloadPaid = new NextRequest(`http://localhost:3000/api/packs/${packId}/download`);
    const resDownloadPaid = await downloadRoute(reqDownloadPaid, {
      params: Promise.resolve({ id: packId }),
    });
    expect(resDownloadPaid.status).toBe(200);
    expect(resDownloadPaid.headers.get("Content-Type")).toBe("application/zip");
    expect(resDownloadPaid.headers.get("Content-Disposition")).toContain(".zip");

    // 8. POST /api/webhooks/payment idempotency test
    const webhookPayload = JSON.stringify({
      orderId: checkoutData.orderId,
      sessionId: checkoutData.sessionId,
      status: "paid",
    });
    const reqWebhook = new NextRequest("http://localhost:3000/api/webhooks/payment", {
      method: "POST",
      headers: {
        "x-signature": "dev_signature_valid",
      },
      body: webhookPayload,
    });
    const resWebhook = await webhookRoute(reqWebhook);
    expect(resWebhook.status).toBe(200);
    const webhookData = await resWebhook.json();
    expect(webhookData.duplicate).toBe(true);
  });
});
