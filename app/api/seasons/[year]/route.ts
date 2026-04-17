import { NextRequest, NextResponse } from "next/server";
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

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ year: string }> }
) {
  const { year } = await params;
  let season = await prisma.season.findUnique({
    where: { year: +year },
    include: {
      series: {
        include: { homeTeam: true, awayTeam: true },
        orderBy: { label: "asc" },
      },
      snackQuestions: { orderBy: { order: "asc" } },
      generalConfig: true,
    },
  });

  if (!season) {
    season = await prisma.season.findFirst({
      where: { isActive: true },
      include: {
        series: {
          include: { homeTeam: true, awayTeam: true },
          orderBy: { label: "asc" },
        },
        snackQuestions: { orderBy: { order: "asc" } },
        generalConfig: true,
      },
    });
  }

  if (!season) {
    return NextResponse.json({ error: "Season not found" }, { status: 404 });
  }

  const snackQuestions = dedupeSnackQuestions(season.snackQuestions);

  return NextResponse.json({
    year: season.year,
    series: season.series,
    snackQuestions,
    generalConfig: season.generalConfig,
  });
}