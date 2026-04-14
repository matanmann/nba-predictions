import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { env } from "./env";

export async function requireAuth() {
  const { userId } = await auth();
  if (!userId) {
    return {
      userId: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { userId, error: null };
}

export async function requireAdmin() {
  const { userId } = await auth();
  if (!userId || !env.ADMIN_USER_IDS.includes(userId)) {
    return {
      userId: null,
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return { userId, error: null };
}