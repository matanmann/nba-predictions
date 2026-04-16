import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 7 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join("");
}

export async function GET() {
  const { userId, error } = await requireAuth();
  if (error) return error;

  const memberships = await prisma.membership.findMany({
    where: { userId: userId! },
    include: {
      group: {
        include: {
          season: { select: { year: true } },
          memberships: { select: { userId: true } },
        },
      },
    },
  });

  return NextResponse.json({
    groups: memberships.map((m) => ({
      ...m.group,
      memberCount: m.group.memberships.length,
    })),
  });
}

export async function POST(req: NextRequest) {
  const { userId, error } = await requireAuth();
  if (error) return error;

  try {
    const { name, seasonYear, nickname } = await req.json();
    if (!name?.trim()) {
      return NextResponse.json({ error: "Name required" }, { status: 400 });
    }
    if (!nickname?.trim()) {
      return NextResponse.json({ error: "Nickname required" }, { status: 400 });
    }

    let season = undefined;
    if (seasonYear) {
      season = await prisma.season.findUnique({ where: { year: +seasonYear } });
    }
    if (!season) {
      season = await prisma.season.findFirst({
        where: { isActive: true },
        orderBy: { year: "desc" },
      });
    }
    if (!season) {
      season = await prisma.season.findFirst({ orderBy: { year: "desc" } });
    }

    if (!season) {
      return NextResponse.json({ error: "Season not found" }, { status: 404 });
    }

    // Generate unique code with collision check
    let code: string;
    do {
      code = generateCode();
    } while (await prisma.group.findUnique({ where: { code } }));

    const group = await prisma.group.create({
      data: {
        name: name.trim(),
        code,
        seasonId: season.id,
        createdBy: userId!,
        memberships: { create: { userId: userId!, role: "admin", nickname: nickname.trim() } },
      },
    });

    return NextResponse.json({ group });
  } catch (e: any) {
    console.error('Group creation error:', e);
    return NextResponse.json({ error: 'Server error while creating group' }, { status: 500 });
  }
}