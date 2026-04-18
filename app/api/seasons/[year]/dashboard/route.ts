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

  // Calculate series statistics with team names
  const seriesStats = season.series.map(s => {
    const correctPredictions = season.predictions.filter(p =>
      p.seriesPredictions.some(sp => sp.seriesId === s.id && sp.winnerId === s.winnerId && s.winnerId)
    ).length;
    const totalPredictions = season.predictions.filter(p =>
      p.seriesPredictions.some(sp => sp.seriesId === s.id)
    ).length;
    const winPercentage = totalPredictions > 0 ? Math.round((correctPredictions / totalPredictions) * 100) : 0;
    return {
      seriesId: s.id,
      homeTeam: s.homeTeam.abbr,
      awayTeam: s.awayTeam.abbr,
      homeTeamColor: s.homeTeam.color,
      awayTeamColor: s.awayTeam.color,
      winPercentage,
      correctPredictions,
      totalPredictions,
    };
  });

  // Calculate yes/no question accuracy
  const snackStats = snackQuestions.map(q => {
    if (q.result === null) return { questionId: q.id, question: q.question, result: null, accuracy: null, correctCount: 0, totalCount: 0 };
    const predictions = season.predictions.flatMap(p => p.snackAnswers.filter(sa => sa.questionId === q.id));
    const correctCount = predictions.filter(sa => sa.answer === q.result).length;
    const accuracy = predictions.length > 0 ? Math.round((correctCount / predictions.length) * 100) : 0;
    return { questionId: q.id, question: q.question, result: q.result, accuracy, correctCount, totalCount: predictions.length };
  });

  // Calculate general question accuracy
  const generalStats = ((season.generalConfig?.questions as Array<{ key: string; label: string }> | null) ?? []).map(q => {
    const generalPredictions = season.predictions.map(p => (p.generalPrediction?.answers as Record<string, number> | undefined)?.[q.key]).filter(Boolean);
    const results = season.generalConfig?.results as Record<string, number> | null;
    const actualResult = results?.[q.key];
    if (!actualResult) return { key: q.key, label: q.label, result: null, accuracy: null, correctCount: 0, totalCount: 0 };
    const correctCount = generalPredictions.filter(ans => ans === actualResult).length;
    const accuracy = generalPredictions.length > 0 ? Math.round((correctCount / generalPredictions.length) * 100) : 0;
    return { key: q.key, label: q.label, result: actualResult, accuracy, correctCount, totalCount: generalPredictions.length };
  });

  // Calculate MVP prediction accuracy
  const mvpStats = [
    { role: 'eastMvp', label: 'East MVP' },
    { role: 'westMvp', label: 'West MVP' },
    { role: 'finalsMvp', label: 'Finals MVP' },
  ].map(mvp => {
    const predictions = season.predictions.flatMap(p => 
      p.leaderPredictions.filter(lp => {
        const categoryMap: Record<string, string> = { eastMvp: '__mvp_east', westMvp: '__mvp_west', finalsMvp: '__mvp_finals' };
        return lp.category === categoryMap[mvp.role];
      }).map(lp => lp.playerName)
    );
    const actualLeader = season.playoffLeaders.find(l => {
      const categoryMap: Record<string, string> = { '__mvp_east': 'eastMvp', '__mvp_west': 'westMvp', '__mvp_finals': 'finalsMvp' };
      return categoryMap[mvp.role] === l.category;
    })?.playerName;
    
    const correctCount = predictions.filter(p => p === actualLeader).length;
    const accuracy = predictions.length > 0 ? Math.round((correctCount / predictions.length) * 100) : 0;
    return { role: mvp.role, label: mvp.label, leader: actualLeader, accuracy, correctCount, totalCount: predictions.length };
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
    snackStats,
    generalStats,
    mvpStats,
  });
}