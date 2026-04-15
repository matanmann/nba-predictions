import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

  return NextResponse.json({
    year: season.year,
    series: season.series,
    snackQuestions: season.snackQuestions,
    generalConfig: season.generalConfig,
  });
}