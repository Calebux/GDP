import { NextRequest, NextResponse } from "next/server";
import { detectPricingContext, getProductPlans, formatMoney } from "@/lib/pricing";

export async function GET(req: NextRequest) {
  const context = detectPricingContext(req.headers);
  const plans = getProductPlans(context).map((plan) => ({
    ...plan,
    formattedPrice: formatMoney(plan.price, plan.currency),
  }));

  return NextResponse.json({
    context,
    plans,
  });
}
