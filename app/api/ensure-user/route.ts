import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await prisma.user.findUnique({
    where: { clerkId: userId },
  });

  if (existing) {
    return NextResponse.json({ user: existing, created: false });
  }

  const clerkUser = await currentUser();
  if (!clerkUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const name =
    clerkUser.firstName && clerkUser.lastName
      ? `${clerkUser.firstName} ${clerkUser.lastName}`
      : clerkUser.firstName || clerkUser.username || "User";

  const email =
    clerkUser.emailAddresses?.[0]?.emailAddress ?? `${userId}@placeholder.com`;

  const user = await prisma.user.create({
    data: {
      clerkId: userId,
      name,
      email,
    },
  });

  return NextResponse.json({ user, created: true });
}
