# RAG NoteBook — GraphRAG 集成开发计划

> 参考微软 GraphRAG 架构，在现有 TypeScript / Next.js 项目中自研知识图谱增强 RAG。
> 核心目标：让 AI 不仅能检索知识片段，还能理解实体关系、回答全局性问题。

---

## 1. 为什么需要 GraphRAG

现有 RAG 流水线（向量 + BM25 + RRF + Rerank）擅长回答"局部问题"——即答案集中在某几个文档片段中的问题。但面对以下场景力不从心：

- **全局性问题**："这个知识库主要讲了什么？""所有文档中有哪些共同主题？"
- **多跳推理**："A 和 B 之间有什么间接关系？"
- **跨文档综合**："综合所有文档，XX 领域的发展趋势是什么？"

GraphRAG 通过构建知识图谱 + 社区检测 + 社区摘要，赋予 RAG 系统"全局理解"能力。

### 1.1 架构对比

```
传统 RAG：
  问题 → 向量/BM25 检索 → 返回相关片段 → LLM 生成

GraphRAG 增强：
  问题 → 向量/BM25 检索（局部上下文）
       → 图谱检索：实体匹配 + 邻居遍历 + 社区摘要（全局上下文）
       → 融合检索结果 → LLM 生成
```

---

## 2. 整体架构设计

### 2.1 索引流程（Indexing Pipeline）

```
文档上传 → 文本切片（已有）→ 向量化（已有）
                              ↓
                    GraphRAG 索引（新增）
                    ├── 1. 实体提取（LLM 从切片中抽取实体）
                    ├── 2. 关系提取（LLM 识别实体间关系）
                    ├── 3. 图构建（合并重复实体，聚合关系）
                    ├── 4. 社区检测（Louvain 算法，分层聚类）
                    └── 5. 社区摘要（LLM 为每个社区生成摘要报告）
```

### 2.2 查询流程（Query Pipeline）

```
用户提问
  ├── 向量检索（pgvector cosine similarity）→ top 20
  ├── BM25 检索（orama）→ top 20
  ├── 图谱检索（新增）
  │   ├── Local Search：匹配问题中的实体 → 遍历邻居 → 取相关子图
  │   └── Global Search：匹配最相关的社区摘要 → 获取全局视角
  ├── RRF 融合 → top 10
  ├── LLM Rerank → top 5
  └── 构建 Prompt（向量上下文 + 图谱上下文 + 社区摘要 + 历史）
      → streamText 流式生成
```

### 2.3 两种搜索模式

| 模式 | 适用场景 | 数据来源 | 成本 |
|------|----------|----------|------|
| Local Search | 具体问题，涉及特定实体 | 实体邻居子图 + 原始切片 | 低 |
| Global Search | 全局问题，综合主题 | 社区摘要（Map-Reduce） | 中 |

聊天时系统自动判断问题类型，决定使用哪种图谱搜索模式（或两者结合）。

---

## 3. 技术选型

### 3.1 图处理库：graphology

选择 `graphology` 而非 Neo4j 的理由：
- 纯 JavaScript/TypeScript，无需引入额外的图数据库服务
- 内置 Louvain 社区检测算法（与微软使用的 Leiden 算法效果接近）
- 支持有向/无向图、加权图、多重图
- 内存中操作，适合个人知识库规模（万级实体）
- 丰富的图论指标（中心性、度、邻居等）

**新增依赖：**
```bash
pnpm add graphology graphology-communities-louvain graphology-metrics graphology-types
```

### 3.2 存储：PostgreSQL（复用现有数据库）

不引入 Neo4j，用 PostgreSQL 关系表存储图数据：
- `GraphEntity` 表 → 节点（实体）
- `GraphRelationship` 表 → 边（关系）
- `GraphCommunity` 表 → 社区
- `GraphCommunityReport` 表 → 社区摘要报告

graphology 用于内存中的图算法运算（社区检测、图遍历），运算结果持久化到 PostgreSQL。

### 3.3 LLM 调用：复用 DashScope + Vercel AI SDK

实体提取、关系提取、社区摘要生成均使用 `generateObject`（结构化输出）或 `generateText`（自由文本），无需额外的 LLM 服务。

---

## 4. 数据模型设计

### 4.1 Prisma Schema 扩展

