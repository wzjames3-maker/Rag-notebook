import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function getCurrentUserId() {
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }
  return session.user.id;
}

export function unauthorized() {
  return NextResponse.json(
    { error: "UNAUTHORIZED", message: "未登录或 session 过期" },
    { status: 401 }
  );
}

export function notFound(message = "资源不存在") {
  return NextResponse.json(
    { error: "NOT_FOUND", message },
    { status: 404 }
  );
}
