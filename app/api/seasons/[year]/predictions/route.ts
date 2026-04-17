import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { isLocked } from "@/lib/lock";
import { z } from "zod";

const LEADER_CATEGORIES = ["Points", "Assists", "Rebounds", "Blocks", "Steals"] as const;

const submitSchema = z.object({
  seriesPredictions: z.array(
    z.object({
      seriesId: z.string().min(1).max(50),
      winnerId: z.string().min(1).max(50),
      gameCount: z.number().int().min(4).max(7),
      leadingScorer: z.string().min(1).max(100),
    })
  ),
  leaderPredictions: z.record(z.enum(LEADER_CATEGORIES), z.string().min(1).max(100)),
  mvpPredictions: z.object({
    eastMvp: z.string().min(1).max(100),
    westMvp: z.string().min(1).max(100),
    finalsMvp: z.string().min(1).max(100),
  }),
  generalAnswers: z.record(z.string(), z.number().int().min(0).max(999)),
  snackAnswers: z.array(
    z.object({
      questionId: z.number().int().positive(),
      answer: z.boolean(),
    })
  ),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ year: string }> }
) {
  const { userId, error } = await requireAuth();
  if (error) return error;

  const { year } = await params;
  const season = await prisma.season.findUnique({ where: { year: +year } });
  if (!season) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const prediction = await prisma.prediction.findUnique({
    where: { userId_seasonId: { userId: userId!, seasonId: season.id } },
    include: {
      seriesPredictions: true,
      leaderPredictions: true,
      mvpPredictions: true,
      generalPrediction: true,
      snackAnswers: true,
    },
  });

  return NextResponse.json({ prediction });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ year: string }> }
) {
  const { userId, error } = await requireAuth();
  if (error) return error;

  const { year } = await params;
  const y = +year;

  if (isLocked(y)) {
    return NextResponse.json({ error: "Predictions are locked" }, { status: 423 });
  }

  const parseResult = submitSchema.safeParse(await req.json());
  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Invalid data", details: parseResult.error.flatten() },
      { status: 400 }
    );
  }
  const body = parseResult.data;

  const season = await prisma.season.findUnique({ where: { year: y } });
  if (!season) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const prediction = await prisma.prediction.upsert({
    where: { userId_seasonId: { userId: userId!, seasonId: season.id } },
    create: { userId: userId!, seasonId: season.id },
    update: { updatedAt: new Date() },
  });

  // Replace all sub-predictions atomically
  await prisma.$transaction([
    prisma.seriesPrediction.deleteMany({ where: { predictionId: prediction.id } }),
    prisma.seriesPrediction.createMany({
      data: body.seriesPredictions.map((sp) => ({
        predictionId: prediction.id,
        ...sp,
      })),
    }),
    prisma.leaderPrediction.deleteMany({ where: { predictionId: prediction.id } }),
    prisma.leaderPrediction.createMany({
      data: Object.entries(body.leaderPredictions).map(
        ([category, playerName]) => ({
          predictionId: prediction.id,
          category,
          playerName,
        })
      ),
    }),
    prisma.mvpPrediction.deleteMany({ where: { predictionId: prediction.id } }),
    prisma.mvpPrediction.createMany({
      data: Object.entries(body.mvpPredictions).map(([role, playerName]) => ({
        predictionId: prediction.id,
        role,
        playerName,
      })),
    }),
    prisma.generalPrediction.upsert({
      where: { predictionId: prediction.id },
      create: {
        predictionId: prediction.id,
        answers: body.generalAnswers,
      },
      update: {
        answers: body.generalAnswers,
      },
    }),
    prisma.snackAnswer.deleteMany({ where: { predictionId: prediction.id } }),
    prisma.snackAnswer.createMany({
      data: body.snackAnswers.map((answer) => ({
        predictionId: prediction.id,
        questionId: answer.questionId,
        answer: answer.answer,
      })),
    }),
  ])

  return NextResponse.json({ success: true });
}
