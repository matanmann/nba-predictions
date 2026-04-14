import { NextRequest, NextResponse } from "next/server";
import { getLockTime, isLocked, secondsUntilLock } from "@/lib/lock";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ year: string }> }
) {
  const { year } = await params;
  const y = +year;
  return NextResponse.json(
    {
      locked: isLocked(y),
      lockTime: getLockTime(y).toISOString(),
      secondsUntilLock: secondsUntilLock(y),
    },
    { headers: { "Cache-Control": "public, max-age=1" } }
  );
}