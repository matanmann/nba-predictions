import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const { id: groupId } = await params;

  const membership = await prisma.membership.findUnique({
    where: { groupId_userId: { groupId, userId } },
  });
  if (!membership) return new Response("Forbidden", { status: 403 });

  const encoder = new TextEncoder();
  let interval: ReturnType<typeof setInterval> | undefined;
  let lastEventId = "";

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(
            encoder.encode(
              `id: ${Date.now()}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`
            )
          );
        } catch {
          // Controller closed — cleanup happens in cancel()
        }
      };

      // Initial snapshot
      try {
        const liveGames = await prisma.liveGameCache.findMany();
        const leaderboard = await getGroupLeaderboard(groupId);
        send("init", { leaderboard, liveGames: liveGames.map((g) => g.data) });
      } catch {
        // If initial load fails, client will reconnect
      }

      // Poll every 15 seconds
      interval = setInterval(async () => {
        try {
          const [newEvents, lb, games] = await Promise.all([
            prisma.feedEvent.findMany({
              where: {
                groupId,
                ...(lastEventId ? { id: { gt: lastEventId } } : {}),
              },
              orderBy: { createdAt: "asc" },
              take: 20,
            }),
            getGroupLeaderboard(groupId),
            prisma.liveGameCache.findMany(),
          ]);

          send("leaderboard", lb);
          send("live_scores", games.map((g) => g.data));

          if (newEvents.length) {
            send("feed", newEvents);
            lastEventId = newEvents[newEvents.length - 1].id;
          }
        } catch {
          // Stream will recover on next interval
        }
      }, 15_000);
    },
    cancel() {
      if (interval) clearInterval(interval);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
      Connection: "keep-alive",
    },
  });
}

async function getGroupLeaderboard(groupId: string) {
  const members = await prisma.membership.findMany({
    where: { groupId },
    select: { userId: true },
  });

  if (members.length === 0) return [];

  const preds = await prisma.prediction.findMany({
    where: { userId: { in: members.map((m) => m.userId) } },
    select: { userId: true, totalScore: true },
  });

  return preds
    .sort((a, b) => b.totalScore - a.totalScore)
    .map((p, i) => ({ ...p, rank: i + 1 }));
}