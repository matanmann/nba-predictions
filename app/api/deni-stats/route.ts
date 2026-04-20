import { NextResponse } from "next/server";
import { fetchAllPages, BDLStat } from "@/lib/nba-api";
import { env } from "@/lib/env";

const BASE = env.NBA_API_BASE;
const KEY = env.NBA_API_KEY;

interface BDLPlayerSearchResult {
  id: number;
  first_name: string;
  last_name: string;
}

async function getDeniPlayerId(): Promise<number | null> {
  // Deni Avdija's player ID in BallDontLie API
  const DENI_ID = 1630166;
  return DENI_ID;
}

export async function GET() {
  try {
    const playerId = await getDeniPlayerId();
    console.log("[Deni API] Player ID:", playerId);
    if (!playerId) {
      console.error("[Deni API] Player not found");
      return NextResponse.json(
        { error: "Player not found" },
        { status: 404 }
      );
    }

    // Use 2025 for current 2025-26 NBA season
    const bdlSeason = 2025;
    console.log("[Deni API] BDL season:", bdlSeason);

    const stats = await fetchAllPages<BDLStat>("/stats", {
      "player_ids[]": String(playerId),
      "seasons[]": String(bdlSeason),
      postseason: "true",
    });

    console.log("[Deni API] Stats fetched:", stats.length, "games");

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

    const result = {
      games,
      totals: {
        ppg: +(totalPts / n).toFixed(1),
        rpg: +(totalReb / n).toFixed(1),
        apg: +(totalAst / n).toFixed(1),
        gamesPlayed: n,
      },
    };

    console.log("[Deni API] Returning:", result);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Deni API error:", err);
    return NextResponse.json(
      { error: String(err) },
      { status: 500 }
    );
  }
}
