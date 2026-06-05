# RAG NoteBook — Agentic GraphRAG 详细实施方案（V2）

> 本文档包含所有修正后的完整实施代码。基于对 AGENTIC_GRAPHRAG_FINAL.md 的深度审校，
> 修正了 3 个严重错误、5 个中等错误、4 个轻微错误，并补充了 8 个缺失项。

---

## 审校修正总览

### 严重错误修正

| # | 问题 | 修正 |
|---|------|------|
| C1 | Agent API 中用户消息被重复发送（先保存再获取历史，又手动追加） | 调换顺序：先获取历史，再保存用户消息 |
| C2 | 前端使用 `useChat` 但项目实际用自定义 SSE 解析器 | 改为扩展现有 SSE 解析器，添加 tool-call/tool-result 事件处理 |
| C3 | `sources` 字段格式破坏性变更（从 `SearchResult[]` 变为 `JSON.stringify({toolCalls})`) | 新增 `toolCalls Json?` 列，`sources` 保持原格式 |

### 中等错误修正

| # | 问题 | 修正 |
|---|------|------|
| M1 | `keyword_search` 调用 `hybridSearch` 导致与 `vector_search` 重复 | 导出独立的 `bm25OnlySearch` 函数 |
| M2 | `indexDocumentGraph` 被引用但从未定义 | 明确签名和依赖，在 Phase 1 实现 |
| M4 | `graph_search` 的 entityType 拼接有 SQL 注入风险 | 改用参数化查询 `$queryRawUnsafe(sql, ...params)` |
| M5 | 缺少 `graphology-utils` 依赖 | 补充到依赖列表 |
| M6 | `build_graph` 工具缺少成本控制 | 添加待索引文档数量上限检查 |

### 轻微错误修正

| # | 问题 | 修正 |
|---|------|------|
| m1 | `role` 类型转换遗漏 `"system"` | 改为 `"user" \| "assistant" \| "system"` |
| m2 | `graphExplore` 返回的 `entity.type` 可能为 null | 使用 `?? "OTHER"` |
| m3 | `GraphRelationship.description` 不可为空 | 改为 `String?` |
| m4 | `maxDuration = 120` 超出 Hobby 计划限制 | 降为 60（自部署可改回 120） |

### 补充项

- 所有工具 `execute` 添加 try/catch 错误处理
- 工具返回结果大小限制（避免超出 LLM 上下文窗口）
- 前端 SSE 解析器扩展方案（新增事件类型）
- 现有文档的 `graphIndexed` 迁移说明
- `indexDocumentGraph` 函数签名和导入说明

---

## 修正 1：Prisma Schema

### 1.1 schema.prisma 变更

```prisma
// ===== User 模型扩展（在现有 User 模型中添加反向关系）=====
model User {
  // ... 已有字段 ...

  // 已有关系
  notes      Note[]
  sessions   ChatSession[]
  documents  KnowledgeDocument[]
  chunks     KnowledgeChunk[]

  // 新增 GraphRAG 关系
  graphEntities      GraphEntity[]
  graphRelationships GraphRelationship[]
  graphCommunities   GraphCommunity[]
  graphReports       GraphCommunityReport[]
}

// ===== ChatMessage 扩展 =====
model ChatMessage {
  // ... 已有字段 ...
  sources   Json?     // 已有：SearchResult[]（文档来源）

  // 新增
  toolCalls Json?     // Agent 工具调用记录：ToolCallRecord[]
}

// ===== KnowledgeDocument 扩展 =====
model KnowledgeDocument {
  // ... 已有字段 ...

  // 新增字段
  graphIndexed   Boolean   @default(false)
  graphIndexing  Boolean   @default(false)
  graphError     String?
  graphIndexedAt DateTime?
}

// ===== GraphRAG 模型 =====
// 注意：embedding 字段通过迁移 SQL ALTER TABLE 添加，Prisma 不原生支持 vector 类型

model GraphEntity {
  id          String   @id @default(uuid())
  userId      String
  documentId  String?
  name        String
  type        String?
  description String
  degree      Int      @default(0)
  communityId String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  user          User                @relation(fields: [userId], references: [id])
  relationships GraphRelationship[] @relation("sourceEntity")
  targetRels    GraphRelationship[] @relation("targetEntity")
  community     GraphCommunity?     @relation(fields: [communityId], references: [id])

  @@index([userId])
  @@index([userId, name])
  @@index([userId, type])
  @@index([userId, communityId])
}

model GraphRelationship {
  id             String   @id @default(uuid())
  userId         String
  sourceEntityId String
  targetEntityId String
  type           String?
  description    String?              // ✅ 修正：改为可空，避免 LLM 提取空描述时报错
  weight         Float    @default(1.0)
  sourceChunkId  String?
  createdAt      DateTime @default(now())

  user         User        @relation(fields: [userId], references: [id])
  sourceEntity GraphEntity @relation("sourceEntity", fields: [sourceEntityId], references: [id], onDelete: Cascade)
  targetEntity GraphEntity @relation("targetEntity", fields: [targetEntityId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([sourceEntityId])
  @@index([targetEntityId])
}

model GraphCommunity {
  id        String   @id @default(uuid())
  userId    String
  level     Int
  size      Int
  parentId  String?
  createdAt DateTime @default(now())

  user     User                 @relation(fields: [userId], references: [id])
  parent   GraphCommunity?      @relation("communityHierarchy", fields: [parentId], references: [id])
  children GraphCommunity[]     @relation("communityHierarchy")
  entities GraphEntity[]
  reports  GraphCommunityReport[]

  @@index([userId, level])
}

model GraphCommunityReport {
  id          String   @id @default(uuid())
  userId      String
  communityId String   @unique
  title       String
  summary     String
  keyFindings String[]
  rating      Float    @default(0)
  createdAt   DateTime @default(now())

  user      User           @relation(fields: [userId], references: [id])
  community GraphCommunity @relation(fields: [communityId], references: [id], onDelete: Cascade)

  @@index([userId])
}
```

