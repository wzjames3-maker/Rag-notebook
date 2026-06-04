import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUserId, unauthorized } from "@/lib/api-helpers";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return unauthorized();

  const sessions = await prisma.chatSession.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    include: {
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { content: true },
      },
    },
  });

  const data = sessions.map((s) => ({
    id: s.id,
    title: s.title,
    lastMessage: s.messages[0]?.content?.substring(0, 100) ?? "",
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  }));

  return NextResponse.json({ data });
}
