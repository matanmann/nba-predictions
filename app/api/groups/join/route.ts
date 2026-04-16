import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { userId, error } = await requireAuth();
  if (error) return error;

  try {
    const { code, nickname } = await req.json();
    if (!code?.trim()) {
      return NextResponse.json({ error: "Code required" }, { status: 400 });
    }
    if (!nickname?.trim()) {
      return NextResponse.json({ error: "Nickname required" }, { status: 400 });
    }

    const group = await prisma.group.findUnique({
      where: { code: code.toUpperCase().trim() },
    });
    if (!group) {
      return NextResponse.json({ error: "Invalid invite code" }, { status: 404 });
    }

    const existing = await prisma.membership.findUnique({
      where: { groupId_userId: { groupId: group.id, userId: userId! } },
    });
    if (existing) {
      return NextResponse.json({ group, alreadyMember: true });
    }

    await prisma.membership.create({
      data: { groupId: group.id, userId: userId!, nickname: nickname.trim() },
    });

    await prisma.feedEvent.create({
      data: {
        groupId: group.id,
        type: "join",
        userId: userId!,
        payload: { userId: userId! },
      },
    });

    return NextResponse.json({ group, joined: true });
  } catch (e: any) {
    console.error('Join group error:', e);
    return NextResponse.json({ error: 'Server error while joining group' }, { status: 500 });
  }
}