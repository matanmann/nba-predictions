import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runFullSync, recalculateAllScores } from "@/lib/nba-sync";
import { env } from "@/lib/env";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronHeader = req.headers.get("x-vercel-cron");

  if (authHeader !== `Bearer ${env.CRON_SECRET}` && !cronHeader) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const season = await prisma.season.findFirst({ where: { isActive: true } });
  if (!season) {
    return NextResponse.json({ skipped: true, reason: "No active season" });
  }

  const syncResult = await runFullSync(season.year, season.id);
  const recalcCount = await recalculateAllScores(season.id);

  return NextResponse.json({ ...syncResult, recalculated: recalcCount });
}