import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId, error } = await requireAuth();
  if (error) return error;

  const { id } = await params;

  // Check if user is a member of this group
  const membership = await prisma.membership.findUnique({
    where: { groupId_userId: { groupId: id, userId: userId! } },
  });

  if (!membership) {
    return NextResponse.json({ error: "Not a member of this group" }, { status: 403 });
  }

  // Get group with season info
  const group = await prisma.group.findUnique({
    where: { id },
    include: { season: true },
  });

  if (!group) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }

  const membershipUsers = await prisma.membership.findMany({
    where: { groupId: id },
    select: { userId: true },
  });

  const memberIds = membershipUsers.map((m) => m.userId);

  // Get group predictions only for members of this group
  const predictions = await prisma.prediction.findMany({
    where: {
      seasonId: group.seasonId,
      userId: { in: memberIds },
    },
    include: {
      user: { select: { name: true } },
    },
  });

  // Calculate scores and sort by total score
  const leaderboard = predictions
    .map((p) => ({
      userId: p.userId,
      userName: p.user.name,
      totalScore: p.totalScore,
    }))
    .sort((a, b) => b.totalScore - a.totalScore)
    .map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));

  return NextResponse.json({ leaderboard });
}