### 1.2 迁移 SQL

**文件：** `prisma/migrations/xxx_add_graphrag/migration.sql`

```sql
-- GraphEntity embedding 列（Prisma 不支持 vector 类型）
ALTER TABLE "GraphEntity" ADD COLUMN IF NOT EXISTS "embedding" vector(1536);

-- GraphCommunityReport embedding 列
ALTER TABLE "GraphCommunityReport" ADD COLUMN IF NOT EXISTS "embedding" vector(1536);

-- ChatMessage 新增 toolCalls 列（Agent 工具调用记录）
ALTER TABLE "ChatMessage" ADD COLUMN IF NOT EXISTS "toolCalls" jsonb;

-- 向量索引（数据积累后再创建，初始注释掉）
-- CREATE INDEX "graph_entity_embedding_idx" ON "GraphEntity"
--   USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 100);
-- CREATE INDEX "graph_report_embedding_idx" ON "GraphCommunityReport"
--   USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 50);
```

**现有文档迁移说明：**
所有已有 `KnowledgeDocument` 的 `graphIndexed` 默认值为 `false`，这是正确的——它们尚未被图谱索引。当用户首次触发 `build_graph` 时，系统会索引所有 `graphIndexed = false` 且 `status = 'COMPLETED'` 的文档。无需额外迁移脚本。

---

## 修正 2：导出 BM25 独立搜索

**文件：** `src/lib/rag/search.ts`（修改现有文件）

```typescript
// ✅ 新增：导出独立的 BM25 搜索函数（供 keyword_search 工具使用）
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
```

注意：`bm25Search` 是文件内已有的私有函数（第 48-67 行），新增的 `bm25OnlySearch` 只是它的外部包装器。

---

## 修正 3：工具定义（工厂函数 + 错误处理）

**文件：** `src/lib/agent/tools/index.ts`

```typescript
import { tool } from "ai";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { embedText } from "@/lib/ai/embeddings";
import { hybridSearch, bm25OnlySearch } from "@/lib/rag/search";
import { graphExplore } from "@/lib/graph/search";
import { indexDocumentGraph } from "@/lib/graph/indexer";

// 将向量数组转为 pgvector 兼容的字符串
function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

// 工具返回结果大小限制
const MAX_RESULT_ITEMS = 20;
const MAX_CONTENT_LENGTH = 500;

/**
 * 创建所有 Agent 工具（注入 userId）
 * 在 API 路由中调用：createAgentTools(userId)
 */
export function createAgentTools(userId: string) {

  // ═══════════════════════════════════════
  // 1. 向量搜索（语义检索）
  // ═══════════════════════════════════════
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

  // ═══════════════════════════════════════
  // 2. BM25 关键词搜索（精确匹配）
  // ═══════════════════════════════════════
  const keyword_search = tool({
    description: `在知识库中进行 BM25 关键词全文搜索。适用于精确匹配特定术语、名称、代码等。与 vector_search 互补：vector_search 理解语义，keyword_search 精确匹配关键词。`,
    inputSchema: z.object({
      query: z.string().describe("搜索关键词"),
      topK: z.number().min(1).max(20).default(10),
    }),
    execute: async ({ query, topK }) => {
      try {
        // ✅ 修正：使用独立的 BM25 搜索，而非 hybridSearch
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

  // ═══════════════════════════════════════
  // 3. 图谱关系遍历（核心工具）
  // ═══════════════════════════════════════
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

  // ═══════════════════════════════════════
  // 4. 图谱实体搜索
  // ═══════════════════════════════════════
  const graph_search = tool({
    description: `在知识图谱中搜索实体。返回匹配的实体及其类型、描述。适用于确认某个概念/人物/技术是否存在，或获取实体概要信息。`,
    inputSchema: z.object({
      query: z.string().describe("实体名称或概念"),
      entityType: z.string().optional().describe("类型过滤：PERSON, ORGANIZATION, CONCEPT, TECHNOLOGY 等"),
      topK: z.number().min(1).max(10).default(5),
    }),
    execute: async ({ query, entityType, topK }) => {
      try {
        const queryEmbedding = await embedText(query);
        const vectorLiteral = toVectorLiteral(queryEmbedding);

        // ✅ 修正：使用参数化查询防止 SQL 注入
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

  // ═══════════════════════════════════════
  // 5. 社区摘要（全局视角）
  // ═══════════════════════════════════════
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

  // ═══════════════════════════════════════
  // 6. 搜索笔记
  // ═══════════════════════════════════════
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

  // ═══════════════════════════════════════
  // 7. 创建笔记
  // ═══════════════════════════════════════
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

  // ═══════════════════════════════════════
  // 8. 构建知识图谱
  // ═══════════════════════════════════════
  const build_graph = tool({
    description: `为知识库文档构建知识图谱索引。从文档中提取实体和关系，构建图谱并生成社区摘要。构建约 1-3 分钟/文档，消耗 LLM token。`,
    inputSchema: z.object({
      documentId: z.string().optional().describe("文档 ID，不传则索引所有未索引文档"),
    }),
    execute: async ({ documentId }) => {
      try {
        let docs;
        if (documentId) {
          const doc = await prisma.knowledgeDocument.findUnique({
            where: { id: documentId, userId },
          });
          docs = doc ? [doc] : [];
        } else {
          docs = await prisma.knowledgeDocument.findMany({
            where: { userId, status: "COMPLETED", graphIndexed: false },
          });
        }

        if (docs.length === 0) {
          return { status: "no_docs", message: "没有需要索引的文档" };
        }

        // ✅ 修正：添加数量上限，防止意外触发大量索引
        const MAX_BATCH = 10;
        if (docs.length > MAX_BATCH) {
          return {
            status: "too_many",
            message: `发现 ${docs.length} 个待索引文档，超过单次上限 ${MAX_BATCH}。请指定 documentId 逐个索引，或分批操作。`,
          };
        }

        // 触发异步索引（不阻塞 Agent 响应）
        for (const doc of docs) {
          indexDocumentGraph(doc.id, userId).catch((err) =>
            console.error(`Graph index failed for doc ${doc.id}:`, err)
          );
        }

        return {
          status: "processing",
          message: `已启动 ${docs.length} 个文档的图谱索引任务，请稍后查询图谱状态。`,
        };
      } catch (err) {
        console.error("build_graph failed:", err);
        return { error: "build_failed", message: "图谱构建启动失败，请稍后重试" };
      }
    },
  });

  // ═══════════════════════════════════════
  // 9. 获取时间
  // ═══════════════════════════════════════
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
```