```prisma
// ========== GraphRAG 相关模型 ==========

model GraphEntity {
  id          String   @id @default(uuid())
  userId      String
  documentId  String?                           // 来源文档（可为 null，表示跨文档推理出的实体）
  name        String                             // 实体名称
  type        String?                            // 实体类型：PERSON, ORG, LOCATION, CONCEPT, EVENT, TECH 等
  description String                             // 实体描述（LLM 生成）
  embedding   Vector?                            // 实体名称+描述的向量（用于语义匹配）
  degree      Int      @default(0)               // 度（关系数量，用于排序）
  communityId String?                            // 所属社区 ID
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  user          User              @relation(fields: [userId], references: [id])
  relationships GraphRelationship[] @relation("sourceEntity")
  targetRels    GraphRelationship[] @relation("targetEntity")
  community     GraphCommunity?   @relation(fields: [communityId], references: [id])

  @@index([userId])
  @@index([userId, name])
  @@index([userId, type])
  @@index([userId, communityId])
}

model GraphRelationship {
  id              String   @id @default(uuid())
  userId          String
  sourceEntityId  String                         // 源实体 ID
  targetEntityId  String                         // 目标实体 ID
  type            String?                        // 关系类型
  description     String                         // 关系描述
  weight          Float    @default(1.0)         // 权重（出现频次 / LLM 置信度）
  sourceChunkId   String?                        // 来源切片 ID
  createdAt       DateTime @default(now())

  user        User          @relation(fields: [userId], references: [id])
  sourceEntity GraphEntity  @relation("sourceEntity", fields: [sourceEntityId], references: [id], onDelete: Cascade)
  targetEntity GraphEntity  @relation("targetEntity", fields: [targetEntityId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([sourceEntityId])
  @@index([targetEntityId])
}

model GraphCommunity {
  id        String   @id @default(uuid())
  userId    String
  level     Int                                  // 层级（0=最细粒度，数字越大越粗粒度）
  size      Int                                  // 社区包含的实体数量
  parentId  String?                              // 父社区 ID（层级结构）
  createdAt DateTime @default(now())

  user      User                 @relation(fields: [userId], references: [id])
  parent    GraphCommunity?      @relation("communityHierarchy", fields: [parentId], references: [id])
  children  GraphCommunity[]     @relation("communityHierarchy")
  entities  GraphEntity[]
  reports   GraphCommunityReport[]

  @@index([userId, level])
  @@index([userId, parentId])
}

model GraphCommunityReport {
  id          String   @id @default(uuid())
  userId      String
  communityId String
  title       String                             // 社区主题标题
  summary     String                             // 社区摘要（LLM 生成）
  keyFindings String[]                           // 关键发现
  rating      Float    @default(0)               // 重要性评分（0-10）
  embedding   Vector?                            // 摘要向量（用于语义检索）
  createdAt   DateTime @default(now())

  user      User           @relation(fields: [userId], references: [id])
  community GraphCommunity @relation(fields: [communityId], references: [id], onDelete: Cascade)

  @@unique([communityId])                        // 一个社区一份报告
  @@index([userId])
}
```

### 4.2 User 模型扩展

```prisma
// 在 User 模型中添加关系
model User {
  // ... 已有字段 ...
  graphEntities     GraphEntity[]
  graphRelationships GraphRelationship[]
  graphCommunities  GraphCommunity[]
  graphReports      GraphCommunityReport[]
}
```

### 4.3 KnowledgeDocument 模型扩展

```prisma
// 在 KnowledgeDocument 中添加图索引状态
model KnowledgeDocument {
  // ... 已有字段 ...
  graphIndexed Boolean @default(false)  // 是否已完成图谱索引
}
```

### 4.4 pgvector 扩展

在迁移 SQL 中为 GraphEntity 和 GraphCommunityReport 添加 embedding 列：

```sql
ALTER TABLE "GraphEntity" ADD COLUMN IF NOT EXISTS "embedding" vector(1536);
ALTER TABLE "GraphCommunityReport" ADD COLUMN IF NOT EXISTS "embedding" vector(1536);

-- 实体名称的向量索引（数据积累后创建）
-- CREATE INDEX "graph_entity_embedding_idx" ON "GraphEntity" USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 100);
-- CREATE INDEX "graph_report_embedding_idx" ON "GraphCommunityReport" USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 100);
```

---

## 5. 实施路线（详细版）

### 第 G1 步：图谱基础设施

**目标：** 安装图处理库 + 定义 LLM 提取的 Prompt + 结构化输出 Schema

#### G1.1 安装依赖

```bash
pnpm add graphology graphology-communities-louvain graphology-metrics graphology-types
```

#### G1.2 实体与关系提取 Prompt

**新增文件：** `src/lib/graph/prompts.ts`

定义三个核心 Prompt 模板：

**实体提取 Prompt（Entity Extraction）：**
```
你是一个知识图谱构建助手。请从以下文本中提取所有重要的实体。

文本内容：
{chunk_content}

请提取实体，每个实体包含：
- name: 实体名称（简洁，通常是名词/专有名词）
- type: 实体类型（从以下选择：PERSON, ORGANIZATION, LOCATION, CONCEPT, EVENT, TECHNOLOGY, PRODUCT, OTHER）
- description: 对实体的简要描述（基于文本内容，1-2 句话）

注意：
- 只提取文本中明确提及的实体
- 同义词/别名应作为独立实体提取，后续步骤会合并
- 优先提取对理解文本内容有帮助的关键实体
```

