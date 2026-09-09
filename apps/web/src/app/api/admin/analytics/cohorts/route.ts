import { NextRequest, NextResponse } from "next/server";
import { getCohortReport } from "@/lib/analytics";
import { env, createLogger } from "@gdp/core";

const log = createLogger("admin:analytics:cohorts");

export async function GET(req: NextRequest) {
  try {
    const e = env();
    const authHeader = req.headers.get("authorization");
    const adminKey = req.headers.get("x-admin-key") || (authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null);

    const expectedSecret = e.VISION_SERVICE_SECRET || "gdp-admin-key";
    if (adminKey !== expectedSecret && process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const report = await getCohortReport();
    return NextResponse.json(report);
  } catch (err: any) {
    log.error("Failed to generate cohort report", { error: String(err) });
    return NextResponse.json({ error: "Failed to generate cohort report", details: String(err) }, { status: 500 });
  }
}
