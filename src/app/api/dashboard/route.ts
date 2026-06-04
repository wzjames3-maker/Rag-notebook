import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUserId, unauthorized } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return unauthorized();

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const baseWhere = { userId, deletedAt: null };

  const [totalNotes, thisWeekNotes, byCategory, recentNotes, documentCount, sessionCount] =
    await Promise.all([
      prisma.note.count({ where: baseWhere }),
      prisma.note.count({
        where: { ...baseWhere, createdAt: { gte: weekAgo } },
      }),
      prisma.note.groupBy({
        by: ["category"],
        where: baseWhere,
        _count: { _all: true },
      }),
      prisma.note.findMany({
        where: baseWhere,
        orderBy: { updatedAt: "desc" },
        take: 5,
        select: { id: true, title: true, updatedAt: true },
      }),
      prisma.knowledgeDocument.count({
        where: { userId, status: "COMPLETED" },
      }),
      prisma.chatSession.count({ where: { userId } }),
    ]);

  return NextResponse.json({
    data: {
      totalNotes,
      thisWeekNotes,
      byCategory: Object.fromEntries(
        byCategory.map((item) => [item.category, item._count._all])
      ) as Record<string, number>,
      recentNotes,
      documentCount,
      sessionCount,
    },
  });
}