**关系提取 Prompt（Relationship Extraction）：**
```
你是一个知识图谱构建助手。基于以下文本和已识别的实体，提取实体之间的关系。

文本内容：
{chunk_content}

已识别的实体：
{entity_list}

请提取关系，每个关系包含：
- sourceEntityName: 源实体名称
- targetEntityName: 目标实体名称
- type: 关系类型（简洁动词短语，如 "属于", "开发了", "位于"）
- description: 关系的详细描述（1-2 句话）
- weight: 关系强度（1-10，10 为最强）

注意：
- 只提取文本中有明确依据的关系
- 双向关系只需提取一次，选择更自然的方向
```

**社区摘要 Prompt（Community Report）：**
```
你是一个知识图谱分析助手。以下是某个知识社区中的实体和关系。请生成一份社区摘要报告。

社区中的实体：
{entity_list}

社区中的关系：
{relationship_list}

请生成：
- title: 社区主题标题（简洁概括这个社区讨论的核心主题）
- summary: 详细摘要（200-400 字，综合描述社区中的核心实体、关系和主题）
- keyFindings: 3-5 个关键发现（数组）
- rating: 重要性评分（0-10，基于实体数量和关系密度）
```

#### G1.3 结构化输出 Schema

**新增文件：** `src/lib/graph/schemas.ts`

使用 zod 定义 LLM 输出的结构化 Schema：

```typescript
import { z } from "zod";

// 实体类型枚举
export const entityTypes = [
  "PERSON", "ORGANIZATION", "LOCATION", "CONCEPT",
  "EVENT", "TECHNOLOGY", "PRODUCT", "OTHER"
] as const;

// 实体提取输出
export const entityExtractionSchema = z.object({
  entities: z.array(z.object({
    name: z.string(),
    type: z.enum(entityTypes),
    description: z.string(),
  })),
});

// 关系提取输出
export const relationshipExtractionSchema = z.object({
  relationships: z.array(z.object({
    sourceEntityName: z.string(),
    targetEntityName: z.string(),
    type: z.string(),
    description: z.string(),
    weight: z.number().min(1).max(10),
  })),
});

// 社区报告输出
export const communityReportSchema = z.object({
  title: z.string(),
  summary: z.string(),
  keyFindings: z.array(z.string()),
  rating: z.number().min(0).max(10),
});
```

**产出文件：**
- `src/lib/graph/prompts.ts`（新增）
- `src/lib/graph/schemas.ts`（新增）

---

### 第 G2 步：实体与关系提取

**目标：** 从文档切片中通过 LLM 提取实体和关系

#### G2.1 实体提取服务

**新增文件：** `src/lib/graph/extractor.ts`

核心逻辑：
```typescript
import { generateObject } from "ai";
import { chatModel } from "@/lib/ai/dashscope";
import { entityExtractionSchema, relationshipExtractionSchema } from "./schemas";

// 从单个切片提取实体
export async function extractEntities(
  chunkContent: string
): Promise<z.infer<typeof entityExtractionSchema>["entities"]> {
  const { object } = await generateObject({
    model: chatModel,
    schema: entityExtractionSchema,
    prompt: buildEntityExtractionPrompt(chunkContent),
  });
  return object.entities;
}

// 从单个切片提取关系（基于已提取的实体）
export async function extractRelationships(
  chunkContent: string,
  entities: { name: string; type: string }[]
): Promise<z.infer<typeof relationshipExtractionSchema>["relationships"]> {
  const { object } = await generateObject({
    model: chatModel,
    schema: relationshipExtractionSchema,
    prompt: buildRelationshipExtractionPrompt(chunkContent, entities),
  });
  return object.relationships;
}
```

#### G2.2 批量提取编排器

**新增文件：** `src/lib/graph/indexer.ts`

编排整个图谱索引流程：

```typescript
export async function indexDocumentToGraph(
  documentId: string,
  userId: string,
  chunks: { id: string; content: string; chunkIndex: number }[]
): Promise<{
  entityCount: number;
  relationshipCount: number;
  communityCount: number;
}> {
  // 1. 逐切片提取实体和关系（控制并发，避免 API 限流）
  const allEntities = new Map<string, EntityData>();
  const allRelationships: RelationshipData[] = [];

  const CONCURRENCY = 5; // 同时处理 5 个切片
  for (let i = 0; i < chunks.length; i += CONCURRENCY) {
    const batch = chunks.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (chunk) => {
        const entities = await extractEntities(chunk.content);
        const relationships = await extractRelationships(chunk.content, entities);
        return { entities, relationships, chunkId: chunk.id };
      })
    );

    // 2. 合并实体（按 name 去重，累加描述）
    for (const result of results) {
      for (const entity of result.entities) {
        const key = entity.name.toLowerCase();
        if (allEntities.has(key)) {
          // 合并描述，取更长的
          const existing = allEntities.get(key)!;
          if (entity.description.length > existing.description.length) {
            existing.description = entity.description;
          }
          existing.chunkIds.push(result.chunkId);
        } else {
          allEntities.set(key, {
            ...entity,
            chunkIds: [result.chunkId],
          });
        }
      }
      allRelationships.push(...result.relationships.map(r => ({
        ...r,
        sourceChunkId: result.chunkId,
      })));
    }
  }

  // 3. 持久化实体到数据库
  // 4. 持久化关系到数据库
  // 5. 向量化实体描述（embedding）
  // 6. 触发社区检测
  // 7. 生成社区摘要

  return { entityCount, relationshipCount, communityCount };
}
```

