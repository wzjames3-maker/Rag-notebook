import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUserId, unauthorized } from "@/lib/api-helpers";

export async function GET(req: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return unauthorized();

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));

  const where = { userId };

  const [documents, total] = await Promise.all([
    prisma.knowledgeDocument.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        filename: true,
        mimeType: true,
        md5: true,
        chunkCount: true,
        status: true,
        graphIndexed: true,
        graphIndexing: true,
        graphError: true,
        graphIndexedAt: true,
        createdAt: true,
        _count: {
          select: { chunks: true },
        },
      },
    }),
    prisma.knowledgeDocument.count({ where }),
  ]);

  const docIds = documents.map((d) => d.id);
  const entityCounts = docIds.length > 0
    ? await prisma.graphEntity.groupBy({
        by: ["documentId"],
        where: { documentId: { in: docIds } },
        _count: { _all: true },
      })
    : [];
  const entityCountMap = new Map(
    entityCounts
      .filter((e): e is { documentId: string; _count: { _all: number } } => e.documentId !== null)
      .map((e) => [e.documentId, e._count._all])
  );

  return NextResponse.json({
    data: documents.map((d) => ({
      id: d.id,
      filename: d.filename,
      mimeType: d.mimeType,
      md5: d.md5,
      chunkCount: d.chunkCount,
      status: d.status,
      graphIndexed: d.graphIndexed,
      graphIndexing: d.graphIndexing,
      graphError: d.graphError,
      graphIndexedAt: d.graphIndexedAt?.toISOString() ?? null,
      createdAt: d.createdAt.toISOString(),
      entityCount: entityCountMap.get(d.id) ?? 0,
    })),
    total,
    page,
    limit,
  });
}
