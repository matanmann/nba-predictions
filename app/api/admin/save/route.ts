import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recalculateAllScores } from "@/lib/nba-sync";

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { year, snackAnswers, gameWinners } = await req.json();

  const season = await prisma.season.findUnique({ where: { year: +year } });
  if (!season) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const normalizeSnackQuestion = (question: string) => question.trim().toLowerCase();
  const seasonSnackQuestions = await prisma.snackQuestion.findMany({
    where: { seasonId: season.id },
    select: { id: true, question: true },
  });
  const questionKeyById = new Map(
    seasonSnackQuestions.map((question) => [question.id, normalizeSnackQuestion(question.question)])
  );
  const questionIdsByKey = new Map<string, number[]>();
  for (const question of seasonSnackQuestions) {
    const key = normalizeSnackQuestion(question.question);
    questionIdsByKey.set(key, [...(questionIdsByKey.get(key) ?? []), question.id]);
  }

  // Update yes/no answers
  const updatedKeys = new Set<string>();
  for (const { id, result } of snackAnswers ?? []) {
    const key = questionKeyById.get(id);
    if (!key || updatedKeys.has(key)) continue;
    updatedKeys.add(key);

    await prisma.snackQuestion.updateMany({
      where: { id: { in: questionIdsByKey.get(key) ?? [id] } },
      data: { result },
    });
  }

  // Update game winners count (merge with automated results)
  if (gameWinners !== null && gameWinners !== undefined) {
    const cfg = await prisma.generalConfig.findUnique({
      where: { seasonId: season.id },
    });
    const existing = (cfg?.results ?? {}) as Record<string, number>;
    await prisma.generalConfig.update({
      where: { seasonId: season.id },
      data: { results: { ...existing, gameWinners: +gameWinners } },
    });
  }

  // Recalculate all scores
  const count = await recalculateAllScores(season.id);

  return NextResponse.json({ ok: true, recalculated: count });
}