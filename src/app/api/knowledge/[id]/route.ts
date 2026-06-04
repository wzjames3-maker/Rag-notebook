import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUserId, unauthorized, notFound } from "@/lib/api-helpers";

async function getDocumentForUser(id: string, userId: string) {
  return prisma.knowledgeDocument.findFirst({
    where: { id, userId },
    include: {
      chunks: {
        orderBy: { chunkIndex: "asc" },
        select: {
          id: true,
          content: true,
          chunkIndex: true,
          metadata: true,
        },
      },
    },
  });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getCurrentUserId();
  if (!userId) return unauthorized();

  const { id } = await params;
  const doc = await getDocumentForUser(id, userId);
  if (!doc) return notFound("文档不存在");

  const [entityCount, relationshipCount] = await Promise.all([
    prisma.graphEntity.count({ where: { documentId: id } }),
    prisma.graphRelationship.count({
      where: {
        OR: [
          { sourceEntity: { documentId: id } },
          { targetEntity: { documentId: id } },
        ],
      },
    }),
  ]);

  return NextResponse.json({
    data: {
      ...doc,
      createdAt: doc.createdAt.toISOString(),
      graphIndexedAt: doc.graphIndexedAt?.toISOString() ?? null,
      entityCount,
      relationshipCount,
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
  const doc = await prisma.knowledgeDocument.findFirst({
    where: { id, userId },
  });
  if (!doc) return notFound("文档不存在");

  await prisma.knowledgeDocument.delete({ where: { id } });

  return NextResponse.json({ message: "文档已删除" });
}
