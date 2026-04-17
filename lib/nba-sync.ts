import { prisma } from "./prisma";
import {
  getPlayoffGames,
  getPlayoffStats,
  getPlayoffStandings,
  getTodayGames,
  type BDLGame,
  type BDLStat,
} from "./nba-api";
import {
  scoreSeriesPrediction,
  scoreLeader,
  scoreGeneral,
} from "./scoring";

const FUTURE_SERIES_BLUEPRINTS = [
  { idSuffix: "E_R2A", round: 2, conference: "E", label: "E_R2A", placeholderSeed: 0, placeholderConference: "east" },
  { idSuffix: "E_R2B", round: 2, conference: "E", label: "E_R2B", placeholderSeed: 1, placeholderConference: "east" },
  { idSuffix: "ECF", round: 3, conference: "E", label: "ECF", placeholderSeed: 0, placeholderConference: "east" },
  { idSuffix: "W_R2A", round: 2, conference: "W", label: "W_R2A", placeholderSeed: 0, placeholderConference: "west" },
  { idSuffix: "W_R2B", round: 2, conference: "W", label: "W_R2B", placeholderSeed: 1, placeholderConference: "west" },
  { idSuffix: "WCF", round: 3, conference: "W", label: "WCF", placeholderSeed: 0, placeholderConference: "west" },
  { idSuffix: "Finals", round: 4, conference: "Finals", label: "Finals", placeholderSeed: 0, placeholderConference: "east" },
] as const;

// ─── 1. Initialize bracket from standings ─────────────────────────────

export async function initSeasonFromAPI(year: number) {
  // BallDontLie uses the season's starting year (2024 for the 2024-25 season)
  const standings = await getPlayoffStandings(year - 1);

  const east = standings
    .filter((s) => s.conference.toLowerCase() === "east")
    .sort((a, b) => a.conference_rank - b.conference_rank)
    .slice(0, 8);

  const west = standings
    .filter((s) => s.conference.toLowerCase() === "west")
    .sort((a, b) => a.conference_rank - b.conference_rank)
    .slice(0, 8);

  const season = await prisma.season.findUnique({ where: { year } });
  if (!season) throw new Error(`Season ${year} not found in DB`);

  // Upsert all 16 teams
  for (const s of [...east, ...west]) {
    await prisma.team.upsert({
      where: { id: String(s.team.id) },
      update: {
        seed: s.conference_rank,
        name: s.team.full_name,
        abbr: s.team.abbreviation,
      },
      create: {
        id: String(s.team.id),
        name: s.team.full_name,
        abbr: s.team.abbreviation,
        conference: s.conference.charAt(0).toUpperCase(),
        seed: s.conference_rank,
        color: TEAM_COLORS[s.team.abbreviation] ?? "#888888",
        seasonId: season.id,
      },
    });
  }

  // Build Round 1: 1v8, 2v7, 3v6, 4v5
  const pairings = [
    [0, 7],
    [1, 6],
    [2, 5],
    [3, 4],
  ];
  const confs = [
    { teams: east, prefix: "E" },
    { teams: west, prefix: "W" },
  ];

  for (const { teams, prefix } of confs) {
    for (let i = 0; i < pairings.length; i++) {
      const [hi, ai] = pairings[i];
      const home = teams[hi];
      const away = teams[ai];
      const seriesId = `${year}-${prefix}${i + 1}`;

      await prisma.series.upsert({
        where: { id: seriesId },
        update: {},
        create: {
          id: seriesId,
          seasonId: season.id,
          round: 1,
          conference: prefix,
          label: `${prefix}${i + 1}`,
          homeTeamId: String(home.team.id),
          awayTeamId: String(away.team.id),
        },
      });
    }
  }

  for (const blueprint of FUTURE_SERIES_BLUEPRINTS) {
    const placeholderPool = blueprint.placeholderConference === "east" ? east : west;
    const placeholderTeam = placeholderPool[blueprint.placeholderSeed];

    await prisma.series.upsert({
      where: { id: `${year}-${blueprint.idSuffix}` },
      update: {},
      create: {
        id: `${year}-${blueprint.idSuffix}`,
        seasonId: season.id,
        round: blueprint.round,
        conference: blueprint.conference,
        label: blueprint.label,
        homeTeamId: String(placeholderTeam.team.id),
        awayTeamId: String(placeholderTeam.team.id),
      },
    });
  }

  console.log(`[init] Season ${year} bracket built: 16 teams, 15 series`);
  return { teams: east.length + west.length, series: 15 };
}

