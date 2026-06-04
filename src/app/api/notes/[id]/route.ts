import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { getCurrentUserId, unauthorized, notFound } from "@/lib/api-helpers";

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().optional(),
  category: z.enum(["WORK", "STUDY", "LIFE", "PROJECT"]).optional(),
  tags: z.array(z.string()).optional(),
});

async function getNoteForUser(id: string, userId: string) {
  return prisma.note.findFirst({
    where: { id, userId, deletedAt: null },
  });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getCurrentUserId();
  if (!userId) return unauthorized();

  const { id } = await params;
  const note = await getNoteForUser(id, userId);
  if (!note) return notFound("笔记不存在");

  return NextResponse.json({ data: note });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getCurrentUserId();
  if (!userId) return unauthorized();

  const { id } = await params;
  const existing = await getNoteForUser(id, userId);
  if (!existing) return notFound("笔记不存在");

  try {
    const body = await req.json();
    const parsed = updateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", message: parsed.error.message },
        { status: 400 }
      );
    }

    const note = await prisma.note.update({
      where: { id },
      data: parsed.data,
    });

    return NextResponse.json({ data: note });
  } catch {
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "服务器内部错误" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getCurrentUserId();
  if (!userId) return unauthorized();

  const { id } = await params;
  const existing = await getNoteForUser(id, userId);
  if (!existing) return notFound("笔记不存在");

  await prisma.note.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  return NextResponse.json({ message: "笔记已移至回收站" });
}
