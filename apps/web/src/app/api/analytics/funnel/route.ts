import { NextResponse } from "next/server";
import { getFunnelMetrics } from "@/lib/analytics";

export async function GET() {
  try {
    const metrics = await getFunnelMetrics();
    return NextResponse.json({
      metrics,
      formula: "previewToPurchaseConversionRate = (purchases / unique preview viewers) * 100",
      documentation: "Headline conversion metric tracking user progression from watermarked preview to paid unlocked pack.",
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to calculate funnel metrics" }, { status: 500 });
  }
}