#### G2.3 并发控制与错误处理

- 使用 `Promise.all` + 分批处理控制 DashScope API 并发
- 单个切片的提取失败不影响其他切片（记录失败日志，标记文档为部分索引）
- 添加 token 消耗估算和日志记录

**产出文件：**
- `src/lib/graph/extractor.ts`（新增）
- `src/lib/graph/indexer.ts`（新增）

---

### 第 G3 步：图构建与社区检测

**目标：** 在内存中构建图 → 运行 Louvain 社区检测 → 持久化社区结构

#### G3.1 图构建

**新增文件：** `src/lib/graph/builder.ts`

```typescript
import Graph from "graphology";
import { louvain } from "graphology-communities-louvain";

export function buildGraph(
  entities: GraphEntity[],
  relationships: GraphRelationship[]
): Graph {
  const graph = new Graph({ multi: false, type: "undirected" });

  // 添加节点（实体）
  for (const entity of entities) {
    graph.addNode(entity.id, {
      name: entity.name,
      type: entity.type,
      description: entity.description,
      degree: 0,
    });
  }

  // 添加边（关系）
  for (const rel of relationships) {
    if (graph.hasNode(rel.sourceEntityId) && graph.hasNode(rel.targetEntityId)) {
      if (!graph.hasEdge(rel.sourceEntityId, rel.targetEntityId)) {
        graph.addEdge(rel.sourceEntityId, rel.targetEntityId, {
          type: rel.type,
          description: rel.description,
          weight: rel.weight,
        });
      }
    }
  }

  return graph;
}
```

#### G3.2 社区检测

**新增文件：** `src/lib/graph/community.ts`

```typescript
import { louvain } from "graphology-communities-louvain";

export interface CommunityResult {
  communityId: string;        // 社区 ID
  entityIds: string[];        // 社区包含的实体 ID
  level: number;              // 层级
  parentCommunityId?: string; // 父社区
}

export function detectCommunities(graph: Graph): CommunityResult[] {
  // Louvain 算法返回 { nodeId: communityId } 的映射
  const communities = louvain(graph, { resolution: 1.0 });

  // 按社区 ID 分组
  const communityMap = new Map<string, string[]>();
  for (const [nodeId, communityId] of Object.entries(communities)) {
    const key = String(communityId);
    if (!communityMap.has(key)) communityMap.set(key, []);
    communityMap.get(key)!.push(nodeId);
  }

  // 转换为 CommunityResult 数组
  const results: CommunityResult[] = [];
  for (const [communityId, entityIds] of communityMap.entries()) {
    results.push({
      communityId,
      entityIds,
      level: 0, // 初始层级
    });
  }

  // 层级社区检测（可选）：对大型社区递归运行 Louvain
  // 当一个社区的实体数 > 阈值（如 20）时，对子图再次运行
  const HIERARCHY_THRESHOLD = 20;
  const hierarchicalResults: CommunityResult[] = [];

  for (const community of results) {
    if (community.entityIds.length > HIERARCHY_THRESHOLD) {
      const subgraph = graph.subgraph(community.entityIds);
      const subCommunities = louvain(subgraph, { resolution: 1.5 });
      // 生成子社区，设置 parentCommunityId
      // ...
    }
    hierarchicalResults.push(community);
  }

  return hierarchicalResults;
}
```

#### G3.3 社区持久化

将检测结果写入 PostgreSQL：
- 为每个社区创建 `GraphCommunity` 记录
- 更新 `GraphEntity.communityId`
- 处理层级关系（parentId）

**产出文件：**
- `src/lib/graph/builder.ts`（新增）
- `src/lib/graph/community.ts`（新增）

---

### 第 G4 步：社区摘要生成

**目标：** LLM 为每个社区生成结构化摘要报告

#### G4.1 摘要生成服务

**新增文件：** `src/lib/graph/reporter.ts`

```typescript
import { generateObject } from "ai";
import { chatModel } from "@/lib/ai/dashscope";
import { communityReportSchema } from "./schemas";

export async function generateCommunityReport(
  community: CommunityResult,
  entities: GraphEntity[],
  relationships: GraphRelationship[]
): Promise<z.infer<typeof communityReportSchema>> {
  // 筛选该社区内的实体和关系
  const communityEntities = entities.filter(e => community.entityIds.includes(e.id));
  const communityRels = relationships.filter(
    r => community.entityIds.includes(r.sourceEntityId) &&
         community.entityIds.includes(r.targetEntityId)
  );

  // 构建 Prompt 输入
  const entityList = communityEntities
    .map(e => `- ${e.name} (${e.type}): ${e.description}`)
    .join("\n");
  const relList = communityRels
    .map(r => `- ${r.sourceName} → ${r.type} → ${r.targetName}: ${r.description}`)
    .join("\n");

  const { object } = await generateObject({
    model: chatModel,
    schema: communityReportSchema,
    prompt: buildCommunityReportPrompt(entityList, relList),
  });

  return object;
}
```

