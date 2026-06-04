import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { embedBatch } from "@/lib/ai/embeddings";
import type { TextChunk } from "./chunking";

export async function vectorizeAndStore(
  documentId: string,
  userId: string,
  chunks: TextChunk[]
): Promise<number> {
  if (chunks.length === 0) {
    await prisma.knowledgeDocument.update({
      where: { id: documentId },
      data: { status: "COMPLETED", chunkCount: 0 },
    });
    return 0;
  }

  const texts = chunks.map((c) => c.content);
  const embeddings = await embedBatch(texts);

  const chunkIds = chunks.map(() => crypto.randomUUID());

  await prisma.$transaction(async (tx) => {
    await tx.knowledgeChunk.createMany({
      data: chunks.map((c, i) => ({
        id: chunkIds[i],
        documentId,
        userId,
        content: c.content,
        chunkIndex: c.chunkIndex,
        metadata: c.metadata,
      })),
    });

    const valueRows = chunks.map(
      (c, i) =>
        Prisma.sql`(${chunkIds[i]}, ${`[${embeddings[i].join(",")}]`}::vector)`
    );

    await tx.$executeRaw`
      UPDATE "KnowledgeChunk" k
      SET embedding = v.embedding::vector
      FROM (VALUES ${Prisma.join(valueRows)}) AS v(id, embedding)
      WHERE k.id = v.id::text
    `;

    await tx.knowledgeDocument.update({
      where: { id: documentId },
      data: { status: "COMPLETED", chunkCount: chunks.length },
    });
  });

  return chunks.length;
}
