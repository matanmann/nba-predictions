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
          user: { select: { name: true } },
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

  // Calculate series statistics
  const seriesStats = season.series.map(s => {
    const correctPredictions = season.predictions.filter(p =>
      p.seriesPredictions.some(sp => sp.seriesId === s.id && sp.winnerId === s.winnerId && s.winnerId)
    ).length;
    const totalPredictions = season.predictions.filter(p =>
      p.seriesPredictions.some(sp => sp.seriesId === s.id)
    ).length;
    const winPercentage = totalPredictions > 0 ? Math.round((correctPredictions / totalPredictions) * 100) : 0;
    return { seriesId: s.id, winPercentage, correctPredictions, totalPredictions };
  });

  return NextResponse.json({
    season: { year: season.year, lockedAt: season.lockedAt },
    series: season.series,
    playoffLeaders: season.playoffLeaders,
    generalConfig: season.generalConfig,
    snackQuestions,
    predictions: season.predictions.map(p => ({
      ...p,
      userName: p.user?.name || 'Unknown',
    })),
    seriesStats,
  });
}