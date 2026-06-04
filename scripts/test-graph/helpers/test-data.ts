import { prisma } from "@/lib/db";

export interface SeedDocResult {
  documentId: string;
  chunkIds: string[];
}

export async function seedTestDoc(
  userId: string,
  filename: string,
  chunks: string[]
): Promise<SeedDocResult> {
  const md5 = `tg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const doc = await prisma.knowledgeDocument.create({
    data: {
      userId,
      filename,
      mimeType: "text/plain",
      md5,
      chunkCount: chunks.length,
      status: "COMPLETED",
    },
  });

  const chunkIds: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const chunk = await prisma.knowledgeChunk.create({
      data: {
        userId,
        documentId: doc.id,
        content: chunks[i],
        chunkIndex: i,
        metadata: { source: "test-seed" },
      },
    });
    chunkIds.push(chunk.id);
  }

  return { documentId: doc.id, chunkIds };
}

export async function seedIndexedDoc(
  userId: string,
  filename: string,
  graphIndexed = true
): Promise<{ documentId: string }> {
  const md5 = `tgi-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const doc = await prisma.knowledgeDocument.create({
    data: {
      userId,
      filename,
      mimeType: "text/plain",
      md5,
      chunkCount: 1,
      status: "COMPLETED",
      graphIndexed,
      graphIndexedAt: graphIndexed ? new Date() : null,
    },
  });
  return { documentId: doc.id };
}

export async function seedOrphanIndexingDoc(
  userId: string,
  filename: string
): Promise<{ documentId: string }> {
  const md5 = `tgo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const doc = await prisma.knowledgeDocument.create({
    data: {
      userId,
      filename,
      mimeType: "text/plain",
      md5,
      chunkCount: 1,
      status: "COMPLETED",
      graphIndexed: false,
      graphIndexing: true,
    },
  });
  return { documentId: doc.id };
}

export async function seedStaleJob(
  userId: string,
  minutesAgo: number
): Promise<{ jobId: string }> {
  const startedAt = new Date(Date.now() - minutesAgo * 60_000);
  const job = await prisma.graphBuildJob.create({
    data: {
      userId,
      scope: "incremental",
      status: "running",
      total: 5,
      completed: 0,
      failed: 0,
      startedAt,
    },
  });
  return { jobId: job.id };
}
