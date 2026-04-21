import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recalculateAllScores } from "@/lib/nba-sync";
import { Prisma } from "@prisma/client";

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { year, snackAnswers, gameWinners, deniTracker } = await req.json();

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

  // Update manual general values (merge with automated results)
  if (gameWinners !== undefined || deniTracker !== undefined) {
    const cfg = await prisma.generalConfig.findUnique({ where: { seasonId: season.id } });
    const existing = (cfg?.results ?? {}) as Record<string, unknown>;
    const nextResults: Record<string, unknown> = { ...existing };

    if (gameWinners !== undefined) {
      if (gameWinners === null) delete nextResults.gameWinners;
      else nextResults.gameWinners = +gameWinners;
    }

    if (deniTracker !== undefined) {
      if (deniTracker === null) delete nextResults.deniTracker;
      else nextResults.deniTracker = deniTracker;
    }

    if (cfg) {
      await prisma.generalConfig.update({
        where: { seasonId: season.id },
        data: { results: nextResults as Prisma.InputJsonValue },
      });
    } else {
      await prisma.generalConfig.create({
        data: { seasonId: season.id, questions: [], results: nextResults as Prisma.InputJsonValue },
      });
    }
  }

  // Recalculate all scores
  const count = await recalculateAllScores(season.id);

  return NextResponse.json({ ok: true, recalculated: count });
}