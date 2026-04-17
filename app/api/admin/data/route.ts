import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function dedupeSnackQuestions<T extends { question: string }>(questions: T[]): T[] {
  const seen = new Set<string>();
  return questions.filter((q) => {
    const key = q.question.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function GET(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const year = +(req.nextUrl.searchParams.get("year") ?? "2026");
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

  const snackQuestions = dedupeSnackQuestions(season.snackQuestions);

  return NextResponse.json({
    snackQuestions,
    generalResults: season.generalConfig?.results ?? {},
    series: season.series,
    playoffLeaders: season.playoffLeaders,
  });
}