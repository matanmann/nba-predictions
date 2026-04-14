import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { initSeasonFromAPI } from "@/lib/nba-sync";

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { year } = await req.json();
  const result = await initSeasonFromAPI(+year);
  return NextResponse.json(result);
}