import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { NoteCategory } from "@/generated/prisma/enums";
import { getCurrentUserId, unauthorized } from "@/lib/api-helpers";

const createSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().default(""),
  category: z.enum(["WORK", "STUDY", "LIFE", "PROJECT"]).default("WORK"),
  tags: z.array(z.string()).default([]),
});

export async function GET(req: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return unauthorized();

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
  const category = searchParams.get("category");
  const search = searchParams.get("search");
  const stats = searchParams.get("stats");

  const baseWhere = {
    userId,
    deletedAt: null,
  };

  // Stats mode
  if (stats === "true") {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [totalNotes, thisWeek, byCategory, recentNotes] = await Promise.all([
      prisma.note.count({ where: baseWhere }),
      prisma.note.count({ where: { ...baseWhere, createdAt: { gte: weekAgo } } }),
      prisma.note.groupBy({
        by: ["category"],
        where: baseWhere,
        _count: true,
      }),
      prisma.note.findMany({
        where: baseWhere,
        orderBy: { updatedAt: "desc" },
        take: 5,
        select: { id: true, title: true, updatedAt: true },
      }),
    ]);

    const categoryMap: Record<string, number> = {};
    for (const item of byCategory) {
      categoryMap[item.category] = item._count;
    }

    return NextResponse.json({
      data: { totalNotes, thisWeek, byCategory: categoryMap, recentNotes },
    });
  }

  // List mode
  const where: Record<string, unknown> = { ...baseWhere };

  if (category && Object.values(NoteCategory).includes(category as NoteCategory)) {
    where.category = category;
  }

  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { content: { contains: search, mode: "insensitive" } },
    ];
  }

  const [notes, total] = await Promise.all([
    prisma.note.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        title: true,
        content: true,
        category: true,
        tags: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.note.count({ where }),
  ]);

  // Truncate content for list view
  const data = notes.map((note) => ({
    ...note,
    content: note.content.length > 200 ? note.content.slice(0, 200) : note.content,
  }));

  return NextResponse.json({ data, total, page, limit });
}

export async function POST(req: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return unauthorized();

  try {
    const body = await req.json();
    const parsed = createSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", message: parsed.error.message },
        { status: 400 }
      );
    }

    const note = await prisma.note.create({
      data: { ...parsed.data, userId },
    });

    return NextResponse.json(
      { data: note, message: "笔记创建成功" },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "服务器内部错误" },
      { status: 500 }
    );
  }
}
