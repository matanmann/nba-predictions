import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";

export async function POST(req: NextRequest) {
  // Accept either Bearer token or Vercel cron header
  const authHeader = req.headers.get("authorization");
  const cronHeader = req.headers.get("x-vercel-cron");

  if (authHeader !== `Bearer ${env.CRON_SECRET}` && !cronHeader) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const season = await prisma.season.findFirst({
    where: { isActive: true },
  });
  if (!season) {
    return NextResponse.json({ error: "No active season" }, { status: 404 });
  }

  const { count } = await prisma.prediction.updateMany({
    where: { seasonId: season.id, isLocked: false },
    data: { isLocked: true },
  });

  await prisma.season.update({
    where: { id: season.id },
    data: { predictionsLocked: true, lockedAt: new Date() },
  });

  // Notify all groups
  const groups = await prisma.group.findMany({ where: { seasonId: season.id } });
  if (groups.length > 0) {
    await prisma.feedEvent.createMany({
      data: groups.map((g) => ({
        groupId: g.id,
        type: "lock",
        payload: {
          message: "Predictions locked — playoffs tip off in 5 minutes!",
        },
      })),
    });
  }

  return NextResponse.json({ locked: count });
}