---

## 修正 4：graphExplore 多跳遍历修复

**文件：** `src/lib/graph/search.ts`

```typescript
import { prisma } from "@/lib/db";
import { embedText } from "@/lib/ai/embeddings";

function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

export async function graphExplore(
  entityName: string,
  userId: string,
  hops: number,
  relationFilter?: string
) {
  // 1. 模糊匹配实体
  const entity = await prisma.graphEntity.findFirst({
    where: { userId, name: { contains: entityName, mode: "insensitive" } },
  });
  if (!entity) {
    return { found: false, message: `未找到实体 "${entityName}"` };
  }

  // 2. 逐跳遍历
  const visited = new Set<string>([entity.id]);
  const allRelations: Array<{
    hop: number;
    source: string;
    sourceType: string;
    relation: string;
    target: string;
    targetType: string;
    description: string | null;
    weight: number;
  }> = [];

  let currentEntityIds = [entity.id];

  for (let hop = 0; hop < hops; hop++) {
    const rels = await prisma.graphRelationship.findMany({
      where: {
        userId,
        OR: [
          { sourceEntityId: { in: currentEntityIds } },
          { targetEntityId: { in: currentEntityIds } },
        ],
        ...(relationFilter ? { type: relationFilter } : {}),
      },
      include: { sourceEntity: true, targetEntity: true },
      orderBy: { weight: "desc" },
    });

    const nextEntityIds: string[] = [];
    for (const rel of rels) {
      allRelations.push({
        hop: hop + 1,
        source: rel.sourceEntity.name,
        sourceType: rel.sourceEntity.type ?? "OTHER",
        relation: rel.type ?? "RELATED_TO",
        target: rel.targetEntity.name,
        targetType: rel.targetEntity.type ?? "OTHER",
        description: rel.description,
        weight: rel.weight,
      });

      // ✅ 修正：用 currentEntityIds 判断方向，而非固定的 entity.id
      const otherId = currentEntityIds.includes(rel.sourceEntityId)
        ? rel.targetEntityId
        : rel.sourceEntityId;

      if (!visited.has(otherId)) {
        visited.add(otherId);
        nextEntityIds.push(otherId);
      }
    }
    currentEntityIds = nextEntityIds;
    if (currentEntityIds.length === 0) break; // 无更多邻居，提前终止
  }

  return {
    found: true,
    entity: {
      name: entity.name,
      type: entity.type ?? "OTHER", // ✅ 修正：处理 null type
      description: entity.description,
    },
    relations: allRelations,
    totalRelations: allRelations.length,
  };
}
```

---

## 修正 5：Agent 对话 API

**文件：** `src/app/api/agent-chat/route.ts`

