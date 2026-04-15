import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  // ── Season ──
  const season = await prisma.season.upsert({
    where: { year: 2026 },
    update: {},
    create: {
      year: 2026,
      // Adjust these to the actual 2026 playoff schedule
      submissionDeadline: new Date("2026-04-18T19:55:00Z"),
      firstTipoff: new Date("2026-04-18T20:00:00Z"),
      isActive: true,
    },
  });

  // ── Teams (16 playoff teams) ──
  // Update seeds/teams each year based on actual standings.
  // Alternatively, use the /api/admin/init-season endpoint to auto-populate from BallDontLie.
  const teams = [
   // Eastern Conference - מעודכן ל-2026
    { id: "det", name: "Detroit Pistons",        abbr: "DET", conference: "E", seed: 1, color: "#C8102E" },
    { id: "bos", name: "Boston Celtics",         abbr: "BOS", conference: "E", seed: 2, color: "#007A33" },
    { id: "nyc", name: "New York Knicks",        abbr: "NYK", conference: "E", seed: 3, color: "#F58426" },
    { id: "cle", name: "Cleveland Cavaliers",    abbr: "CLE", conference: "E", seed: 4, color: "#6F263D" },
    { id: "tor", name: "Toronto Raptors",        abbr: "TOR", conference: "E", seed: 5, color: "#CE1141" },
    { id: "atl", name: "Atlanta Hawks",          abbr: "ATL", conference: "E", seed: 6, color: "#E03A3E" },
    { id: "phi", name: "Philadelphia 76ers",     abbr: "PHI", conference: "E", seed: 7, color: "#006BB6" },
    { id: "mia", name: "Miami Heat",             abbr: "MIA", conference: "E", seed: 8, color: "#98002E" },

    // Western Conference - מעודכן ל-2026
    { id: "okc", name: "Oklahoma City Thunder",  abbr: "OKC", conference: "W", seed: 1, color: "#007AC1" },
    { id: "sas", name: "San Antonio Spurs",      abbr: "SAS", conference: "W", seed: 2, color: "#C4CED4" },
    { id: "den", name: "Denver Nuggets",         abbr: "DEN", conference: "W", seed: 3, color: "#0E2240" },
    { id: "lal", name: "LA Lakers",              abbr: "LAL", conference: "W", seed: 4, color: "#552583" },
    { id: "hou", name: "Houston Rockets",        abbr: "HOU", conference: "W", seed: 5, color: "#CE1141" },
    { id: "min", name: "Minnesota Timberwolves", abbr: "MIN", conference: "W", seed: 6, color: "#0C2340" },
    { id: "por", name: "Portland Trail Blazers", abbr: "POR", conference: "W", seed: 7, color: "#E03A3E" },
    { id: "pho", name: "Phoenix Suns",           abbr: "PHX", conference: "W", seed: 8, color: "#1D1160" },
];


  for (const t of teams) {
    await prisma.team.upsert({
      where: { id: t.id },
      update: { seed: t.seed, name: t.name, abbr: t.abbr },
      create: { ...t, seasonId: season.id },
    });
  }

  // ── Round 1 Series (1v8, 2v7, 3v6, 4v5) ──
  const series = [
     // Eastern Conference Round 1
    { id: "2026-E1", round: 1, conference: "E", label: "E1", homeTeamId: "det", awayTeamId: "mia" }, // 1 vs 8
    { id: "2026-E2", round: 1, conference: "E", label: "E2", homeTeamId: "bos", awayTeamId: "phi" }, // 2 vs 7
    { id: "2026-E3", round: 1, conference: "E", label: "E3", homeTeamId: "nyc", awayTeamId: "atl" }, // 3 vs 6
    { id: "2026-E4", round: 1, conference: "E", label: "E4", homeTeamId: "cle", awayTeamId: "tor" }, // 4 vs 5

    // Western Conference Round 1
    { id: "2026-W1", round: 1, conference: "W", label: "W1", homeTeamId: "okc", awayTeamId: "pho" }, // 1 vs 8
    { id: "2026-W2", round: 1, conference: "W", label: "W2", homeTeamId: "sas", awayTeamId: "por" }, // 2 vs 7
    { id: "2026-W3", round: 1, conference: "W", label: "W3", homeTeamId: "den", awayTeamId: "min" }, // 3 vs 6
    { id: "2026-W4", round: 1, conference: "W", label: "W4", homeTeamId: "lal", awayTeamId: "hou" }, // 4 vs 5

  ];

  for (const s of series) {
    await prisma.series.upsert({
      where: { id: s.id },
      update: {},
      create: { ...s, seasonId: season.id },
    });
  }

  // ── General config questions ──
  await prisma.generalConfig.upsert({
    where: { seasonId: season.id },
    update: {},
    create: {
      seasonId: season.id,
      questions: [
        { key: "overtimes",   label: "Total overtime games",                 type: "number" },
        { key: "gameWinners", label: "Game-winning shots (under 2 seconds)", type: "number" },
        { key: "game7s",      label: "Total Game 7 series",                  type: "number" },
      ],
    },
  });

  // ── Yes/No snack questions ──
  const snackQuestions = [
    "Will there be a game with over 250 total points?",
    "Will a #1 seed be eliminated in Round 1?",
    "Will the Finals go to Game 7?",
    "Will any player average 40+ PPG in a series?",
    "Will a Finals game go to overtime?",
  ];

  for (let i = 0; i < snackQuestions.length; i++) {
    await prisma.snackQuestion.upsert({
      where: { id: i + 1 },
      update: { question: snackQuestions[i] },
      create: { seasonId: season.id, order: i + 1, question: snackQuestions[i] },
    });
  }

  console.log("Seed complete for season 2026");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());