import { NextRequest, NextResponse } from "next/server";
import { walletService } from "@/lib/wallet-service";

export async function GET(req: NextRequest) {
  const userId = req.headers.get("x-user-id") || req.nextUrl.searchParams.get("userId") || "anon_user";
  const wallet = await walletService.getWallet(userId);
  const transactions = await walletService.getTransactions(userId);

  return NextResponse.json({
    wallet,
    transactions,
  });
}
