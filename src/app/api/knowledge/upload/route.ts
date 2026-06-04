import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import crypto from "node:crypto";
import { getCurrentUserId, unauthorized } from "@/lib/api-helpers";
import { parseDocument, SUPPORTED_MIME_TYPES } from "@/lib/rag/parsers";
import { chunkText } from "@/lib/rag/chunking";
import { vectorizeAndStore } from "@/lib/rag/vectorize";

const MAX_FILE_SIZE = 50 * 1024 * 1024;

export async function POST(req: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return unauthorized();

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "INVALID_FORM_DATA", message: "请求体格式错误" },
      { status: 400 }
    );
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "MISSING_FILE", message: "请提供文件" },
      { status: 400 }
    );
  }

  if (!SUPPORTED_MIME_TYPES.includes(file.type as (typeof SUPPORTED_MIME_TYPES)[number])) {
    return NextResponse.json(
      { error: "UNSUPPORTED_TYPE", message: "不支持的文件类型" },
      { status: 415 }
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "FILE_TOO_LARGE", message: "文件大小超过 50MB" },
      { status: 413 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const md5 = crypto.createHash("md5").update(buffer).digest("hex");

  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!currentUser) {
    return NextResponse.json(
      { error: "SESSION_EXPIRED", message: "登录已过期，请重新登录" },
      { status: 401 }
    );
  }

  const existing = await prisma.knowledgeDocument.findUnique({
    where: { userId_md5: { userId, md5 } },
  });
  if (existing) {
    return NextResponse.json(
      { error: "DUPLICATE", message: "该文件已存在" },
      { status: 409 }
    );
  }

  const doc = await prisma.knowledgeDocument.create({
    data: {
      userId,
      filename: file.name,
      mimeType: file.type,
      md5,
      status: "PROCESSING",
    },
  });

  try {
    const text = await parseDocument(file, file.type);
    const chunks = chunkText(text);
    await vectorizeAndStore(doc.id, userId, chunks);

    const updated = await prisma.knowledgeDocument.findUnique({
      where: { id: doc.id },
    });

    return NextResponse.json(
      { data: updated, message: "文档上传成功" },
      { status: 200 }
    );
  } catch (err) {
    await prisma.knowledgeDocument.update({
      where: { id: doc.id },
      data: { status: "FAILED" },
    });
    const message = err instanceof Error ? err.message : "文档处理失败";
    return NextResponse.json(
      { error: "PROCESSING_ERROR", message },
      { status: 500 }
    );
  }
}
