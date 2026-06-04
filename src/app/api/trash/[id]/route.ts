import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUserId, unauthorized, notFound } from "@/lib/api-helpers";

async function getDeletedNoteForUser(id: string, userId: string) {
  return prisma.note.findFirst({
    where: { id, userId, deletedAt: { not: null } },
  });
}

export async function PUT(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getCurrentUserId();
  if (!userId) return unauthorized();

  const { id } = await params;
  const note = await getDeletedNoteForUser(id, userId);
  if (!note) return notFound("笔记不存在");

  await prisma.note.update({
    where: { id },
    data: { deletedAt: null },
  });

  return NextResponse.json({ message: "笔记已恢复" });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getCurrentUserId();
  if (!userId) return unauthorized();

  const { id } = await params;
  const note = await getDeletedNoteForUser(id, userId);
  if (!note) return notFound("笔记不存在");

  await prisma.note.delete({ where: { id } });

  return NextResponse.json({ message: "笔记已永久删除" });
}
