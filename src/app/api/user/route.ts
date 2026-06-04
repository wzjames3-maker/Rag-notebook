import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { getCurrentUserId, unauthorized } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  username: z.string().min(3).max(20).optional(),
  avatar: z.string().url().refine((u) => /^https?:\/\//i.test(u), "仅支持 http(s) URL").max(500).nullable().optional(),
  bio: z.string().max(500).nullable().optional(),
});

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return unauthorized();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      email: true,
      avatar: true,
      bio: true,
      createdAt: true,
    },
  });

  if (!user) return unauthorized();

  return NextResponse.json({ data: user });
}

export async function PUT(req: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return unauthorized();

  try {
    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", message: parsed.error.message },
        { status: 400 }
      );
    }

    const data: Prisma.UserUpdateInput = {};
    if (parsed.data.username !== undefined) data.username = parsed.data.username;
    if (parsed.data.avatar !== undefined) data.avatar = parsed.data.avatar;
    if (parsed.data.bio !== undefined) data.bio = parsed.data.bio;

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", message: "没有可更新的字段" },
        { status: 400 }
      );
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        username: true,
        email: true,
        avatar: true,
        bio: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ data: user, message: "资料已更新" });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json(
        { error: "DUPLICATE", message: "用户名已被占用" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "服务器内部错误" },
      { status: 500 }
    );
  }
}