```typescript
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  streamText,
  createUIMessageStream,
  createUIMessageStreamResponse,
} from "ai";
import type { Prisma } from "@/generated/prisma/client";
import { chatModel } from "@/lib/ai/dashscope";
import { prisma } from "@/lib/db";
import { getCurrentUserId, unauthorized } from "@/lib/api-helpers";
import { createAgentTools } from "@/lib/agent/tools";

export const maxDuration = 60; // ✅ 修正：Hobby 计划限制 60s，自部署可改 120

const bodySchema = z.object({
  message: z.string().min(1).max(4000),
  sessionId: z.string().uuid().optional(),
});

const HISTORY_LIMIT = 20;

export async function POST(req: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return unauthorized();

  // 解析请求体
  let body: z.infer<typeof bodySchema>;
  try {
    const raw = await req.json();
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", message: parsed.error.message },
        { status: 400 }
      );
    }
    body = parsed.data;
  } catch {
    return NextResponse.json(
      { error: "INVALID_JSON", message: "请求体格式错误" },
      { status: 400 }
    );
  }

  // 获取或创建会话
  let sessionId = body.sessionId;
  if (sessionId) {
    const existing = await prisma.chatSession.findFirst({
      where: { id: sessionId, userId },
      select: { id: true },
    });
    if (!existing) sessionId = undefined;
  }
  if (!sessionId) {
    const created = await prisma.chatSession.create({
      data: { userId, title: body.message.substring(0, 50) },
    });
    sessionId = created.id;
  }

  // ✅ 修正 C1：先获取历史，再保存用户消息（避免重复）
  const history = await prisma.chatMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
    take: HISTORY_LIMIT,
  });

  // 保存用户消息（在获取历史之后）
  await prisma.chatMessage.create({
    data: { sessionId, role: "USER", content: body.message },
  });

  // 获取图谱状态
  const graphEntityCount = await prisma.graphEntity.count({ where: { userId } });
  const hasGraph = graphEntityCount > 0;

  // 创建工具集（注入 userId）
  const tools = createAgentTools(userId);

  // Agent 对话（多步推理 + 流式）
  const result = streamText({
    model: chatModel,
    maxSteps: 5, // ✅ 修正：去掉冗余的 stopWhen

    system: buildSystemPrompt(hasGraph),

    messages: [
      ...history.map((m) => ({
        role: m.role.toLowerCase() as "user" | "assistant" | "system", // ✅ 修正 m1：包含 "system"
        content: m.content,
      })),
      { role: "user" as const, content: body.message },
    ],

    tools,

    onFinish: async ({ text, steps }) => {
      // ✅ 修正 C3：工具调用记录存到 toolCalls 字段，sources 保持 SearchResult[] 兼容
      const toolCallRecords = steps.flatMap((step) =>
        (step.toolCalls ?? []).map((tc) => ({
          toolName: tc.toolName,
          args: tc.args,
        }))
      );

      await prisma.chatMessage.create({
        data: {
          sessionId,
          role: "ASSISTANT",
          content: text,
          // sources 不存储（Agent 模式下来源信息在回答文本中标注）
          toolCalls:
            toolCallRecords.length > 0
              ? (toolCallRecords as unknown as Prisma.InputJsonValue)
              : undefined,
        },
      });

      await prisma.chatSession.update({
        where: { id: sessionId },
        data: { updatedAt: new Date() },
      });
    },
  });

  // 使用与现有 chat API 一致的 UIMessageStream 模式
  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      writer.merge(result.toUIMessageStream());
    },
  });

  const response = createUIMessageStreamResponse({ stream });
  const headers = new Headers(response.headers);
  headers.set("X-Session-Id", sessionId);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function buildSystemPrompt(hasGraph: boolean): string {
  return `你是一个智能知识助手，拥有多种检索和分析工具。请遵循以下工作原则：

## 工作流程（ReAct 模式）

1. **思考**：分析用户的问题，判断需要什么信息
2. **行动**：调用合适的工具获取信息
3. **观察**：评估工具返回的结果是否充分
4. **迭代**：如果信息不够，继续调用其他工具或调整查询
5. **回答**：综合所有获取到的信息，生成完整、准确的回答

## 工具使用策略

### 检索知识库文档时：
- 先使用 vector_search 进行语义搜索（这是最常用的检索方式）
- 如果涉及精确术语/名称/代码，同时使用 keyword_search
- 两个工具的结果互补，同时使用通常能获得更好的覆盖率

### 使用知识图谱时${hasGraph ? "" : "（注意：当前用户尚未构建知识图谱，graph 相关工具可能返回空结果）"}：
- 当问题涉及"XX和YY有什么关系"、"XX涉及哪些方面"时 → 使用 graph_explore
- 当需要确认某个概念/实体是否存在 → 使用 graph_search
- 当问题是全局性的（"主要讲了什么"、"有哪些主题"）→ 使用 community_summary
- 图谱工具可以揭示文档片段中看不到的隐含关系

### 搜索笔记时：
- 用户提到"我之前记过"、"我的笔记" → 使用 search_notes
- 用户要求记录信息 → 使用 create_note

## 回答规范

- 始终标注信息来源（来自哪个文档/哪个实体关系/哪个社区摘要）
- 如果所有工具都没有找到相关信息，诚实说明"知识库中没有找到相关信息"
- 回答要有条理，重要信息优先展示
- 使用 Markdown 格式组织回答
`;
}
```

---

## 修正 6：前端 SSE 解析器扩展

**文件：** `src/app/(main)/chat/page.tsx`（修改现有文件）

现有前端使用自定义 SSE 解析器，不使用 Vercel AI SDK 的 `useChat`。需要扩展 SSE 事件处理来支持 Agent 工具调用事件。

### 6.1 新增类型定义

