import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

declare global {
  // eslint-disable-next-line no-var
  var __TEST_USER_ID__: string | null | undefined;
}

export async function getCurrentUserId() {
  if (process.env.NODE_ENV !== "production" && globalThis.__TEST_USER_ID__ !== undefined) {
    return globalThis.__TEST_USER_ID__;
  }
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }
  return session.user.id;
}

export function setTestUserId(userId: string | null) {
  globalThis.__TEST_USER_ID__ = userId;
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
