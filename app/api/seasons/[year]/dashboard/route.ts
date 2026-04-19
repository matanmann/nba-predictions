import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { isLocked, getLockTime } from "@/lib/lock";
import { getPlayoffGames } from "@/lib/nba-api";

function normalizeQuestion(question: string): string {
  return question.trim().toLowerCase();
}

function dedupeSnackQuestions<T extends { question: string }>(questions: T[]): T[] {
  const seen = new Set<string>();
  return questions.filter((q) => {
    const key = normalizeQuestion(q.question);
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
  const snackQuestionIdsByText = new Map<string, number[]>();
  for (const question of season.snackQuestions) {
    const key = normalizeQuestion(question.question);
    snackQuestionIdsByText.set(key, [...(snackQuestionIdsByText.get(key) ?? []), question.id]);
  }
  const snackQuestionLookup = Object.fromEntries(
    season.snackQuestions.map((question) => [String(question.id), question.question])
  );

  const bdlSeason = y - 1;
  let gamesBySeriesKey = new Map<string, { homeWins: number; awayWins: number; totalGames: number }>();
  try {
    const playoffGames = await getPlayoffGames(bdlSeason);
    const completedGames = playoffGames.filter((game) => game.status === "Final");
    for (const game of completedGames) {
      const homeId = String(game.home_team.id);
      const awayId = String(game.visitor_team.id);
      const key = [homeId, awayId].sort().join("__");
      const current = gamesBySeriesKey.get(key) ?? { homeWins: 0, awayWins: 0, totalGames: 0 };
      const homeWon = game.home_team_score > game.visitor_team_score;
      gamesBySeriesKey.set(key, {
        homeWins: current.homeWins + (homeWon ? 1 : 0),
        awayWins: current.awayWins + (!homeWon ? 1 : 0),
        totalGames: current.totalGames + 1,
      });
    }
  } catch {
    // If API fetch fails, we still return dashboard data without live series status.
    gamesBySeriesKey = new Map();
  }

  // Calculate series statistics with team names
  const seriesStats = season.series.map(s => {
    const homePickCount = season.predictions.filter((prediction) =>
      prediction.seriesPredictions.some((sp) => sp.seriesId === s.id && sp.winnerId === s.homeTeamId)
    ).length;
    const awayPickCount = season.predictions.filter((prediction) =>
      prediction.seriesPredictions.some((sp) => sp.seriesId === s.id && sp.winnerId === s.awayTeamId)
    ).length;

    const correctPredictions = season.predictions.filter(p =>
      p.seriesPredictions.some(sp => sp.seriesId === s.id && sp.winnerId === s.winnerId && s.winnerId)
    ).length;
    const totalPredictions = season.predictions.filter(p =>
      p.seriesPredictions.some(sp => sp.seriesId === s.id)
    ).length;

    const majorityTeam = homePickCount >= awayPickCount ? s.homeTeam : s.awayTeam;
    const majorityPickCount = Math.max(homePickCount, awayPickCount);
    const majorityPickPercentage = totalPredictions > 0 ? Math.round((majorityPickCount / totalPredictions) * 100) : 0;

    const seriesKey = [s.homeTeamId, s.awayTeamId].sort().join("__");
    const progress = gamesBySeriesKey.get(seriesKey);
    const homeWins = progress?.homeWins ?? 0;
    const awayWins = progress?.awayWins ?? 0;

    let statusText = "Not started";
    if (s.isComplete && s.winnerId) {
      const winnerTeam = s.winnerId === s.homeTeamId ? s.homeTeam : s.awayTeam;
      statusText = `${winnerTeam.abbr} won ${s.gameCount ?? `${homeWins + awayWins}`}-game series`;
    } else if (homeWins > 0 || awayWins > 0) {
      const leader = homeWins === awayWins ? null : (homeWins > awayWins ? s.homeTeam : s.awayTeam);
      statusText = leader
        ? `${leader.abbr} lead ${Math.max(homeWins, awayWins)}-${Math.min(homeWins, awayWins)}`
        : `Tied ${homeWins}-${awayWins}`;
    }

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
      homePickCount,
      awayPickCount,
      majorityTeamAbbr: majorityTeam.abbr,
      majorityPickPercentage,
      statusText,
      homeWins,
      awayWins,
      leadingScorer: s.leadingScorer,
    };
  });

  // Calculate yes/no question accuracy
  const snackStats = snackQuestions.map(q => {
    const relatedQuestionIds = new Set(snackQuestionIdsByText.get(normalizeQuestion(q.question)) ?? [q.id]);

    // For duplicated DB rows of the same question text, count at most one answer per user.
    const effectiveAnswers = season.predictions
      .map((prediction) => {
        const candidates = prediction.snackAnswers
          .filter((answer) => relatedQuestionIds.has(answer.questionId))
          .sort((a, b) => b.id - a.id);
        return candidates[0] ?? null;
      })
      .filter((answer): answer is NonNullable<typeof answer> => Boolean(answer));

    const yesCount = effectiveAnswers.filter((answer) => answer.answer).length;
    const noCount = effectiveAnswers.length - yesCount;
    const totalParticipants = season.predictions.length;
    const missingCount = Math.max(totalParticipants - effectiveAnswers.length, 0);

    if (q.result === null) {
      return {
        questionId: q.id,
        question: q.question,
        result: null,
        accuracy: null,
        correctCount: 0,
        totalCount: effectiveAnswers.length,
        yesCount,
        noCount,
        missingCount,
        totalParticipants,
      };
    }

    const correctCount = effectiveAnswers.filter((answer) => answer.answer === q.result).length;
    const accuracy = effectiveAnswers.length > 0
      ? Math.round((correctCount / effectiveAnswers.length) * 100)
      : 0;
    return {
      questionId: q.id,
      question: q.question,
      result: q.result,
      accuracy,
      correctCount,
      totalCount: effectiveAnswers.length,
      yesCount,
      noCount,
      missingCount,
      totalParticipants,
    };
  });

  // Calculate general question accuracy
  const generalStats = ((season.generalConfig?.questions as Array<{ key: string; label: string }> | null) ?? []).map(q => {
    const generalPredictions = season.predictions
      .map(p => (p.generalPrediction?.answers as Record<string, number> | undefined)?.[q.key])
      .filter((answer): answer is number => answer !== null && answer !== undefined);

    const distributionMap = new Map<number, number>();
    for (const answer of generalPredictions) {
      distributionMap.set(answer, (distributionMap.get(answer) ?? 0) + 1);
    }

    const distribution = Array.from(distributionMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([value, count]) => ({ value, count }));

    const results = season.generalConfig?.results as Record<string, number> | null;
    const actualResult = results?.[q.key];
    const totalParticipants = season.predictions.length;
    const missingCount = Math.max(totalParticipants - generalPredictions.length, 0);

    if (actualResult === null || actualResult === undefined) {
      return {
        key: q.key,
        label: q.label,
        result: null,
        accuracy: null,
        correctCount: 0,
        totalCount: generalPredictions.length,
        distribution,
        missingCount,
        totalParticipants,
      };
    }

    const correctCount = generalPredictions.filter(ans => ans === actualResult).length;
    const accuracy = generalPredictions.length > 0 ? Math.round((correctCount / generalPredictions.length) * 100) : 0;
    return {
      key: q.key,
      label: q.label,
      result: actualResult,
      accuracy,
      correctCount,
      totalCount: generalPredictions.length,
      distribution,
      missingCount,
      totalParticipants,
    };
  });

  // Calculate MVP prediction accuracy
  const mvpStats = [
    { role: 'eastMvp', label: 'East MVP' },
    { role: 'westMvp', label: 'West MVP' },
    { role: 'finalsMvp', label: 'Finals MVP' },
  ].map(mvp => {
    const roleToCategory: Record<string, string> = {
      eastMvp: '__mvp_east',
      westMvp: '__mvp_west',
      finalsMvp: '__mvp_finals',
    };
    const predictions = season.predictions.flatMap(p => 
      p.leaderPredictions.filter(lp => {
        return lp.category === roleToCategory[mvp.role];
      }).map(lp => lp.playerName)
    );

    const distributionMap = new Map<string, number>();
    for (const playerName of predictions) {
      distributionMap.set(playerName, (distributionMap.get(playerName) ?? 0) + 1);
    }
    const distribution = Array.from(distributionMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([playerName, count]) => ({ playerName, count }));

    const actualLeader = season.playoffLeaders.find(l => {
      return l.category === roleToCategory[mvp.role];
    })?.playerName;
    const totalParticipants = season.predictions.length;
    const missingCount = Math.max(totalParticipants - predictions.length, 0);

    const correctCount = actualLeader
      ? predictions.filter(p => p === actualLeader).length
      : 0;
    const accuracy = actualLeader && predictions.length > 0
      ? Math.round((correctCount / predictions.length) * 100)
      : null;
    return {
      role: mvp.role,
      label: mvp.label,
      leader: actualLeader,
      accuracy,
      correctCount,
      totalCount: predictions.length,
      totalParticipants,
      missingCount,
      distribution,
    };
  });

  return NextResponse.json({
    season: { year: season.year, lockedAt: season.lockedAt },
    series: season.series,
    playoffLeaders: season.playoffLeaders,
    generalConfig: season.generalConfig,
    snackQuestions,
    snackQuestionLookup,
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