import { NextResponse } from "next/server";
import { fetchAllPages, BDLStat } from "@/lib/nba-api";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";

const BASE = env.NBA_API_BASE;
const KEY = env.NBA_API_KEY;

interface BDLPlayerSearchResult {
  id: number;
  first_name: string;
  last_name: string;
}

async function getDeniPlayerId(): Promise<number | null> {
  const url = new URL(`${BASE}/players`);
  url.searchParams.set("search", "deni avdija");
  url.searchParams.set("per_page", "5");
  const res = await fetch(url.toString(), {
    headers: { Authorization: KEY },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const json = await res.json();
  const players: BDLPlayerSearchResult[] = json.data ?? [];
  const deni = players.find(
    (p) =>
      p.first_name.toLowerCase() === "deni" &&
      p.last_name.toLowerCase() === "avdija"
  );
  return deni?.id ?? null;
}

export async function GET() {
  try {
    const playerId = await getDeniPlayerId();
    if (!playerId) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 });
    }

    // Get active season
    const season = await prisma.season.findFirst({ where: { isActive: true } });
    if (!season) {
      return NextResponse.json({ error: "No active season" }, { status: 404 });
    }

    // BDL uses starting year: 2025-26 season → BDL season 2025
    const bdlSeason = season.year - 1;

    const stats = await fetchAllPages<BDLStat>("/stats", {
      "player_ids[]": String(playerId),
      "seasons[]": String(bdlSeason),
      postseason: "true",
    });

    if (stats.length === 0) {
      return NextResponse.json({ games: [], totals: null });
    }

    // Sort games by date ascending
    const sorted = [...stats].sort((a, b) =>
      a.game.date.localeCompare(b.game.date)
    );

    const games = sorted.map((s) => ({
      date: s.game.date,
      pts: s.pts,
      reb: s.reb,
      ast: s.ast,
      min: s.min,
    }));

    const totalPts = stats.reduce((sum, s) => sum + s.pts, 0);
    const totalReb = stats.reduce((sum, s) => sum + s.reb, 0);
    const totalAst = stats.reduce((sum, s) => sum + s.ast, 0);
    const n = stats.length;

    return NextResponse.json({
      games,
      totals: {
        ppg: +(totalPts / n).toFixed(1),
        rpg: +(totalReb / n).toFixed(1),
        apg: +(totalAst / n).toFixed(1),
        gamesPlayed: n,
      },
    });
  } catch (err) {
    console.error("Deni API error:", err);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
