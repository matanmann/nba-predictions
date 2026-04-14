import { env } from "./env";

const BASE = env.NBA_API_BASE;
const KEY  = env.NBA_API_KEY;

const headers = {
  Authorization: KEY,
  "Content-Type": "application/json",
};

// Delay between paginated requests to respect rate limits (30 req/min free tier)
const RATE_LIMIT_DELAY_MS = 200;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchAllPages<T>(
  endpoint: string,
  params: Record<string, string> = {}
): Promise<T[]> {
  const results: T[] = [];
  let cursor: string | null = null;

  do {
    const url = new URL(`${BASE}${endpoint}`);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    url.searchParams.set("per_page", "100");
    if (cursor) url.searchParams.set("cursor", cursor);

    const res = await fetch(url.toString(), { headers, cache: "no-store" });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`BallDontLie ${endpoint}: ${res.status} ${text}`);
    }

    const json = await res.json();
    results.push(...(json.data ?? []));
    cursor = json.meta?.next_cursor ?? null;

    if (cursor) await sleep(RATE_LIMIT_DELAY_MS);
  } while (cursor);

  return results;
}

// ─── Types ────────────────────────────────────────────────────

export interface BDLTeam {
  id: number;
  name: string;
  full_name: string;
  abbreviation: string;
  conference: string;
  division: string;
}

export interface BDLPlayer {
  id: number;
  first_name: string;
  last_name: string;
  position: string;
  team: BDLTeam;
}

export interface BDLGame {
  id: number;
  date: string;
  season: number;
  postseason: boolean;
  status: string;       // "Final" | ISO date string | "Halftime" | "Q3 4:22"
  period: number;       // 4 = regulation, 5+ = OT
  home_team: BDLTeam;
  visitor_team: BDLTeam;
  home_team_score: number;
  visitor_team_score: number;
}

export interface BDLStat {
  id: number;
  pts: number;
  ast: number;
  reb: number;
  blk: number;
  stl: number;
  min: string;
  player: BDLPlayer;
  team: BDLTeam;
  game: { id: number; date: string; season: number; postseason: boolean };
}

export interface BDLStanding {
  team: BDLTeam;
  conference_rank: number;
  won: number;
  lost: number;
  conference: string;
}

// ─── Query functions ──────────────────────────────────────────

export async function getPlayoffStandings(season: number): Promise<BDLStanding[]> {
  return fetchAllPages<BDLStanding>("/standings", { season: String(season) });
}

export async function getPlayoffGames(season: number): Promise<BDLGame[]> {
  return fetchAllPages<BDLGame>("/games", {
    "seasons[]": String(season),
    postseason: "true",
  });
}

export async function getTodayGames(): Promise<BDLGame[]> {
  const today = new Date().toISOString().split("T")[0];
  return fetchAllPages<BDLGame>("/games", {
    "dates[]": today,
    postseason: "true",
  });
}

export async function getPlayoffStats(season: number): Promise<BDLStat[]> {
  return fetchAllPages<BDLStat>("/stats", {
    "seasons[]": String(season),
    postseason: "true",
  });
}