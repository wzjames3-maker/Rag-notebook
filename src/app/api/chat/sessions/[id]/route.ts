import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUserId, unauthorized, notFound } from "@/lib/api-helpers";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getCurrentUserId();
  if (!userId) return unauthorized();

  const { id } = await params;

  const session = await prisma.chatSession.findFirst({
    where: { id, userId },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!session) return notFound("会话不存在");

  return NextResponse.json({
    data: {
      id: session.id,
      title: session.title,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      messages: session.messages,
    },
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getCurrentUserId();
  if (!userId) return unauthorized();

  const { id } = await params;

  const session = await prisma.chatSession.findFirst({
    where: { id, userId },
    select: { id: true },
  });
  if (!session) return notFound("会话不存在");

  await prisma.chatSession.delete({ where: { id } });

  return NextResponse.json({ message: "会话已删除" });
}
