import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recalculateAllScores } from "@/lib/nba-sync";

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { year, snackAnswers, gameWinners } = await req.json();

  const season = await prisma.season.findUnique({ where: { year: +year } });
  if (!season) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Update yes/no answers
  for (const { id, result } of snackAnswers ?? []) {
    await prisma.snackQuestion.update({
      where: { id },
      data: { result },
    });
  }

  // Update game winners count (merge with automated results)
  if (gameWinners !== null && gameWinners !== undefined) {
    const cfg = await prisma.generalConfig.findUnique({
      where: { seasonId: season.id },
    });
    const existing = (cfg?.results ?? {}) as Record<string, number>;
    await prisma.generalConfig.update({
      where: { seasonId: season.id },
      data: { results: { ...existing, gameWinners: +gameWinners } },
    });
  }

  // Recalculate all scores
  const count = await recalculateAllScores(season.id);

  return NextResponse.json({ ok: true, recalculated: count });
}