```typescript
// ✅ 新增：工具调用事件类型
interface ToolCallEvent {
  toolName: string;
  args: Record<string, unknown>;
  toolCallId: string;
}

interface ToolResultEvent {
  toolName: string;
  result: unknown;
  toolCallId: string;
}

// 扩展 ChatMessageData 以支持工具调用
// 在 message-item.tsx 中：
interface ChatMessageData {
  // ...已有字段
  toolCalls?: ToolCallStep[];  // 新增
}

interface ToolCallStep {
  toolName: string;
  args: Record<string, unknown>;
  result?: unknown;
  status: "loading" | "success" | "error";
}
```

### 6.2 扩展 SSE 事件处理

在 `handleSend` 函数的 `readSSEStream` 回调中新增事件处理：

```typescript
// 在现有的 readSSEStream 回调中添加：
let currentToolCalls: ToolCallStep[] = [];

await readSSEStream(res.body, (chunk) => {
  // 已有：文本增量
  if (chunk.type === "text-delta" && typeof chunk.delta === "string") {
    // ... 已有处理 ...
  }
  // 已有：文档来源
  else if (chunk.type === "data-sources" && Array.isArray(chunk.data)) {
    // ... 已有处理 ...
  }
  // ✅ 新增：工具调用开始
  else if (chunk.type === "tool-call") {
    const toolCall = chunk.data as ToolCallEvent;
    currentToolCalls.push({
      toolName: toolCall.toolName,
      args: toolCall.args,
      status: "loading",
    });
    setMessages((prev) =>
      prev.map((m) =>
        m.id === assistantId
          ? { ...m, toolCalls: [...currentToolCalls] }
          : m
      )
    );
  }
  // ✅ 新增：工具调用结果
  else if (chunk.type === "tool-result") {
    const result = chunk.data as ToolResultEvent;
    const idx = currentToolCalls.findIndex(
      (tc) => tc.toolName === result.toolName && tc.status === "loading"
    );
    if (idx >= 0) {
      currentToolCalls[idx] = {
        ...currentToolCalls[idx],
        result: result.result,
        status: "success",
      };
    }
    setMessages((prev) =>
      prev.map((m) =>
        m.id === assistantId
          ? { ...m, toolCalls: [...currentToolCalls] }
          : m
      )
    );
  }
  // 已有：错误
  else if (chunk.type === "error") {
    // ... 已有处理 ...
  }
});
```

### 6.3 useChat 替代方案（可选）

如果未来想切换到 `useChat`，需要以下改造（当前不建议，改动量大）：

```typescript
// 这是备选方案，当前不实施
import { useChat } from "ai/react";

const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
  api: "/api/agent-chat",
  body: { sessionId: currentSessionId },
  // ✅ 不需要 maxSteps（服务端控制）
});
```

注意：`useChat` 会自动处理 `tool-call` / `tool-result` 事件，但需要重写整个消息管理和 SSE 解析逻辑。建议保持现有自定义实现，仅扩展事件类型。

---

## 修正 7：工具调用展示组件

**文件：** `src/components/chat/tool-call-display.tsx`（新增）

```typescript
"use client";

import { useState } from "react";
import { ChevronDownIcon, Loader2Icon, CheckIcon, AlertCircleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ToolCallStep {
  toolName: string;
  args: Record<string, unknown>;
  result?: unknown;
  status: "loading" | "success" | "error";
}

interface ToolCallDisplayProps {
  toolCalls: ToolCallStep[];
}

const toolLabels: Record<string, { icon: string; label: string }> = {
  vector_search:    { icon: "🔍", label: "语义搜索知识库" },
  keyword_search:   { icon: "🔎", label: "关键词搜索知识库" },
  graph_explore:    { icon: "🔗", label: "探索实体关系" },
  graph_search:     { icon: "🏷️", label: "搜索知识图谱" },
  community_summary:{ icon: "📊", label: "获取社区摘要" },
  search_notes:     { icon: "📝", label: "搜索笔记" },
  create_note:      { icon: "✏️", label: "创建笔记" },
  build_graph:      { icon: "🏗️", label: "构建知识图谱" },
  get_time:         { icon: "⏰", label: "获取当前时间" },
};

export function ToolCallDisplay({ toolCalls }: ToolCallDisplayProps) {
  const [expanded, setExpanded] = useState(false);

  if (!toolCalls || toolCalls.length === 0) return null;

  const completedCount = toolCalls.filter((tc) => tc.status === "success").length;
  const loadingCount = toolCalls.filter((tc) => tc.status === "loading").length;

  return (
    <div className="mt-2 border rounded-md bg-muted/20">
      <Button
        variant="ghost"
        size="sm"
        className="w-full h-8 px-3 text-xs justify-between"
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="flex items-center gap-2">
          {loadingCount > 0 ? (
            <Loader2Icon className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <CheckIcon className="h-3.5 w-3.5 text-green-600" />
          )}
          Agent 调用了 {toolCalls.length} 个工具
          {completedCount > 0 && `（${completedCount} 完成）`}
        </span>
        <ChevronDownIcon
          className={cn(
            "h-3.5 w-3.5 transition-transform",
            expanded && "rotate-180"
          )}
        />
      </Button>

      {expanded && (
        <div className="border-t px-3 py-2 space-y-2">
          {toolCalls.map((tc, idx) => {
            const meta = toolLabels[tc.toolName] ?? { icon: "🔧", label: tc.toolName };
            return (
              <div key={idx} className="text-xs border-l-2 pl-3 py-1 border-primary/30">
                <div className="flex items-center gap-1.5">
                  <span>{meta.icon}</span>
                  <span className="font-medium">{meta.label}</span>
                  {tc.status === "loading" && (
                    <Loader2Icon className="h-3 w-3 animate-spin text-muted-foreground" />
                  )}
                  {tc.status === "success" && (
                    <CheckIcon className="h-3 w-3 text-green-600" />
                  )}
                  {tc.status === "error" && (
                    <AlertCircleIcon className="h-3 w-3 text-destructive" />
                  )}
                </div>
                <div className="text-muted-foreground mt-0.5 font-mono">
                  {Object.entries(tc.args)
                    .map(([k, v]) => `${k}: ${typeof v === "string" ? `"${v}"` : JSON.stringify(v)}`)
                    .join(", ")}
                </div>
                {tc.status === "success" && tc.result && (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                      查看结果
                    </summary>
                    <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-auto max-h-40">
                      {JSON.stringify(tc.result, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

---

## 修正 8：消息渲染增强

**文件：** `src/components/chat/message-item.tsx`（修改现有文件）

在助手消息中添加工具调用展示：

```typescript
// 在现有的 MessageItem 组件中，在 <Markdown> 渲染之前添加工具调用展示：

