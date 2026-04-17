import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { isLocked, getLockTime } from "@/lib/lock";

function dedupeSnackQuestions<T extends { question: string }>(questions: T[]): T[] {
  const seen = new Set<string>();
  return questions.filter((q) => {
    const key = q.question.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ year: string }> }
) {
  const { userId, error } = await requireAuth();
  if (error) return error;

  const { year } = await params;
  const y = +year;

  if (!isLocked(y)) {
    return NextResponse.json({ locked: false, locksAt: getLockTime(y) });
  }

  const season = await prisma.season.findUnique({
    where: { year: y },
    include: {
      series: { include: { homeTeam: true, awayTeam: true } },
      playoffLeaders: true,
      generalConfig: true,
      snackQuestions: { orderBy: { order: "asc" } },
      predictions: {
        include: {
          seriesPredictions: true,
          leaderPredictions: true,
          generalPrediction: true,
          snackAnswers: true,
        },
      },
    },
  });
  if (!season) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const snackQuestions = dedupeSnackQuestions(season.snackQuestions);

  return NextResponse.json({
    season: { year: season.year, lockedAt: season.lockedAt },
    series: season.series,
    playoffLeaders: season.playoffLeaders,
    generalConfig: season.generalConfig,
    snackQuestions,
    predictions: season.predictions,
  });
}