#### G4.2 向量化社区摘要

摘要生成后，将报告文本向量化（复用 `embedText`），存入 `GraphCommunityReport.embedding`，用于后续 Global Search 的语义匹配。

#### G4.3 Token 消耗估算与优化

| 阶段 | 估算 | 优化策略 |
|------|------|----------|
| 实体提取 | ~500 tokens/切片（输入） + ~200 tokens（输出） | 分批并发，限制每篇文档最多 100 个切片 |
| 关系提取 | ~600 tokens/切片 + ~300 tokens | 与实体提取合并为单次 LLM 调用（可选） |
| 社区摘要 | ~1000 tokens/社区 + ~400 tokens | 控制社区数量（调整 Louvain resolution 参数） |

**单篇文档（20 个切片）预估消耗：**
- 实体+关系提取：约 20 × 1600 = 32,000 tokens
- 社区摘要：假设 3-5 个社区，约 5 × 1400 = 7,000 tokens
- 总计：约 39,000 tokens/文档（约 ¥0.02-0.05/文档，取决于模型定价）

**产出文件：**
- `src/lib/graph/reporter.ts`（新增）

---

### 第 G5 步：图谱索引 API + 文档上传集成

**目标：** 提供图谱索引的触发入口，集成到文档上传流程

#### G5.1 图谱索引 API

**新增文件：** `src/app/api/knowledge/[id]/graph-index/route.ts`

```typescript
// POST /api/knowledge/[id]/graph-index
// 对指定文档触发图谱索引（实体提取 → 关系提取 → 社区检测 → 摘要生成）

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  const documentId = params.id;

  // 1. 校验文档存在且属于当前用户
  // 2. 获取文档的所有切片
  // 3. 调用 indexDocumentToGraph()
  // 4. 更新文档的 graphIndexed = true
  // 5. 返回索引结果统计
}
```

#### G5.2 文档上传集成

**修改文件：** `src/app/api/knowledge/upload/route.ts`

- 文档上传完成后，检查是否启用"自动图谱索引"
- 如果启用，在后台异步触发 `indexDocumentToGraph`
- 不阻塞上传响应返回

#### G5.3 全量重建 API

**新增文件：** `src/app/api/knowledge/graph-rebuild/route.ts`

```typescript
// POST /api/knowledge/graph-rebuild
// 清除用户所有图谱数据 → 从所有已索引文档重新构建
// 用途：实体合并优化后、Prompt 调优后需要重建图谱
```

#### G5.4 图谱统计 API

**新增文件：** `src/app/api/knowledge/graph-stats/route.ts`

```typescript
// GET /api/knowledge/graph-stats
// 返回当前用户的图谱统计：实体数、关系数、社区数、已索引文档数
```

**产出文件：**
- `src/app/api/knowledge/[id]/graph-index/route.ts`（新增）
- `src/app/api/knowledge/graph-rebuild/route.ts`（新增）
- `src/app/api/knowledge/graph-stats/route.ts`（新增）
- `src/app/api/knowledge/upload/route.ts`（修改）

---

### 第 G6 步：图谱检索（Local + Global Search）

**目标：** 实现基于知识图谱的检索，与现有向量/BM25 检索融合

#### G6.1 Local Search（实体级检索）

**新增文件：** `src/lib/graph/search.ts`

```typescript
export async function graphLocalSearch(
  query: string,
  userId: string,
  topK = 5
): Promise<GraphSearchResult[]> {
  // 1. 向量化查询
  const queryEmbedding = await embedText(query);

  // 2. 实体匹配：通过 embedding 相似度找到与查询最相关的实体
  const matchedEntities = await prisma.$queryRaw`
    SELECT id, name, type, description,
           1 - (embedding <=> ${queryVector}) as score
    FROM "GraphEntity"
    WHERE "userId" = ${userId}
    ORDER BY embedding <=> ${queryVector}
    LIMIT 10
  `;

  // 3. 对每个匹配实体，获取其邻居关系（1-hop 或 2-hop）
  const contextChunks: GraphSearchResult[] = [];
  for (const entity of matchedEntities.slice(0, 3)) {
    // 获取实体的所有关系
    const relationships = await prisma.graphRelationship.findMany({
      where: {
        userId,
        OR: [
          { sourceEntityId: entity.id },
          { targetEntityId: entity.id },
        ],
      },
      include: {
        sourceEntity: true,
        targetEntity: true,
      },
      orderBy: { weight: "desc" },
      take: 5,
    });

    // 构建结构化上下文
    for (const rel of relationships) {
      contextChunks.push({
        type: "graph_local",
        content: `${rel.sourceEntity.name} ${rel.type} ${rel.targetEntity.name}: ${rel.description}`,
        entities: [rel.sourceEntity.name, rel.targetEntity.name],
        score: entity.score * (rel.weight / 10),
      });
    }
  }

  return contextChunks.sort((a, b) => b.score - a.score).slice(0, topK);
}
```