import { ToolCallDisplay } from "./tool-call-display";

// 在 <div className="flex-1 min-w-0 space-y-2"> 内部：

{/* 工具调用步骤（在回答文本之前） */}
{!isUser && message.toolCalls && message.toolCalls.length > 0 && (
  <ToolCallDisplay toolCalls={message.toolCalls} />
)}

{/* 已有的 Markdown 渲染 */}
{message.content ? (
  <Markdown ...>{message.content}</Markdown>
) : ...}
```

同时需要扩展 `ChatMessageData` 接口：

```typescript
export interface ChatMessageData {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  sources?: ChatSource[] | null;
  toolCalls?: ToolCallStep[];  // ✅ 新增
  isStreaming?: boolean;
}

interface ToolCallStep {
  toolName: string;
  args: Record<string, unknown>;
  result?: unknown;
  status: "loading" | "success" | "error";
}
```

---

## 修正 9：图谱数据 API

**文件：** `src/app/api/knowledge/graph-data/route.ts`（新增）

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUserId, unauthorized } from "@/lib/api-helpers";
import { getCommunityColor } from "@/lib/graph/colors";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return unauthorized();

  const [entities, relationships, communities] = await Promise.all([
    prisma.graphEntity.findMany({
      where: { userId },
      select: {
        id: true, name: true, type: true, description: true,
        degree: true, communityId: true,
      },
    }),
    prisma.graphRelationship.findMany({
      where: { userId },
      select: {
        id: true, sourceEntityId: true, targetEntityId: true,
        type: true, description: true, weight: true,
      },
    }),
    prisma.graphCommunity.findMany({
      where: { userId, level: 0 },
      select: { id: true, size: true },
    }),
  ]);

  // ✅ 修正：使用 getCommunityColor 动态生成颜色映射
  const allCommunityIds = communities.map((c) => c.id);
  const communityColorMap = Object.fromEntries(
    allCommunityIds.map((id) => [id, getCommunityColor(id, allCommunityIds)])
  );

  return NextResponse.json({
    nodes: entities.map((e) => ({
      key: e.id,
      attributes: {
        label: e.name,
        type: e.type ?? "OTHER",
        description: e.description,
        degree: e.degree,
        communityId: e.communityId,
        x: Math.random() * 1000,
        y: Math.random() * 1000,
        size: Math.max(3, Math.min(20, (e.degree || 1) * 2)),
        color: communityColorMap[e.communityId ?? ""] ?? "#999",
      },
    })),
    edges: relationships.map((r) => ({
      key: r.id,
      source: r.sourceEntityId,
      target: r.targetEntityId,
      attributes: {
        label: r.type ?? "RELATED_TO",
        description: r.description,
        weight: r.weight,
        size: Math.max(1, r.weight / 3),
        color: "#ccc",
      },
    })),
    stats: {
      entityCount: entities.length,
      relationshipCount: relationships.length,
      communityCount: communities.length,
    },
  });
}
```

---

## 修正 10：图谱可视化组件

### 10.1 调色板

**文件：** `src/lib/graph/colors.ts`

```typescript
const PALETTE = [
  "#4E79A7", "#F28E2B", "#E15759", "#76B7B2",
  "#59A14F", "#EDC948", "#B07AA1", "#FF9DA7",
  "#9C755F", "#BAB0AC", "#86BCB6", "#8CD17D",
];

export function getCommunityColor(communityId: string, allCommunityIds: string[]): string {
  const index = allCommunityIds.indexOf(communityId);
  if (index === -1) return "#999";
  return PALETTE[index % PALETTE.length];
}

export const entityTypeIcons: Record<string, string> = {
  PERSON: "👤",
  ORGANIZATION: "🏢",
  LOCATION: "📍",
  CONCEPT: "💡",
  EVENT: "📅",
  TECHNOLOGY: "⚙️",
  PRODUCT: "📦",
  OTHER: "🔹",
};
```

### 10.2 图谱画布

**文件：** `src/components/knowledge/graph-canvas.tsx`

