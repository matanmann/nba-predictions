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

  const group = await prisma.group.findUnique({
    where: { id },
    include: {
      season: { select: { year: true } },
      memberships: {
        select: {
          userId: true,
          nickname: true,
          user: { select: { email: true, name: true } },
        },
      },
    },
  });

  if (!group) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }

  const memberIds = group.memberships.map((m) => m.userId);
  const submittedCount = await prisma.prediction.count({
    where: {
      seasonId: group.seasonId,
      userId: { in: memberIds },
    },
  });

  return NextResponse.json({
    group: {
      ...group,
      memberCount: group.memberships.length,
      submittedCount,
      members: group.memberships.map((m) => ({
        userId: m.userId,
        nickname: m.nickname || m.user.name || 'Unknown',
        email: m.user.email,
      })),
    },
  });
}