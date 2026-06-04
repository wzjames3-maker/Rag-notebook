import { prisma } from "@/lib/db";
import { embedText } from "@/lib/ai/embeddings";
import { rerank } from "@/lib/ai/rerank";
import { create, insertMultiple, search } from "@orama/orama";

export interface SearchResult {
  id: string;
  content: string;
  filename: string;
  chunkIndex: number;
  score: number;
}

const VECTOR_TOP_K = 20;
const BM25_TOP_K = 20;
const RRF_TOP_K = 10;
const RRF_K = 60;

function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

interface VectorRow {
  id: string;
  content: string;
  filename: string;
  chunkIndex: number;
  score: number;
}

async function vectorSearch(
  queryEmbedding: number[],
  userId: string,
  limit: number
): Promise<VectorRow[]> {
  const vectorLiteral = toVectorLiteral(queryEmbedding);
  return (await prisma.$queryRaw`
    SELECT kc.id, kc.content, kc."chunkIndex" as "chunkIndex", kd.filename,
           1 - (kc.embedding <=> ${vectorLiteral}::vector) as score
    FROM "KnowledgeChunk" kc
    JOIN "KnowledgeDocument" kd ON kc."documentId" = kd.id
    WHERE kc."userId" = ${userId}
    ORDER BY kc.embedding <=> ${vectorLiteral}::vector
    LIMIT ${limit}
  `) as VectorRow[];
}

async function bm25Search(
  query: string,
  allChunks: Array<{ id: string; content: string; chunkIndex: number; document: { filename: string } }>,
  limit: number
): Promise<Array<{ id: string; score: number }>> {
  const oramaDb = create({
    schema: { id: "string", content: "string" },
  });
  await insertMultiple(
    oramaDb,
    allChunks.map((c) => ({ id: c.id, content: c.content })),
    500
  );
  const bm25Result = (await search(oramaDb, {
    term: query,
    properties: ["content"],
    limit,
  })) as { hits: Array<{ id: string; score: number }> };
  return bm25Result.hits;
}

function rrfFuse(
  vectorResults: VectorRow[],
  bm25Results: Array<{ id: string; score: number }>,
  allChunks: Array<{ id: string; content: string; chunkIndex: number; document: { filename: string } }>,
  topK: number
): VectorRow[] {
  const rrfScores = new Map<string, number>();
  const rrfSources = new Map<string, VectorRow>();

  vectorResults.forEach((row, rank) => {
    rrfScores.set(row.id, (rrfScores.get(row.id) ?? 0) + 1 / (RRF_K + rank + 1));
    rrfSources.set(row.id, row);
  });

  bm25Results.forEach((hit, rank) => {
    rrfScores.set(hit.id, (rrfScores.get(hit.id) ?? 0) + 1 / (RRF_K + rank + 1));
    if (!rrfSources.has(hit.id)) {
      const chunk = allChunks.find((c) => c.id === hit.id);
      if (chunk) {
        rrfSources.set(hit.id, {
          id: chunk.id,
          content: chunk.content,
          chunkIndex: chunk.chunkIndex,
          filename: chunk.document.filename,
          score: 0,
        });
      }
    }
  });

  const topIds = [...rrfScores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topK)
    .map(([id]) => id);

  if (topIds.length === 0) return [];

  return topIds.map((id) => {
    const row = rrfSources.get(id)!;
    row.score = rrfScores.get(id) ?? 0;
    return row;
  });
}

export async function hybridSearch(
  query: string,
  userId: string,
  topK = 5
): Promise<SearchResult[]> {
  const [queryEmbedding, allChunks] = await Promise.all([
    embedText(query),
    prisma.knowledgeChunk.findMany({
      where: { userId },
      select: {
        id: true,
        content: true,
        chunkIndex: true,
        document: { select: { filename: true } },
      },
    }),
  ]);

  if (allChunks.length === 0) return [];

  const [vectorResults, bm25Results] = await Promise.all([
    vectorSearch(queryEmbedding, userId, VECTOR_TOP_K),
    bm25Search(query, allChunks, BM25_TOP_K),
  ]);

  const topCandidates = rrfFuse(vectorResults, bm25Results, allChunks, RRF_TOP_K);
  if (topCandidates.length === 0) return [];

  const reranked = await rerank(
    query,
    topCandidates.map((c) => ({
      id: c.id,
      content: c.content,
      score: c.score,
    })),
    topK
  );

  return reranked.map((r) => {
    const chunk = topCandidates.find((c) => c.id === r.id);
    return {
      id: r.id,
      content: r.content,
      filename: chunk?.filename ?? "",
      chunkIndex: chunk?.chunkIndex ?? 0,
      score: r.score,
    };
  });
}

export async function bm25OnlySearch(
  query: string,
  userId: string,
  topK = 10
): Promise<SearchResult[]> {
  const allChunks = await prisma.knowledgeChunk.findMany({
    where: { userId },
    select: {
      id: true,
      content: true,
      chunkIndex: true,
      document: { select: { filename: true } },
    },
  });

  if (allChunks.length === 0) return [];

  const bm25Hits = await bm25Search(query, allChunks, topK);

  return bm25Hits.map((hit) => {
    const chunk = allChunks.find((c) => c.id === hit.id);
    return {
      id: hit.id,
      content: chunk?.content ?? "",
      filename: chunk?.document.filename ?? "",
      chunkIndex: chunk?.chunkIndex ?? 0,
      score: hit.score,
    };
  });
}
