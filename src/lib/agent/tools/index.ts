import { tool } from "ai";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { embedText } from "@/lib/ai/embeddings";
import { hybridSearch, bm25OnlySearch } from "@/lib/rag/search";
import { graphExplore } from "@/lib/graph/search";
import { extractAndUpsertDocument, recomputeCommunities } from "@/lib/graph/indexer";

function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

const MAX_RESULT_ITEMS = 20;
const MAX_CONTENT_LENGTH = 500;

export function createAgentTools(userId: string) {
  const vector_search = tool({
    description: `在知识库中进行语义向量搜索。适用于查找与查询语义相关的文档片段。当需要理解概念含义、查找相关内容时使用。返回来源文件名和内容片段。`,
    inputSchema: z.object({
      query: z.string().describe("搜索查询，使用自然语言描述你要找的信息"),
      topK: z.number().min(1).max(20).default(10).describe("返回结果数量"),
    }),
    execute: async ({ query, topK }) => {
      try {
        const results = await hybridSearch(query, userId, topK);
        return {
          results: results.slice(0, MAX_RESULT_ITEMS).map((r) => ({
            content: r.content.substring(0, MAX_CONTENT_LENGTH),
            filename: r.filename,
            chunkIndex: r.chunkIndex,
            relevanceScore: Math.round(r.score * 1000) / 1000,
          })),
        };
      } catch (err) {
        console.error("vector_search failed:", err);
        return { error: "search_failed", message: "向量搜索失败，请稍后重试" };
      }
    },
  });

  const keyword_search = tool({
    description: `在知识库中进行 BM25 关键词全文搜索。适用于精确匹配特定术语、名称、代码等。与 vector_search 互补：vector_search 理解语义，keyword_search 精确匹配关键词。`,
    inputSchema: z.object({
      query: z.string().describe("搜索关键词"),
      topK: z.number().min(1).max(20).default(10),
    }),
    execute: async ({ query, topK }) => {
      try {
        const results = await bm25OnlySearch(query, userId, topK);
        return {
          results: results.slice(0, MAX_RESULT_ITEMS).map((r) => ({
            content: r.content.substring(0, MAX_CONTENT_LENGTH),
            filename: r.filename,
            chunkIndex: r.chunkIndex,
            score: Math.round(r.score * 1000) / 1000,
          })),
        };
      } catch (err) {
        console.error("keyword_search failed:", err);
        return { error: "search_failed", message: "关键词搜索失败，请稍后重试" };
      }
    },
  });

  const graph_explore = tool({
    description: `从知识图谱中的某个实体出发，探索它与其他实体的关系。适用于回答"X 和 Y 有什么关系"、"X 涉及哪些方面"这类问题。能沿关系链路多跳推理，发现隐含关系。`,
    inputSchema: z.object({
      entityName: z.string().describe("要探索的实体名称"),
      hops: z.number().min(1).max(3).default(1).describe("遍历跳数"),
      relationFilter: z.string().optional().describe("关系类型过滤"),
    }),
    execute: async ({ entityName, hops, relationFilter }) => {
      try {
        return await graphExplore(entityName, userId, hops, relationFilter);
      } catch (err) {
        console.error("graph_explore failed:", err);
        return { error: "explore_failed", message: "图谱遍历失败，请稍后重试" };
      }
    },
  });

  const graph_search = tool({
    description: `在知识图谱中搜索实体。返回匹配的实体及其类型、描述。适用于确认某个概念/人物/技术是否存在，或获取实体概要信息。`,
    inputSchema: z.object({
      query: z.string().describe("实体名称或概念"),
      entityType: z.string().optional().describe("类型过滤"),
      topK: z.number().min(1).max(10).default(5),
    }),
    execute: async ({ query, entityType, topK }) => {
      try {
        const queryEmbedding = await embedText(query);
        const vectorLiteral = toVectorLiteral(queryEmbedding);

        const entities = await prisma.$queryRawUnsafe(
          `SELECT id, name, type, description, "communityId", degree,
                  1 - (embedding <=> $1::vector) as score
           FROM "GraphEntity"
           WHERE "userId" = $2
             AND ($3::text IS NULL OR type = $3)
           ORDER BY embedding <=> $1::vector
           LIMIT $4`,
          vectorLiteral,
          userId,
          entityType ?? null,
          topK
        );
        return { entities };
      } catch (err) {
        console.error("graph_search failed:", err);
        return { error: "search_failed", message: "图谱搜索失败，请稍后重试" };
      }
    },
  });

  const community_summary = tool({
    description: `获取知识图谱的社区摘要报告，提供全局视角。适用于"知识库主要讲了什么"、"有哪些主题"等全局性问题。`,
    inputSchema: z.object({
      query: z.string().describe("想了解的全局主题或问题"),
      topK: z.number().min(1).max(5).default(3),
    }),
    execute: async ({ query, topK }) => {
      try {
        const queryEmbedding = await embedText(query);
        const vectorLiteral = toVectorLiteral(queryEmbedding);

        const reports = await prisma.$queryRawUnsafe(
          `SELECT gcr.id, gcr.title, gcr.summary, gcr."keyFindings", gcr.rating,
                  gc.size as "entityCount", gc.level,
                  1 - (gcr.embedding <=> $1::vector) as score
           FROM "GraphCommunityReport" gcr
           JOIN "GraphCommunity" gc ON gcr."communityId" = gc.id
           WHERE gcr."userId" = $2
           ORDER BY gcr.embedding <=> $1::vector
           LIMIT $3`,
          vectorLiteral,
          userId,
          topK
        );
        return { communities: reports };
      } catch (err) {
        console.error("community_summary failed:", err);
        return { error: "search_failed", message: "社区摘要查询失败，请稍后重试" };
      }
    },
  });

  const search_notes = tool({
    description: `搜索用户的笔记。在标题和内容中查找关键词。适用于"我之前记过XX吗"、"我的笔记里有没有关于XX的内容"。`,
    inputSchema: z.object({
      query: z.string().describe("搜索关键词"),
      category: z.enum(["WORK", "STUDY", "LIFE", "PROJECT"]).optional(),
      topK: z.number().min(1).max(10).default(5),
    }),
    execute: async ({ query, category, topK }) => {
      try {
        const notes = await prisma.note.findMany({
          where: {
            userId,
            deletedAt: null,
            ...(category ? { category } : {}),
            OR: [
              { title: { contains: query, mode: "insensitive" } },
              { content: { contains: query, mode: "insensitive" } },
            ],
          },
          take: topK,
          orderBy: { updatedAt: "desc" },
          select: { id: true, title: true, content: true, category: true, tags: true, updatedAt: true },
        });
        return {
          notes: notes.map((n) => ({
            ...n,
            content: n.content.substring(0, MAX_CONTENT_LENGTH),
          })),
        };
      } catch (err) {
        console.error("search_notes failed:", err);
        return { error: "search_failed", message: "笔记搜索失败，请稍后重试" };
      }
    },
  });

  const create_note = tool({
    description: `为用户创建新笔记。适用于"帮我记录一下"、"保存为笔记"、"创建关于XX的笔记"。`,
    inputSchema: z.object({
      title: z.string().describe("笔记标题"),
      content: z.string().describe("笔记内容（Markdown）"),
      category: z.enum(["WORK", "STUDY", "LIFE", "PROJECT"]).default("WORK"),
      tags: z.array(z.string()).default([]),
    }),
    execute: async ({ title, content, category, tags }) => {
      try {
        const note = await prisma.note.create({
          data: { userId, title, content, category, tags },
        });
        return { success: true, noteId: note.id, title: note.title };
      } catch (err) {
        console.error("create_note failed:", err);
        return { error: "create_failed", message: "笔记创建失败，请稍后重试" };
      }
    },
  });

  const build_graph = tool({
    description: `为知识库文档构建知识图谱索引。从文档中提取实体和关系，构建图谱并生成社区摘要。每个文档需要数秒到数分钟，消耗 LLM token。`,
    inputSchema: z.object({
      documentId: z.string().optional().describe("文档 ID，不传则索引所有未索引文档"),
    }),
    execute: async ({ documentId }) => {
      try {
        let docs;
        if (documentId) {
          const doc = await prisma.knowledgeDocument.findFirst({
            where: { id: documentId, userId },
          });
          docs = doc ? [doc] : [];
        } else {
          docs = await prisma.knowledgeDocument.findMany({
            where: {
              userId,
              status: "COMPLETED",
              graphIndexed: false,
              graphIndexing: false,
            },
          });
        }

        if (docs.length === 0) {
          return { status: "no_docs", message: "没有需要索引的文档" };
        }

        const MAX_BATCH = 5;
        if (docs.length > MAX_BATCH) {
          return {
            status: "too_many",
            message: `发现 ${docs.length} 个待索引文档，超过单次上限 ${MAX_BATCH}。请指定 documentId 逐个索引，或分批操作。`,
          };
        }

        const affectedEntityIds: string[] = [];
        let failedCount = 0;

        for (const doc of docs) {
          try {
            const result = await extractAndUpsertDocument(doc.id, userId);
            affectedEntityIds.push(...result.newEntityIds);
          } catch (err) {
            console.error(`Graph index failed for doc ${doc.id}:`, err);
            failedCount++;
          }
        }

        let communityResult: { communities: number; reportsGenerated: number; reportsFailed: number } | null = null;
        if (affectedEntityIds.length > 0) {
          communityResult = await recomputeCommunities(userId, {
            onlyAffectedEntityIds: affectedEntityIds,
          });
        }

        return {
          status: "completed",
          indexed: docs.length - failedCount,
          failed: failedCount,
          community: communityResult,
          message: `已为 ${docs.length - failedCount} 个文档完成图谱索引${failedCount > 0 ? `，${failedCount} 个失败` : ""}。`,
        };
      } catch (err) {
        console.error("build_graph failed:", err);
        return { error: "build_failed", message: "图谱构建失败，请稍后重试" };
      }
    },
  });

  const get_time = tool({
    description: "获取当前日期和时间。适用于涉及时效性的问题。",
    inputSchema: z.object({}),
    execute: async () => ({
      datetime: new Date().toISOString(),
      timezone: "Asia/Shanghai",
    }),
  });

  return {
    vector_search,
    keyword_search,
    graph_explore,
    graph_search,
    community_summary,
    search_notes,
    create_note,
    build_graph,
    get_time,
  };
}