#### G6.2 Global Search（社区级检索）

```typescript
export async function graphGlobalSearch(
  query: string,
  userId: string,
  topK = 3
): Promise<GraphSearchResult[]> {
  // 1. 向量化查询
  const queryEmbedding = await embedText(query);

  // 2. 社区摘要匹配：通过 embedding 相似度找到最相关的社区报告
  const matchedReports = await prisma.$queryRaw`
    SELECT gcr.id, gcr.title, gcr.summary, gcr."keyFindings", gcr.rating,
           1 - (gcr.embedding <=> ${queryVector}) as score
    FROM "GraphCommunityReport" gcr
    WHERE gcr."userId" = ${userId}
    ORDER BY gcr.embedding <=> ${queryVector}
    LIMIT ${topK}
  `;

  // 3. 返回社区摘要作为全局上下文
  return matchedReports.map((report: any) => ({
    type: "graph_global",
    content: `[${report.title}]\n${report.summary}`,
    keyFindings: report.keyFindings,
    score: report.score * (report.rating / 10),
  }));
}
```

#### G6.3 混合检索融合

**修改文件：** `src/lib/rag/search.ts`

在现有 `hybridSearch` 函数中集成图谱检索：

```typescript
export async function hybridSearch(
  query: string,
  userId: string,
  topK = 5,
  options?: { enableGraphRAG?: boolean }
): Promise<SearchResult[]> {
  // 已有：向量检索 top 20
  const vectorResults = await vectorSearch(query, userId, 20);

  // 已有：BM25 检索 top 20
  const bm25Results = await bm25Search(query, userId, 20);

  // 新增：图谱检索（如果启用）
  let graphLocalResults: GraphSearchResult[] = [];
  let graphGlobalResults: GraphSearchResult[] = [];
  if (options?.enableGraphRAG) {
    [graphLocalResults, graphGlobalResults] = await Promise.all([
      graphLocalSearch(query, userId, 10),
      graphGlobalSearch(query, userId, 3),
    ]);
  }

  // RRF 融合（三路：向量 + BM25 + 图谱）
  const rrfScores = new Map<string, number>();
  const K = 60;

  // 向量结果
  vectorResults.forEach((r, rank) => {
    rrfScores.set(r.id, (rrfScores.get(r.id) || 0) + 1 / (K + rank + 1));
  });
  // BM25 结果
  bm25Results.forEach((r, rank) => {
    rrfScores.set(r.id, (rrfScores.get(r.id) || 0) + 1 / (K + rank + 1));
  });
  // 图谱 Local 结果
  graphLocalResults.forEach((r, rank) => {
    const graphKey = `graph_local_${rank}`;
    rrfScores.set(graphKey, (rrfScores.get(graphKey) || 0) + 1 / (K + rank + 1));
  });

  // ... 后续 Rerank 逻辑不变
}
```

#### G6.4 查询意图识别（自动选择搜索模式）

**新增文件：** `src/lib/graph/intent.ts`

简单的启发式判断：

```typescript
export async function detectQueryIntent(query: string): Promise<{
  isGlobal: boolean;
  isLocal: boolean;
}> {
  // 全局问题特征词
  const globalKeywords = ["总体", "总结", "概述", "趋势", "共同", "所有", "整体",
                          "主要", "核心", "综合分析", "比较"];
  // 局部问题特征：包含具体实体名称（短问题、专有名词）

  const isGlobal = globalKeywords.some(kw => query.includes(kw));
  const isLocal = !isGlobal || query.length < 30;

  return { isGlobal, isLocal };
}
```

也可以后续升级为 LLM 判断（用 `generateObject` 分类查询意图）。

**产出文件：**
- `src/lib/graph/search.ts`（新增）
- `src/lib/graph/intent.ts`（新增）
- `src/lib/rag/search.ts`（修改：融合图谱检索结果）

---

### 第 G7 步：对话集成（图谱增强的 Prompt 构建）

**目标：** 在对话 API 中集成图谱上下文，优化 Prompt 构建

#### G7.1 对话 API 改造

**修改文件：** `src/app/api/chat/route.ts`