```typescript
"use client";

import { SigmaContainer, useSigma, useRegisterEvents } from "@react-sigma/core";
import { useLayoutForceAtlas2 } from "@react-sigma/layout-forceatlas2";
import type Graph from "graphology";
import { useEffect, useCallback } from "react";

interface GraphCanvasProps {
  graphData: {
    nodes: { key: string; attributes: Record<string, unknown> }[];
    edges: { key: string; source: string; target: string; attributes: Record<string, unknown> }[];
  };
  onNodeClick?: (nodeId: string, nodeData: Record<string, unknown>) => void;
  onNodeHover?: (nodeId: string | null) => void;
}

function GraphContent({ graphData, onNodeClick, onNodeHover }: GraphCanvasProps) {
  const sigma = useSigma();
  const graph = sigma.getGraph();
  const { assign: assignLayout } = useLayoutForceAtlas2({ iterations: 100 });
  const registerEvents = useRegisterEvents();

  useEffect(() => {
    graph.clear();
    for (const node of graphData.nodes) {
      graph.addNode(node.key, node.attributes);
    }
    for (const edge of graphData.edges) {
      if (graph.hasNode(edge.source) && graph.hasNode(edge.target)) {
        graph.addEdgeWithKey(edge.key, edge.source, edge.target, edge.attributes);
      }
    }
    assignLayout();
  }, [graphData]);

  useEffect(() => {
    registerEvents({
      clickNode: (e) => {
        const nodeData = graph.getNodeAttributes(e.node);
        onNodeClick?.(e.node, nodeData);
      },
      enterNode: (e) => {
        onNodeHover?.(e.node);
        highlightNodeAndNeighbors(graph, e.node);
      },
      leaveNode: () => {
        onNodeHover?.(null);
        resetHighlight(graph);
      },
    });
  }, [registerEvents, graph]);

  return null;
}

function highlightNodeAndNeighbors(graph: Graph, nodeId: string) {
  const neighbors = new Set(graph.neighbors(nodeId));
  neighbors.add(nodeId);
  graph.forEachNode((n) => {
    graph.setNodeAttribute(n, "highlighted", neighbors.has(n));
    graph.setNodeAttribute(n, "reduced", !neighbors.has(n));
  });
}

function resetHighlight(graph: Graph) {
  graph.forEachNode((n) => {
    graph.setNodeAttribute(n, "highlighted", false);
    graph.setNodeAttribute(n, "reduced", false);
  });
}

function nodeReducer(_node: string, data: Record<string, unknown>) {
  const res = { ...data };
  if (data.reduced) {
    res.color = "#ddd";
    res.label = "";
    res.size = (Number(data.size) || 3) * 0.6;
  }
  if (data.highlighted) {
    res.size = (Number(data.size) || 3) * 1.4;
    res.zIndex = 1;
  }
  return res;
}

export default function GraphCanvas(props: GraphCanvasProps) {
  return (
    <div className="relative w-full h-full min-h-[500px] rounded-lg border bg-background overflow-hidden">
      <SigmaContainer
        style={{ width: "100%", height: "100%" }}
        settings={{
          nodeReducer,
          renderLabels: true,
          labelRenderedSizeThreshold: 6,
          labelSize: 12,
          labelColor: { color: "#333" },
          edgeColor: "default",
          defaultEdgeColor: "#ddd",
          zIndex: true,
        }}
      >
        <GraphContent {...props} />
      </SigmaContainer>
    </div>
  );
}
```

### 10.3 节点详情面板

**文件：** `src/components/knowledge/graph-node-detail.tsx`

```typescript
"use client";

import { XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { entityTypeIcons } from "@/lib/graph/colors";

interface NodeDetailProps {
  node: {
    id: string;
    label: string;
    type: string;
    description: string;
    communityId: string;
  } | null;
  relations: {
    direction: "outgoing" | "incoming";
    type: string;
    targetName: string;
    targetType: string;
    description: string | null;
  }[];
  sourceDocuments: { filename: string; documentId: string }[];
  onClose: () => void;
}

export function NodeDetailPanel({
  node, relations, sourceDocuments, onClose,
}: NodeDetailProps) {
  if (!node) return null;

  const typeIcon = entityTypeIcons[node.type] ?? entityTypeIcons.OTHER;

  return (
    <div className="w-80 border-l bg-background p-4 overflow-auto">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">{typeIcon}</span>
          <h3 className="font-semibold text-sm">{node.label}</h3>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onClose}>
          <XIcon className="h-4 w-4" />
        </Button>
      </div>

      <div className="text-xs text-muted-foreground mb-2">
        {node.type} · Community: {node.communityId?.substring(0, 8) ?? "—"}
      </div>

      <p className="text-sm mb-4">{node.description}</p>

      {relations.length > 0 && (
        <div className="mb-4">
          <h4 className="font-medium text-xs mb-2">
            关系（{relations.length}）
          </h4>
          <div className="space-y-1.5">
            {relations.map((r, i) => (
              <div key={i} className="text-xs flex items-center gap-1.5">
                <span className="text-muted-foreground">
                  {r.direction === "outgoing" ? "→" : "←"}
                </span>
                <span className="font-medium">{r.type}</span>
                <span>{r.targetName}</span>
                <span className="text-muted-foreground">
                  ({r.targetType})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {sourceDocuments.length > 0 && (
        <div>
          <h4 className="font-medium text-xs mb-2">来源文档</h4>
          <div className="space-y-1">
            {sourceDocuments.map((d, i) => (
              <div key={i} className="text-xs text-muted-foreground">
                📄 {d.filename}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

### 10.4 控制栏

**文件：** `src/components/knowledge/graph-controls.tsx`

```typescript
"use client";