// ─── 2. Main sync (every 5 min via cron) ─────────────────────────────

export async function runFullSync(year: number, seasonId: number) {
  console.log(`[sync] Starting sync for ${year}...`);

  const bdlSeason = year - 1; // BDL uses starting year
  const [games, stats] = await Promise.all([
    getPlayoffGames(bdlSeason),
    getPlayoffStats(bdlSeason),
  ]);

  const completedGames = games.filter((g) => g.status === "Final");
  const seriesMap = groupGamesIntoSeries(completedGames);

  let seriesUpdated = 0;

  for (const [key, seriesGames] of seriesMap.entries()) {
    const result = resolveSeriesWinner(seriesGames);
    if (!result) continue; // series not over yet

    const [abbr1, abbr2] = key.split("__");
    const [team1, team2] = await Promise.all([
      prisma.team.findFirst({ where: { abbr: abbr1, seasonId } }),
      prisma.team.findFirst({ where: { abbr: abbr2, seasonId } }),
    ]);
    if (!team1 || !team2) continue;

    const dbSeries = await prisma.series.findFirst({
      where: {
        seasonId,
        OR: [
          { homeTeamId: team1.id, awayTeamId: team2.id },
          { homeTeamId: team2.id, awayTeamId: team1.id },
        ],
      },
    });
    if (!dbSeries || dbSeries.isComplete) continue;

    // Leading scorer for this specific series
    const seriesGameIds = seriesGames.map((g) => g.id);
    const seriesStats = stats.filter((s) => seriesGameIds.includes(s.game.id));
    const leadingScorer = getSeriesLeader(seriesStats, "pts");

    const winnerTeam = result.winnerAbbr === abbr1 ? team1 : team2;

    await prisma.series.update({
      where: { id: dbSeries.id },
      data: {
        winnerId: winnerTeam.id,
        gameCount: result.gameCount,
        leadingScorer,
        isComplete: true,
      },
    });

    // Advance bracket
    await advanceBracket(dbSeries.id, winnerTeam.id, seasonId, year);

    // Post feed event to all groups
    const groups = await prisma.group.findMany({ where: { seasonId } });
    if (groups.length > 0) {
      await prisma.feedEvent.createMany({
        data: groups.map((g) => ({
          groupId: g.id,
          type: "series_complete",
          payload: {
            seriesId: dbSeries.id,
            winner: winnerTeam.abbr,
            gameCount: result.gameCount,
          },
        })),
      });
    }

    seriesUpdated++;
  }

  // Update playoff-wide stat leaders (players with 8+ games)
  const leaders = computePlayoffLeaders(stats);
  let leadersUpdated = 0;
  for (const [category, playerName] of Object.entries(leaders)) {
    await prisma.playoffLeader.upsert({
      where: { seasonId_category: { seasonId, category } },
      create: { seasonId, category, playerName },
      update: { playerName },
    });
    leadersUpdated++;
  }

  // Update automated general config values
  const otGames = completedGames.filter((g) => g.period > 4).length;
  const game7s = [...seriesMap.values()].filter((g) => g.length === 7).length;

  const existingResults = await getCurrentGeneralResults(seasonId);
  await prisma.generalConfig.update({
    where: { seasonId },
    data: {
      results: {
        ...existingResults,
        overtimes: otGames,
        game7s,
        // gameWinners is manual — never overwrite it here
      },
    },
  });

  // Cache today's live games for SSE
  const liveGames = await getTodayGames();
  for (const g of liveGames) {
    await prisma.liveGameCache.upsert({
      where: { id: String(g.id) },
      create: { id: String(g.id), data: g as any },
      update: { data: g as any, updatedAt: new Date() },
    });
  }

  // Clean up stale cache entries (games older than 6 hours)
  await prisma.liveGameCache.deleteMany({
    where: { updatedAt: { lt: new Date(Date.now() - 6 * 3600 * 1000) } },
  });

  console.log(
    `[sync] Done: ${seriesUpdated} series, ${leadersUpdated} leaders, ${otGames} OT, ${game7s} G7`
  );
  return { seriesUpdated, leadersUpdated, otGames, game7s };
}

// ─── 3. Bracket advancement ──────────────────────────────────────────