```typescript
export async function POST(req: Request) {
  // ... 已有逻辑 ...

  // 新增：判断查询意图
  const intent = await detectQueryIntent(message);

  // 修改：混合检索（启用 GraphRAG）
  const sources = await hybridSearch(message, userId, 5, {
    enableGraphRAG: true,
  });

  // 新增：获取图谱上下文
  let graphContext = "";
  if (intent.isGlobal) {
    const globalResults = await graphGlobalSearch(message, userId, 3);
    graphContext += "\n\n【全局知识图谱摘要】\n" +
      globalResults.map(r => r.content).join("\n\n");
  }
  if (intent.isLocal) {
    const localResults = await graphLocalSearch(message, userId, 5);
    graphContext += "\n\n【实体关系图谱】\n" +
      localResults.map(r => `- ${r.content}`).join("\n");
  }

  // 修改：构建增强的 system prompt
  const systemPrompt = `你是一个知识助手。基于以下检索到的文档片段和知识图谱信息回答用户问题。
如果文档和图谱中没有相关信息，请诚实说明。
优先使用文档片段中的具体信息，用知识图谱提供的全局视角和实体关系来补充上下文。

${vectorContext}
${graphContext}`;

  // ... streamText 流式生成 ...
}
```

#### G7.2 来源引用扩展

在聊天消息的 `sources` 中区分信息来源类型：

```typescript
interface SourceRef {
  type: "document" | "graph_entity" | "graph_community";
  content: string;
  filename?: string;        // 文档来源
  chunkIndex?: number;       // 文档来源
  entities?: string[];       // 图谱来源
  communityTitle?: string;   // 社区来源
  score: number;
}
```

**产出文件：**
- `src/app/api/chat/route.ts`（修改）
- `src/components/chat/source-refs.tsx`（修改：区分来源类型展示）

---

### 第 G8 步：前端图谱可视化与管理

**目标：** 在知识库页面添加图谱管理入口 + 知识图谱可视化

#### G8.1 图谱管理面板

**新增文件：** `src/app/(main)/knowledge/graph/page.tsx`

页面布局：
- 顶部统计卡片：实体数、关系数、社区数、已索引文档数
- "重建图谱"按钮（全量重新索引）
- 已索引文档列表，每个文档显示索引状态 + "重新索引"按钮

#### G8.2 知识图谱可视化

**新增文件：** `src/components/knowledge/graph-visualization.tsx`

使用 `sigma.js`（graphology 的配套可视化库）或简单的 D3 force layout 展示知识图谱：

- 节点：实体（按 type 着色）
- 边：关系（粗细按 weight）
- 社区：用颜色区分不同社区
- 交互：点击节点查看详情、缩放、拖拽
- 筛选：按实体类型、社区过滤

**可选依赖：**
```bash
pnpm add sigma graphology-simple-path
```

#### G8.3 文档详情页集成

**修改文件：** `src/app/(main)/knowledge/[id]/page.tsx`

- 添加"图谱索引"按钮（对单个文档触发）
- 显示该文档提取出的实体和关系列表
- 图谱索引状态标识

**产出文件：**
- `src/app/(main)/knowledge/graph/page.tsx`（新增）
- `src/components/knowledge/graph-visualization.tsx`（新增）
- `src/app/(main)/knowledge/[id]/page.tsx`（修改）

---

### 第 G9 步：图谱索引进度与状态管理

**目标：** 图谱索引是异步耗时操作，需要进度反馈和状态管理

#### G9.1 索引任务状态

**方案：** 在 `KnowledgeDocument` 上扩展字段

```prisma
model KnowledgeDocument {
  // ... 已有字段 ...
  graphIndexed   Boolean   @default(false)
  graphIndexing  Boolean   @default(false)   // 正在索引中
  graphError     String?                      // 索引失败原因
  graphIndexedAt DateTime?                    // 最后索引时间
}
```

#### G9.2 前端进度反馈

- 文档列表中显示图谱索引状态图标（未索引 / 索引中 / 已完成 / 失败）
- 索引中时显示 spinner + 进度百分比（如果可估算）
- 失败时显示错误信息 + 重试按钮

#### G9.3 后台任务管理

图谱索引可能耗时较长（取决于文档切片数量），考虑：
- 使用 Next.js 的 Background Functions 或自定义 Worker
- 前端通过轮询或 SSE 获取索引进度
- 支持取消正在进行的索引任务

**产出文件：**
- `prisma/schema.prisma`（修改：KnowledgeDocument 扩展字段）
- `src/components/knowledge/document-list.tsx`（修改：显示索引状态）

---

## 6. 与现有 RAG 管线的整合关系

```
                    文档上传
                       │
              ┌────────┼────────┐
              ▼        ▼        ▼
          文本切片   向量化    图谱索引
         (已有)    (已有)    (新增 G2-G4)
              │        │        │
              ▼        ▼        ▼
         Knowledge  pgvector  GraphEntity
          Chunk    (已有)    GraphRelationship
         (已有)              GraphCommunity
                             GraphCommunityReport
                                │
              ┌────────┼────────┘
              ▼        ▼        ▼
           向量检索  BM25检索  图谱检索
           (已有)   (已有)   (新增 G6)
              │        │        │
              └────────┼────────┘
                       ▼
                  RRF 融合 + Rerank
                       │
                       ▼
              增强的 Prompt 构建
            (向量上下文 + 图谱上下文)
                       │
                       ▼
                streamText 流式生成
```

