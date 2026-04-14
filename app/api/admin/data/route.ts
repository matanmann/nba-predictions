import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const year = +(req.nextUrl.searchParams.get("year") ?? "2025");
  const season = await prisma.season.findUnique({
    where: { year },
    include: {
      snackQuestions: { orderBy: { order: "asc" } },
      generalConfig: true,
      series: { include: { homeTeam: true, awayTeam: true } },
      playoffLeaders: true,
    },
  });
  if (!season) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    snackQuestions: season.snackQuestions,
    generalResults: season.generalConfig?.results ?? {},
    series: season.series,
    playoffLeaders: season.playoffLeaders,
  });
}