async function advanceBracket(
  completedSeriesId: string,
  winnerId: string,
  seasonId: number,
  year: number
) {
  const series = await prisma.series.findUnique({ where: { id: completedSeriesId } });
  if (!series || series.round >= 4) return;

  const slotMap: Record<string, { nextLabel: string; slot: "homeTeamId" | "awayTeamId"; round: number; conference: string }> = {
    E1: { nextLabel: "E_R2A", slot: "homeTeamId", round: 2, conference: "E" },
    E4: { nextLabel: "E_R2A", slot: "awayTeamId", round: 2, conference: "E" },
    E2: { nextLabel: "E_R2B", slot: "homeTeamId", round: 2, conference: "E" },
    E3: { nextLabel: "E_R2B", slot: "awayTeamId", round: 2, conference: "E" },
    W1: { nextLabel: "W_R2A", slot: "homeTeamId", round: 2, conference: "W" },
    W4: { nextLabel: "W_R2A", slot: "awayTeamId", round: 2, conference: "W" },
    W2: { nextLabel: "W_R2B", slot: "homeTeamId", round: 2, conference: "W" },
    W3: { nextLabel: "W_R2B", slot: "awayTeamId", round: 2, conference: "W" },
    E_R2A: { nextLabel: "ECF", slot: "homeTeamId", round: 3, conference: "E" },
    E_R2B: { nextLabel: "ECF", slot: "awayTeamId", round: 3, conference: "E" },
    W_R2A: { nextLabel: "WCF", slot: "homeTeamId", round: 3, conference: "W" },
    W_R2B: { nextLabel: "WCF", slot: "awayTeamId", round: 3, conference: "W" },
    ECF: { nextLabel: "Finals", slot: "homeTeamId", round: 4, conference: "Finals" },
    WCF: { nextLabel: "Finals", slot: "awayTeamId", round: 4, conference: "Finals" },
  };

  const nextSeries = slotMap[series.label];
  if (!nextSeries) return;

  await prisma.series.upsert({
    where: { id: `${year}-${nextSeries.nextLabel}` },
    update: { [nextSeries.slot]: winnerId },
    create: {
      id: `${year}-${nextSeries.nextLabel}`,
      seasonId,
      round: nextSeries.round,
      conference: nextSeries.conference,
      label: nextSeries.nextLabel,
      homeTeamId: winnerId,
      awayTeamId: winnerId,
    },
  });
}

// ─── 4. Score recalculation ──────────────────────────────────────────