---

## 7. 成本与性能考量

### 7.1 LLM Token 消耗

| 操作 | 输入 tokens/次 | 输出 tokens/次 | 频率 |
|------|---------------|---------------|------|
| 实体提取 | ~500 | ~200 | 每个切片 1 次 |
| 关系提取 | ~600 | ~300 | 每个切片 1 次 |
| 社区摘要 | ~1000 | ~400 | 每个社区 1 次 |
| 实体向量化 | - | - | 每个实体 1 次（embedding API） |
| 摘要向量化 | - | - | 每个报告 1 次（embedding API） |

**典型文档（20 个切片，预计 50 个实体，5 个社区）：**
- 索引阶段：约 39,000 tokens（约 ¥0.03-0.06）
- 查询阶段：每次查询额外约 2,000-5,000 tokens（图谱上下文注入 prompt）

### 7.2 索引耗时

| 阶段 | 预估耗时 | 说明 |
|------|----------|------|
| 实体+关系提取 | 2-5 秒/切片 | DashScope API 响应时间 |
| 社区检测 | < 100ms | 内存运算（graphology） |
| 社区摘要生成 | 3-8 秒/社区 | LLM 生成时间 |
| 实体向量化 | 1-2 秒/批次 | embedding API 批量调用 |
| **单文档总计** | **1-3 分钟** | 20 个切片 + 5 个社区 |

### 7.3 优化策略

- **增量索引**：新文档上传后只提取该文档的实体/关系，与已有图谱合并（实体匹配 + 关系追加），避免全量重建
- **缓存策略**：相同内容的切片（MD5 一致）复用已提取的实体/关系
- **并发控制**：同一用户同时最多 3 个文档进行图谱索引
- **LazyGraphRAG 模式**：对低优先级文档只做实体/关系提取，跳过社区检测和摘要生成，后续按需补充

---

## 8. 文件产出汇总

### 新增文件（约 15 个）

| 文件路径 | 职责 |
|----------|------|
| `src/lib/graph/prompts.ts` | LLM Prompt 模板 |
| `src/lib/graph/schemas.ts` | zod 结构化输出 Schema |
| `src/lib/graph/extractor.ts` | 实体/关系提取服务 |
| `src/lib/graph/indexer.ts` | 图谱索引编排器 |
| `src/lib/graph/builder.ts` | graphology 图构建 |
| `src/lib/graph/community.ts` | Louvain 社区检测 |
| `src/lib/graph/reporter.ts` | 社区摘要生成 |
| `src/lib/graph/search.ts` | 图谱检索（Local + Global） |
| `src/lib/graph/intent.ts` | 查询意图识别 |
| `src/app/api/knowledge/[id]/graph-index/route.ts` | 单文档图谱索引 API |
| `src/app/api/knowledge/graph-rebuild/route.ts` | 全量重建 API |
| `src/app/api/knowledge/graph-stats/route.ts` | 图谱统计 API |
| `src/app/(main)/knowledge/graph/page.tsx` | 图谱管理+可视化页面 |
| `src/components/knowledge/graph-visualization.tsx` | 图谱可视化组件 |

### 修改文件（约 5 个）

| 文件路径 | 修改内容 |
|----------|----------|
| `prisma/schema.prisma` | 新增 4 个 GraphRAG 模型 + KnowledgeDocument 扩展 |
| `src/lib/rag/search.ts` | hybridSearch 融合图谱检索结果 |
| `src/app/api/chat/route.ts` | 集成图谱上下文到 Prompt |
| `src/app/api/knowledge/upload/route.ts` | 可选自动触发图谱索引 |
| `src/components/chat/source-refs.tsx` | 区分来源类型展示 |

### 新增依赖

| 包名 | 用途 |
|------|------|
| `graphology` | 图数据结构 |
| `graphology-communities-louvain` | Louvain 社区检测 |
| `graphology-metrics` | 图论指标（度、中心性等） |
| `graphology-types` | TypeScript 类型 |
| `sigma`（可选） | 图谱可视化 |

---

## 9. 推荐实施顺序

```
G1：图谱基础设施（Prompt + Schema）
  ↓
G2：实体与关系提取（核心 LLM 能力）
  ↓
G3：图构建 + 社区检测（graphology 集成）
  ↓
G4：社区摘要生成（完成索引管线）
  ↓
G5：索引 API + 文档上传集成（可触发索引）
  ↓
G6：图谱检索 Local + Global（核心检索能力）
  ↓
G7：对话集成（图谱增强 Prompt）
  ↓
G8：前端可视化与管理
  ↓
G9：索引进度与状态管理（收尾）
```

建议分两周完成：第一周 G1-G5（索引管线），第二周 G6-G9（检索+前端）。