import { SearchIcon, PlayIcon, PauseIcon, RotateCcwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface GraphControlsProps {
  filters: {
    types: string[];
    community: string | null;
    search: string;
  };
  onChange: (filters: GraphControlsProps["filters"]) => void;
  stats?: {
    entityCount: number;
    relationshipCount: number;
    communityCount: number;
  };
  onLayoutToggle: () => void;
  onLayoutReset: () => void;
  isLayoutRunning: boolean;
}

const entityTypes = [
  "PERSON", "ORGANIZATION", "LOCATION", "CONCEPT",
  "EVENT", "TECHNOLOGY", "PRODUCT", "OTHER",
];

export function GraphControls({
  filters, onChange, stats, onLayoutToggle, onLayoutReset, isLayoutRunning,
}: GraphControlsProps) {
  return (
    <div className="flex items-center gap-2 p-2 border-b">
      <div className="relative flex-1 max-w-xs">
        <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="搜索实体..."
          className="h-8 pl-7 text-xs"
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
        />
      </div>

      <select
        className="h-8 px-2 text-xs border rounded bg-background"
        value={filters.types.length > 0 ? filters.types[0] : ""}
        onChange={(e) =>
          onChange({ ...filters, types: e.target.value ? [e.target.value] : [] })
        }
      >
        <option value="">所有类型</option>
        {entityTypes.map((t) => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>

      <Button
        variant="outline"
        size="sm"
        className="h-8 px-2"
        onClick={onLayoutToggle}
      >
        {isLayoutRunning ? (
          <PauseIcon className="h-3.5 w-3.5" />
        ) : (
          <PlayIcon className="h-3.5 w-3.5" />
        )}
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="h-8 px-2"
        onClick={onLayoutReset}
      >
        <RotateCcwIcon className="h-3.5 w-3.5" />
      </Button>

      {stats && (
        <span className="text-xs text-muted-foreground ml-auto">
          实体: {stats.entityCount} · 关系: {stats.relationshipCount} · 社区: {stats.communityCount}
        </span>
      )}
    </div>
  );
}
```

---

## 修正 11：侧边栏导航集成

**文件：** `src/components/layout/app-sidebar.tsx`（修改现有文件）

在 `navItems` 数组中，在 `/knowledge` 项之后添加图谱导航项：

```typescript
import { Share2Icon } from "lucide-react"; // 新增导入

const navItems = [
  { href: "/dashboard", label: "仪表盘", icon: LayoutDashboardIcon },
  { href: "/notes", label: "笔记", icon: FileTextIcon },
  { href: "/knowledge", label: "知识库", icon: DatabaseIcon },
  { href: "/knowledge/graph", label: "知识图谱", icon: Share2Icon }, // ✅ 新增
  { href: "/chat", label: "AI 对话", icon: MessageSquareIcon },
  { href: "/trash", label: "回收站", icon: Trash2Icon },
];
```

注意：`/knowledge/graph` 路径会自动匹配 `/knowledge` 的高亮（因为 `pathname.startsWith(item.href + "/")` 逻辑），所以图谱页面在知识库导航项下也能正确高亮。

---

## 附录 A：`indexDocumentGraph` 函数签名

**文件：** `src/lib/graph/indexer.ts`（Phase 1 实现）

```typescript
/**
 * 对单个文档执行图谱索引（增量模式）
 * 流程：提取实体/关系 → 合并到已有图谱 → 重新社区检测 → 生成社区摘要
 */
export async function indexDocumentGraph(
  documentId: string,
  userId: string
): Promise<void> {
  // Phase 1 实现
  // 1. 读取文档的 KnowledgeChunk
  // 2. 调用 extractor 提取实体和关系
  // 3. 合并到 GraphEntity / GraphRelationship（增量）
  // 4. 调用 builder 构建 graphology 图
  // 5. 调用 community 运行 Louvain
  // 6. 调用 reporter 生成社区摘要 + 向量化
  // 7. 更新 KnowledgeDocument.graphIndexed = true
}
```

此函数在 Phase 2 的 `build_graph` 工具中被引用。Phase 1 必须先完成此函数的实现。

---

## 附录 B：完整依赖列表

```bash
# Phase 1: 图处理（索引管线）
pnpm add graphology graphology-communities-louvain graphology-metrics graphology-types graphology-utils

# Phase 3: 图谱可视化
pnpm add sigma @react-sigma/core @react-sigma/layout-forceatlas2 graphology-layout-forceatlas2
```

---

## 附录 C：实施时间线

| 阶段 | 内容 | 工期 | 里程碑 |
|------|------|------|--------|
| Phase 1 | 图谱索引管线（提取→建图→社区→摘要） | 1 周 | 能对一个文档完成图谱索引 |
| Phase 2 | Agent 9 工具 + 对话 API + 索引 API | 1 周 | 对话中 Agent 能调用所有工具 |
| Phase 3 | 前端（工具调用展示 + 图谱可视化） | 1.5 周 | 图谱页面可交互浏览 |
| Phase 4 | 调优（Prompt、工具描述、性能） | 持续 | Agent 工具选择准确率 > 90% |
