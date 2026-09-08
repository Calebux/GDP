import { NextRequest, NextResponse } from "next/server";
import { packService } from "@/lib/pack-service";
import { detectPricingContext } from "@/lib/pricing";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // Body is optional
    }

    const pricingContext = detectPricingContext(req.headers);
    const userId = req.headers.get("x-user-id") || body?.userId || undefined;

    const session = await packService.createCheckout(id, {
      productId: body?.productId || "single",
      pricingContext,
      userId,
    });

    return NextResponse.json(session);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to initiate checkout" }, { status: 400 });
  }
}