export async function recalculateAllScores(seasonId: number): Promise<number> {
  const season = await prisma.season.findUnique({
    where: { id: seasonId },
    include: {
      series: true,
      playoffLeaders: true,
      generalConfig: true,
      snackQuestions: true,
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
  if (!season) throw new Error("Season not found");

  const seriesMap = Object.fromEntries(season.series.map((s) => [s.id, s]));
  const leaderMap = Object.fromEntries(
    season.playoffLeaders.map((l) => [l.category, l.playerName])
  );
  const actualGen = (season.generalConfig?.results ?? {}) as Record<string, number>;
  const snackRes = Object.fromEntries(
    season.snackQuestions.map((q) => [q.id, q.result])
  );

  for (const pred of season.predictions) {
    let total = 0;

    // Series scores
    for (const sp of pred.seriesPredictions) {
      const s = seriesMap[sp.seriesId];
      if (!s?.isComplete || !s.winnerId || !s.gameCount || !s.leadingScorer) continue;

      const scored = scoreSeriesPrediction(
        { winnerId: sp.winnerId, gameCount: sp.gameCount, leadingScorer: sp.leadingScorer },
        {
          winnerId: s.winnerId,
          gameCount: s.gameCount,
          leadingScorer: s.leadingScorer,
          round: s.round,
        }
      );

      await prisma.seriesPrediction.update({
        where: { predictionId_seriesId: { predictionId: pred.id, seriesId: sp.seriesId } },
        data: {
          winnerScore: scored.winnerScore,
          gamesScore: scored.gamesScore,
          scorerScore: scored.scorerScore,
          bonusApplied: scored.bonusApplied,
          totalScore: scored.total,
        },
      });
      total += scored.total;
    }

    // Leader scores
    for (const lp of pred.leaderPredictions) {
      const actual = leaderMap[lp.category];
      if (!actual) continue;
      const pts = scoreLeader(lp.playerName, actual);
      await prisma.leaderPrediction.update({
        where: { predictionId_category: { predictionId: pred.id, category: lp.category } },
        data: { score: pts },
      });
      total += pts;
    }

    // General scores
    if (pred.generalPrediction) {
      const answers = pred.generalPrediction.answers as Record<string, number>;
      const { total: genTotal } = scoreGeneral(answers, actualGen);
      await prisma.generalPrediction.update({
        where: { predictionId: pred.id },
        data: { score: genTotal },
      });
      total += genTotal;
    }

    // Snack scores
    for (const sa of pred.snackAnswers) {
      const actual = snackRes[sa.questionId];
      if (actual === null || actual === undefined) continue;
      const pts = sa.answer === actual ? 2 : 0;
      await prisma.snackAnswer.update({
        where: { id: sa.id },
        data: { score: pts },
      });
      total += pts;
    }

    await prisma.prediction.update({
      where: { id: pred.id },
      data: { totalScore: total, lastScored: new Date() },
    });
  }

  return season.predictions.length;
}

// ─── 5. Helpers ──────────────────────────────────────────────────────

function groupGamesIntoSeries(games: BDLGame[]): Map<string, BDLGame[]> {
  const map = new Map<string, BDLGame[]>();
  for (const g of games) {
    const [a, b] = [g.home_team.abbreviation, g.visitor_team.abbreviation].sort();
    const key = `${a}__${b}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(g);
  }
  return map;
}

function resolveSeriesWinner(
  games: BDLGame[]
): { winnerAbbr: string; gameCount: number } | null {
  const wins: Record<string, number> = {};
  for (const g of games) {
    const w =
      g.home_team_score > g.visitor_team_score
        ? g.home_team.abbreviation
        : g.visitor_team.abbreviation;
    wins[w] = (wins[w] ?? 0) + 1;
    if (wins[w] === 4) return { winnerAbbr: w, gameCount: games.length };
  }
  return null;
}

function getSeriesLeader(
  stats: BDLStat[],
  field: keyof Pick<BDLStat, "pts" | "ast" | "reb" | "blk" | "stl">
): string {
  const agg: Record<number, { name: string; total: number }> = {};
  for (const s of stats) {
    if (!agg[s.player.id]) {
      agg[s.player.id] = {
        name: `${s.player.first_name} ${s.player.last_name}`,
        total: 0,
      };
    }
    agg[s.player.id].total += s[field] ?? 0;
  }
  const sorted = Object.values(agg).sort((a, b) => b.total - a.total);
  return sorted[0]?.name ?? "";
}

function computePlayoffLeaders(
  stats: BDLStat[]
): Record<string, string> {
  type Agg = {
    name: string;
    pts: number;
    ast: number;
    reb: number;
    blk: number;
    stl: number;
    games: number;
  };
  const agg: Record<number, Agg> = {};

  for (const s of stats) {
    if (!agg[s.player.id]) {
      agg[s.player.id] = {
        name: `${s.player.first_name} ${s.player.last_name}`,
        pts: 0, ast: 0, reb: 0, blk: 0, stl: 0, games: 0,
      };
    }
    const p = agg[s.player.id];
    p.pts += s.pts ?? 0;
    p.ast += s.ast ?? 0;
    p.reb += s.reb ?? 0;
    p.blk += s.blk ?? 0;
    p.stl += s.stl ?? 0;
    p.games++;
  }

  // Only players with 8+ games
  const eligible = Object.values(agg).filter((p) => p.games >= 8);
  if (!eligible.length) return {};

  const top = (field: keyof Agg) =>
    eligible.reduce((best, p) =>
      (p[field] as number) > (best[field] as number) ? p : best
    ).name;

  return {
    Points: top("pts"),
    Assists: top("ast"),
    Rebounds: top("reb"),
    Blocks: top("blk"),
    Steals: top("stl"),
  };
}

async function getCurrentGeneralResults(
  seasonId: number
): Promise<Record<string, number>> {
  const cfg = await prisma.generalConfig.findUnique({ where: { seasonId } });
  return (cfg?.results ?? {}) as Record<string, number>;
}

export const TEAM_COLORS: Record<string, string> = {
  BOS: "#007A33", NYK: "#F58426", MIL: "#00471B", CLE: "#6F263D",
  IND: "#002D62", ORL: "#0077C0", MIA: "#98002E", PHI: "#006BB6",
  OKC: "#007AC1", DEN: "#0E2240", MIN: "#0C2340", DAL: "#00538C",
  LAC: "#C8102E", PHX: "#1D1160", NOP: "#0C2340", LAL: "#552583",
  GSW: "#1D428A", SAC: "#5A2D81", HOU: "#CE1141", MEM: "#5D76A9",
  ATL: "#E03A3E", CHI: "#CE1141", TOR: "#CE1141", SAS: "#C4CED4",
  POR: "#E03A3E", UTA: "#002B5C", WAS: "#002B5C", CHA: "#1D1160",
  DET: "#C8102E", BKN: "#000000",
};