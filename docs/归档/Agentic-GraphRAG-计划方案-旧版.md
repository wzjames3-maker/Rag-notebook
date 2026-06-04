# RAG NoteBook — Agentic GraphRAG 开发计划

> **Agentic RAG + GraphRAG + 笔记管理** 三位一体的智能知识助手。
> Agent 是大脑，GraphRAG 是长期记忆，传统 RAG 是短期工作记忆。

---

## 1. 核心理念：为什么是 Agentic + GraphRAG

### 1.1 传统 RAG 的局限

```
用户提问 → 固定管线（向量+BM25→RRF→Rerank）→ LLM 生成
```

问题在于：检索策略是**硬编码**的。无论用户问什么，系统都走同一套流程。当用户问"A 和 B 有什么关系？"时，系统只会返回与 A、B 语义最接近的文档片段，而无法沿着关系链路进行**多跳推理**。当用户问"整个知识库讲了什么？"时，系统无法给出全局视角。

### 1.2 Agentic RAG 的升级

```
用户提问 → Agent（LLM）分析意图 → 自主选择和调用工具
         → 评估结果是否充分 → 不够则追加调用/调整策略
         → 充分则综合所有信息生成回答
```

Agent 拥有多个"工具"（向量搜索、BM25 搜索、图谱遍历、社区摘要、笔记搜索等），它像一个研究员一样：**先想清楚要找什么，再决定用什么方法找，找到后还要判断够不够**。

### 1.3 GraphRAG 的角色

知识图谱是 Agent 的**结构化长期记忆**：

- **实体关系网络**：让 Agent 能回答"A 和 B 是什么关系"这类多跳问题
- **社区摘要**：让 Agent 能快速获得全局视角，回答"整体趋势"类问题
- **增量演化**：随着文档不断增加，图谱持续丰富，Agent 的"知识"越来越深

### 1.4 三者的融合关系

```
┌─────────────────────────────────────────────────────────┐
│                    用户提问                                │
│                      │                                    │
│                      ▼                                    │
│              ┌──────────────┐                             │
│              │   Agent 大脑  │  ← 分析意图、规划策略         │
│              │   (LLM)      │  ← 评估结果、迭代推理         │
│              └──────┬───────┘                             │
│                     │ 调用工具                             │
│       ┌─────────┬───┴────┬──────────┬──────────┐         │
│       ▼         ▼        ▼          ▼          ▼         │
│   ┌────────┐ ┌──────┐ ┌──────┐ ┌───────┐ ┌────────┐     │
│   │向量搜索│ │BM25  │ │图谱  │ │社区   │ │笔记    │     │
│   │(pgvec) │ │(orama│ │遍历  │ │摘要   │ │管理    │     │
│   │        │ │)     │ │      │ │       │ │        │     │
│   └────────┘ └──────┘ └──────┘ └───────┘ └────────┘     │
│   短期工作记忆   短期工作记忆   长期结构化记忆   长期全局记忆  用户知识库│
│                                                        │
│                     │ 返回结果                            │
│                     ▼                                    │
│              ┌──────────────┐                             │
│              │ Agent 评估   │ → 不够？→ 继续调用工具       │
│              │ 结果充分性   │ → 够了？→ 综合生成回答       │
│              └──────────────┘                             │
└─────────────────────────────────────────────────────────┘
```

---

## 2. Agent 工具集设计

Agent 通过 Vercel AI SDK 的 `tool()` 函数定义工具，通过 `streamText` + `maxSteps` 实现多步推理循环。

### 2.1 工具总览

| 工具名 | 类别 | 功能 | 何时使用 |
|--------|------|------|----------|
| `vector_search` | 检索 | 知识库语义向量搜索 | 需要找到语义相关的文档片段 |
| `keyword_search` | 检索 | 知识库 BM25 全文搜索 | 需要精确关键词匹配 |
| `graph_explore` | 图谱 | 从实体出发遍历邻居关系 | 需要理解实体间关系 |
| `graph_search` | 图谱 | 在图谱中搜索相关实体 | 需要找到特定实体的信息 |
| `community_summary` | 图谱 | 获取社区摘要报告 | 需要全局/宏观视角 |
| `search_notes` | 笔记 | 搜索用户笔记 | 需要查找用户自己的记录 |
| `create_note` | 笔记 | 创建新笔记 | 用户要求记录/保存信息 |
| `build_graph` | 管理 | 触发文档图谱索引 | 用户要求更新知识图谱 |
| `get_time` | 工具 | 获取当前时间 | 涉及时效性的问题 |

### 2.2 各工具详细定义

#### `vector_search` — 语义向量搜索

```typescript
import { tool } from "ai";
import { z } from "zod";

const vectorSearchTool = tool({
  description: `在知识库中进行语义向量搜索。
    适用于查找与查询语义相关的文档片段。
    当需要理解概念含义、查找相关内容时使用此工具。
    返回结果包含来源文件名和内容片段。`,
  inputSchema: z.object({
    query: z.string().describe("搜索查询，使用自然语言描述你要找的信息"),
    topK: z.number().min(1).max(20).default(10).describe("返回结果数量"),
  }),
  execute: async ({ query, topK }) => {
    const session = await auth();
    const results = await vectorSearch(query, session.user.id, topK);
    return {
      results: results.map(r => ({
        content: r.content,
        filename: r.filename,
        chunkIndex: r.chunkIndex,
        relevanceScore: r.score,
      })),
    };
  },
});
```

#### `keyword_search` — BM25 全文搜索

```typescript
const keywordSearchTool = tool({
  description: `在知识库中进行关键词全文搜索（BM25）。
    适用于精确匹配特定术语、名称、代码等。
    当你需要找到包含特定关键词的文档时使用此工具。
    与 vector_search 互补：vector_search 理解语义，keyword_search 精确匹配。`,
  inputSchema: z.object({
    query: z.string().describe("搜索关键词"),
    topK: z.number().min(1).max(20).default(10),
  }),
  execute: async ({ query, topK }) => {
    const session = await auth();
    const results = await bm25Search(query, session.user.id, topK);
    return { results };
  },
});
```

#### `graph_explore` — 图谱关系遍历（核心工具）

```typescript
const graphExploreTool = tool({
  description: `从知识图谱中的某个实体出发，探索它与其他实体的关系。
    适用于回答"X 和 Y 有什么关系"、"X 涉及哪些方面"、"列出与 X 相关的所有信息"这类问题。
    这个工具能沿着关系链路进行多跳推理，发现文档片段中看不到的隐含关系。
    返回实体的邻居关系和描述。`,
  inputSchema: z.object({
    entityName: z.string().describe("要探索的实体名称"),
    hops: z.number().min(1).max(3).default(1).describe("遍历跳数，1=直接关系，2=间接关系"),
    relationFilter: z.string().optional().describe("可选的关系类型过滤"),
  }),
  execute: async ({ entityName, hops, relationFilter }) => {
    const session = await auth();
    const result = await graphExplore(entityName, session.user.id, hops, relationFilter);
    return result;
  },
});
```

**`graphExplore` 实现逻辑：**

```typescript
async function graphExplore(
  entityName: string,
  userId: string,
  hops: number,
  relationFilter?: string
) {
  // 1. 模糊匹配实体名称（支持别名/部分匹配）
  const entity = await prisma.graphEntity.findFirst({
    where: {
      userId,
      name: { contains: entityName, mode: "insensitive" },
    },
  });
  if (!entity) {
    return { found: false, message: `未找到实体 "${entityName}"` };
  }

  // 2. 逐跳遍历
  const visited = new Set<string>();
  const relations: any[] = [];
  let currentEntityIds = [entity.id];
  visited.add(entity.id);

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
      relations.push({
        hop: hop + 1,
        source: rel.sourceEntity.name,
        sourceType: rel.sourceEntity.type,
        relation: rel.type,
        target: rel.targetEntity.name,
        targetType: rel.targetEntity.type,
        description: rel.description,
        weight: rel.weight,
      });
      // 收集下一跳的实体
      const otherId = rel.sourceEntityId === entity.id
        ? rel.targetEntityId : rel.sourceEntityId;
      if (!visited.has(otherId)) {
        visited.add(otherId);
        nextEntityIds.push(otherId);
      }
    }
    currentEntityIds = nextEntityIds;
  }

  return {
    found: true,
    entity: { name: entity.name, type: entity.type, description: entity.description },
    relations,
    totalRelations: relations.length,
  };
}
```

#### `graph_search` — 图谱实体搜索

```typescript
const graphSearchTool = tool({
  description: `在知识图谱中搜索特定实体或概念。
    返回匹配的实体及其类型、描述和所属社区信息。
    适用于：需要确认某个概念/人物/技术是否在知识库中存在，
    或需要快速获取某个实体的概要信息。`,
  inputSchema: z.object({
    query: z.string().describe("要搜索的实体名称或概念"),
    entityType: z.string().optional().describe("可选的实体类型过滤：PERSON, ORGANIZATION, CONCEPT, TECHNOLOGY 等"),
    topK: z.number().min(1).max(10).default(5),
  }),
  execute: async ({ query, entityType, topK }) => {
    const session = await auth();
    // 语义匹配：使用 embedding 相似度
    const queryEmbedding = await embedText(query);
    const entities = await prisma.$queryRaw`
      SELECT id, name, type, description, "communityId", degree,
             1 - (embedding <=> ${queryVector}) as score
      FROM "GraphEntity"
      WHERE "userId" = ${session.user.id}
        AND (${entityType}::text IS NULL OR type = ${entityType})
      ORDER BY embedding <=> ${queryVector}
      LIMIT ${topK}
    `;
    return { entities };
  },
});
```

#### `community_summary` — 社区摘要（全局视角）

```typescript
const communitySummaryTool = tool({
  description: `获取知识图谱的社区摘要报告，提供全局/宏观视角。
    社区是对知识图谱的聚类分析结果，每个社区代表一个主题领域。
    适用于：回答"知识库主要讲了什么"、"有哪些主题"、"整体趋势是什么"等全局性问题。
    也适用于需要综合多个文档的主题信息时。`,
  inputSchema: z.object({
    query: z.string().describe("你想了解的全局主题或问题"),
    topK: z.number().min(1).max(5).default(3).describe("返回最相关的社区数量"),
  }),
  execute: async ({ query, topK }) => {
    const session = await auth();
    const queryEmbedding = await embedText(query);
    const reports = await prisma.$queryRaw`
      SELECT gcr.id, gcr.title, gcr.summary, gcr."keyFindings", gcr.rating,
             gc.size as entityCount, gc.level,
             1 - (gcr.embedding <=> ${queryVector}) as score
      FROM "GraphCommunityReport" gcr
      JOIN "GraphCommunity" gc ON gcr."communityId" = gc.id
      WHERE gcr."userId" = ${session.user.id}
      ORDER BY gcr.embedding <=> ${queryVector}
      LIMIT ${topK}
    `;
    return { communities: reports };
  },
});
```

#### `search_notes` — 笔记搜索

```typescript
const searchNotesTool = tool({
  description: `搜索用户的笔记。可以在笔记标题和内容中查找关键词。
    适用于：用户问"我之前记录过XX吗"、"我的笔记里有没有关于XX的内容"。`,
  inputSchema: z.object({
    query: z.string().describe("搜索关键词"),
    category: z.enum(["WORK", "STUDY", "LIFE", "PROJECT"]).optional(),
    topK: z.number().min(1).max(10).default(5),
  }),
  execute: async ({ query, category, topK }) => {
    const session = await auth();
    const notes = await prisma.note.findMany({
      where: {
        userId: session.user.id,
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
    return { notes: notes.map(n => ({ ...n, content: n.content.substring(0, 500) })) };
  },
});
```

#### `create_note` — 创建笔记

```typescript
const createNoteTool = tool({
  description: `为用户创建一篇新笔记。
    适用于：用户要求"帮我记录一下"、"把这段对话保存为笔记"、"创建一个关于XX的笔记"。
    创建成功后笔记会出现在用户的笔记列表中。`,
  inputSchema: z.object({
    title: z.string().describe("笔记标题"),
    content: z.string().describe("笔记内容（Markdown 格式）"),
    category: z.enum(["WORK", "STUDY", "LIFE", "PROJECT"]).default("WORK"),
    tags: z.array(z.string()).default([]),
  }),
  execute: async ({ title, content, category, tags }) => {
    const session = await auth();
    const note = await prisma.note.create({
      data: { userId: session.user.id, title, content, category, tags },
    });
    return { success: true, noteId: note.id, title: note.title };
  },
});
```

#### `build_graph` — 触发图谱构建

```typescript
const buildGraphTool = tool({
  description: `为知识库中的文档构建知识图谱索引。
    这会从文档中提取实体和关系，构建图谱并生成社区摘要。
    适用于：用户要求"更新知识图谱"、"索引文档"。
    注意：图谱构建需要消耗 LLM token，构建时间约 1-3 分钟/文档。`,
  inputSchema: z.object({
    documentId: z.string().optional().describe("指定文档 ID，不传则索引所有未索引文档"),
  }),
  execute: async ({ documentId }) => {
    const session = await auth();
    // 触发异步图谱索引任务
    // 返回任务 ID，前端可轮询进度
    const task = await triggerGraphIndex(session.user.id, documentId);
    return { taskId: task.id, status: "processing", message: "图谱索引任务已启动" };
  },
});
```

#### `get_time` — 当前时间

```typescript
const getTimeTool = tool({
  description: "获取当前日期和时间。适用于涉及时效性的问题。",
  inputSchema: z.object({}),
  execute: async () => ({
    datetime: new Date().toISOString(),
    timezone: "Asia/Shanghai",
  }),
});
```

---

## 3. Agent 对话 API 实现

### 3.1 核心对话端点

**文件：** `src/app/api/agent-chat/route.ts`

```typescript
import { streamText, stepCountIs } from "ai";
import { chatModel } from "@/lib/ai/dashscope";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
// 导入所有工具
import {
  vectorSearchTool, keywordSearchTool,
  graphExploreTool, graphSearchTool, communitySummaryTool,
  searchNotesTool, createNoteTool,
  buildGraphTool, getTimeTool,
} from "@/lib/agent/tools";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const userId = session.user.id;
  const { message, sessionId } = await req.json();

  // 1. 获取或创建会话
  let sid = sessionId;
  if (!sid) {
    const chatSession = await prisma.chatSession.create({
      data: { userId, title: message.substring(0, 50) },
    });
    sid = chatSession.id;
  }

  // 2. 保存用户消息
  await prisma.chatMessage.create({
    data: { sessionId: sid, role: "USER", content: message },
  });

  // 3. 获取对话历史（最近 10 轮）
  const history = await prisma.chatMessage.findMany({
    where: { sessionId: sid },
    orderBy: { createdAt: "asc" },
    take: 20,
  });

  // 4. 获取图谱状态信息（告诉 Agent 图谱是否已构建）
  const graphStats = await prisma.graphEntity.count({ where: { userId } });
  const hasGraph = graphStats > 0;

  // 5. Agent 对话（流式 + 多步推理）
  const result = streamText({
    model: chatModel,
    maxSteps: 5,  // 最多 5 步推理循环
    stopWhen: stepCountIs(5),

    system: buildSystemPrompt(hasGraph),

    messages: [
      ...history.map(m => ({
        role: m.role.toLowerCase() as "user" | "assistant",
        content: m.content,
      })),
      { role: "user", content: message },
    ],

    // 注册所有工具
    tools: {
      vector_search: vectorSearchTool,
      keyword_search: keywordSearchTool,
      graph_explore: graphExploreTool,
      graph_search: graphSearchTool,
      community_summary: communitySummaryTool,
      search_notes: searchNotesTool,
      create_note: createNoteTool,
      build_graph: buildGraphTool,
      get_time: getTimeTool,
    },

    // 完成回调：持久化助手消息
    onFinish: async ({ text, steps }) => {
      // 收集所有工具调用信息作为 sources
      const toolCalls = steps.flatMap(s =>
        s.toolCalls?.map(tc => ({
          toolName: tc.toolName,
          args: tc.args,
          result: tc.result,
        })) || []
      );

      await prisma.chatMessage.create({
        data: {
          sessionId: sid,
          role: "ASSISTANT",
          content: text,
          sources: JSON.stringify({ toolCalls, answer: text }),
        },
      });
    },
  });

  return result.toDataStreamResponse();
}
```

### 3.2 System Prompt 设计

```typescript
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
- 使用 Markdown 格式组织回答（标题、列表、代码块等）
`;
}
```

---

## 4. Agent 推理过程示例

### 示例 1：简单事实查询

```
用户：DashScope 的 embedding 模型是什么？

Agent 思考：这是一个关于特定技术的事实查询，需要语义搜索。
→ 调用 vector_search({ query: "DashScope embedding 模型", topK: 5 })
→ 返回结果包含 "text-embedding-v3 模型，1536 维" 的文档片段

Agent 思考：信息已充分，可以回答。
→ 生成回答："根据知识库文档，DashScope 使用 text-embedding-v3 模型..."
   [来源：tech_stack.md, chunk 3]
```

### 示例 2：关系推理（多跳）

```
用户：pgvector 和 orama 在这个项目中分别起什么作用？它们之间有联系吗？

Agent 思考：需要找到两个实体的信息及其关系，先语义搜索，再图谱遍历。
→ 调用 vector_search({ query: "pgvector 和 orama 的作用", topK: 5 })
→ 调用 graph_explore({ entityName: "pgvector", hops: 2 })
→ 调用 graph_explore({ entityName: "orama", hops: 2 })

Agent 观察：向量搜索返回了混合检索的文档片段，图谱显示了它们都连接到"混合检索"实体。
Agent 思考：信息已充分。
→ 生成回答：
   "pgvector 负责向量检索（语义相似度），orama 负责 BM25 全文检索（关键词匹配）。
    它们通过 RRF（Reciprocal Rank Fusion）算法融合结果，共同构成本项目的混合检索系统。
    [来源：rag/search.ts 文档 + 图谱关系：pgvector → 服务于 → 混合检索 ← 服务于 ← orama]"
```

### 示例 3：全局性问题

```
用户：这个知识库主要涵盖了哪些技术领域？

Agent 思考：这是全局性问题，需要社区摘要提供宏观视角。
→ 调用 community_summary({ query: "知识库技术领域概览", topK: 5 })

Agent 观察：返回了 5 个社区摘要，涵盖 RAG、AI SDK、知识管理等领域。
Agent 思考：补充一下具体文档信息。
→ 调用 vector_search({ query: "技术架构和核心组件", topK: 5 })

Agent 思考：信息充分了。
→ 生成综合性回答，从全局到细节。
```

### 示例 4：笔记管理 + 知识整合

```
用户：帮我把刚才讨论的 GraphRAG 要点整理成一篇笔记

Agent 思考：需要从对话历史中提取信息，并创建笔记。
→ 调用 create_note({
    title: "GraphRAG 讨论要点",
    content: "## 核心概念\n...",
    category: "STUDY",
    tags: ["GraphRAG", "知识图谱", "RAG"]
  })

→ 回答："已为你创建笔记《GraphRAG 讨论要点》，分类为'学习'，
   添加了 GraphRAG、知识图谱、RAG 三个标签。你可以在笔记列表中查看和编辑。"
```

---

## 5. 图谱索引管线

图谱索引是 `build_graph` 工具背后的实现，与上一版 GRAPHRAG_PLAN.md 中的 G1-G5 步骤一致。这里只概述关键差异。

### 5.1 与 GRAPHRAG_PLAN 的复用

| 步骤 | 内容 | 来源 |
|------|------|------|
| 数据模型 | GraphEntity / GraphRelationship / GraphCommunity / GraphCommunityReport | GRAPHRAG_PLAN 第 4 节 |
| 实体提取 | LLM + zod 结构化输出 | GRAPHRAG_PLAN 第 G2 步 |
| 关系提取 | LLM + zod 结构化输出 | GRAPHRAG_PLAN 第 G2 步 |
| 图构建 | graphology 内存图 | GRAPHRAG_PLAN 第 G3 步 |
| 社区检测 | Louvain 算法 | GRAPHRAG_PLAN 第 G3 步 |
| 社区摘要 | LLM 生成 + 向量化 | GRAPHRAG_PLAN 第 G4 步 |
| 图谱索引 API | 单文档/全量/统计 | GRAPHRAG_PLAN 第 G5 步 |

### 5.2 增量索引优化

在 Agentic 模式下，图谱索引应该是**增量**的：

```
新文档上传 → 提取该文档的实体和关系
           → 与已有图谱合并：
             → 新实体：直接添加
             → 已有实体：合并描述（取更长的）
             → 新关系：添加
             → 已有关系：累加权重
           → 重新运行社区检测（仅受影响的子图）
           → 重新生成受影响的社区摘要
```

这样用户可以随时 `build_graph`，不需要每次全量重建。

---

## 6. 前端实现

### 6.1 对话页面改造

**修改文件：** `src/app/(main)/chat/page.tsx`

核心变化：使用 Vercel AI SDK 的 `useChat` hook，支持工具调用结果的流式展示。

```typescript
const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
  api: "/api/agent-chat",  // Agent 对话端点
  body: { sessionId: currentSessionId },
  maxSteps: 5,             // 前端也要设置 maxSteps
});
```

### 6.2 工具调用展示组件

**新增文件：** `src/components/chat/tool-call-display.tsx`

Agent 调用工具时，前端需要展示"Agent 正在做什么"：

```
┌─────────────────────────────────────────────┐
│ 🔍 正在搜索知识库...                          │
│   vector_search("DashScope embedding 模型")  │
│   ✅ 找到 5 条相关结果                        │
├─────────────────────────────────────────────┤
│ 🔗 正在探索实体关系...                        │
│   graph_explore("pgvector", hops=2)          │
│   ✅ 发现 8 条关系链路                        │
├─────────────────────────────────────────────┤
│ 📝 Agent 回答：                              │
│   根据知识库文档和知识图谱分析...              │
│   [来源：tech_stack.md + 图谱关系]            │
└─────────────────────────────────────────────┘
```

```typescript
interface ToolCallDisplayProps {
  toolName: string;
  args: Record<string, unknown>;
  status: "loading" | "success" | "error";
  result?: unknown;
}

const toolLabels: Record<string, { icon: string; label: string }> = {
  vector_search: { icon: "🔍", label: "语义搜索知识库" },
  keyword_search: { icon: "🔎", label: "关键词搜索知识库" },
  graph_explore: { icon: "🔗", label: "探索实体关系" },
  graph_search: { icon: "🏷️", label: "搜索知识图谱" },
  community_summary: { icon: "📊", label: "获取社区摘要" },
  search_notes: { icon: "📝", label: "搜索笔记" },
  create_note: { icon: "✏️", label: "创建笔记" },
  build_graph: { icon: "🏗️", label: "构建知识图谱" },
  get_time: { icon: "⏰", label: "获取当前时间" },
};
```

### 6.3 消息渲染增强

**修改文件：** `src/components/chat/message-item.tsx`

助手消息现在可能包含工具调用记录，需要渲染：
- 折叠的工具调用步骤（默认折叠，点击展开查看详情）
- 最终的文本回答（Markdown 渲染）
- 来源标注（区分文档来源 / 图谱来源 / 社区来源）

### 6.4 知识图谱可视化（交互式 2D 图谱）

基于 `sigma.js` + `@react-sigma/core` + `graphology`，构建高性能的 WebGL 图谱可视化界面。

#### 6.4.1 新增依赖

```bash
pnpm add sigma @react-sigma/core @react-sigma/layout-forceatlas2 graphology-layout-forceatlas2
```

#### 6.4.2 图谱数据 API

**新增文件：** `src/app/api/knowledge/graph-data/route.ts`

为可视化提供图谱数据（graphology 可序列化的 JSON 格式）：

```typescript
// GET /api/knowledge/graph-data?communityLevel=0
export async function GET(req: Request) {
  const session = await auth();
  const { communityLevel } = parseQuery(req);

  // 1. 查询实体（节点）
  const entities = await prisma.graphEntity.findMany({
    where: { userId: session.user.id },
    select: {
      id: true, name: true, type: true, description: true,
      degree: true, communityId: true,
    },
  });

  // 2. 查询关系（边）
  const relationships = await prisma.graphRelationship.findMany({
    where: { userId: session.user.id },
    select: {
      id: true, sourceEntityId: true, targetEntityId: true,
      type: true, description: true, weight: true,
    },
  });

  // 3. 查询社区（用于着色）
  const communities = await prisma.graphCommunity.findMany({
    where: { userId: session.user.id, level: communityLevel ?? 0 },
    select: { id: true, size: true },
  });

  // 4. 构建 graphology 兼容的序列化格式
  return NextResponse.json({
    nodes: entities.map(e => ({
      key: e.id,
      attributes: {
        label: e.name,
        type: e.type,
        description: e.description,
        degree: e.degree,
        communityId: e.communityId,
        // sigma.js 使用 x/y/size/color 作为节点属性
        x: Math.random() * 1000,  // ForceAtlas2 会重新布局
        y: Math.random() * 1000,
        size: Math.max(3, Math.min(20, e.degree * 2)),
        color: communityColorMap[e.communityId] || "#999",
      },
    })),
    edges: relationships.map(r => ({
      key: r.id,
      source: r.sourceEntityId,
      target: r.targetEntityId,
      attributes: {
        label: r.type,
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

#### 6.4.3 社区调色板

**新增文件：** `src/lib/graph/colors.ts`

```typescript
// 12 色社区调色板（高区分度，深浅主题兼容）
const PALETTE = [
  "#4E79A7", "#F28E2B", "#E15759", "#76B7B2",
  "#59A14F", "#EDC948", "#B07AA1", "#FF9DA7",
  "#9C755F", "#BAB0AC", "#86BCB6", "#8CD17D",
];

export function getCommunityColor(communityId: string, allCommunityIds: string[]): string {
  const index = allCommunityIds.indexOf(communityId);
  return PALETTE[index % PALETTE.length];
}

// 实体类型 → 图标映射（用于节点标签前缀或 tooltip）
export const entityTypeIcons: Record<string, string> = {
  PERSON: "👤", ORGANIZATION: "🏢", LOCATION: "📍",
  CONCEPT: "💡", EVENT: "📅", TECHNOLOGY: "⚙️",
  PRODUCT: "📦", OTHER: "🔹",
};
```

#### 6.4.4 图谱画布组件

**新增文件：** `src/components/knowledge/graph-canvas.tsx`

核心画布组件，使用 `@react-sigma/core` 的 `SigmaContainer`：

```typescript
"use client";

import { SigmaContainer, useSigma, useRegisterEvents } from "@react-sigma/core";
import { useLayoutForceAtlas2 } from "@react-sigma/layout-forceatlas2";
import Graph from "graphology";
import { useEffect, useState, useCallback } from "react";

interface GraphCanvasProps {
  graphData: {
    nodes: { key: string; attributes: Record<string, any> }[];
    edges: { key: string; source: string; target: string; attributes: Record<string, any> }[];
  };
  onNodeClick?: (nodeId: string, nodeData: any) => void;
  onNodeHover?: (nodeId: string | null) => void;
}

// 内部组件：加载图数据 + 布局 + 事件
function GraphContent({ graphData, onNodeClick, onNodeHover }: GraphCanvasProps) {
  const sigma = useSigma();
  const graph = sigma.getGraph();
  const { assign: assignLayout } = useLayoutForceAtlas2({ iterations: 100 });
  const registerEvents = useRegisterEvents();

  // 加载图数据
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
    // 运行 ForceAtlas2 布局
    assignLayout();
  }, [graphData]);

  // 注册交互事件
  useEffect(() => {
    registerEvents({
      clickNode: (e) => {
        const nodeData = graph.getNodeAttributes(e.node);
        onNodeClick?.(e.node, nodeData);
      },
      enterNode: (e) => {
        onNodeHover?.(e.node);
        // 高亮当前节点及其邻居
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

// 高亮节点及邻居
function highlightNodeAndNeighbors(graph: Graph, nodeId: string) {
  const neighbors = new Set(graph.neighbors(nodeId));
  neighbors.add(nodeId);

  graph.forEachNode((n, attrs) => {
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

// 节点渲染器：处理高亮/淡化效果
function nodeReducer(node: string, data: any) {
  const res = { ...data };
  if (data.reduced) {
    res.color = "#ddd";
    res.label = "";
    res.size = data.size * 0.6;
  }
  if (data.highlighted) {
    res.size = data.size * 1.4;
    res.zIndex = 1;
  }
  return res;
}

// 主组件
export default function GraphCanvas(props: GraphCanvasProps) {
  return (
    <div className="relative w-full h-full min-h-[500px] rounded-lg border bg-background overflow-hidden">
      <SigmaContainer
        style={{ width: "100%", height: "100%" }}
        settings={{
          nodeReducer,
          renderLabels: true,
          labelRenderedSizeThreshold: 6,  // 只在节点够大时显示标签
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

#### 6.4.5 节点详情面板

**新增文件：** `src/components/knowledge/graph-node-detail.tsx`

点击节点后右侧弹出详情面板：

```
┌─────────────────────────────────────┐
│ 👤 Next.js (TECHNOLOGY)              │
│                                     │
│ Next.js 是一个 React 全栈框架...    │
│                                     │
│ ── 关系 (8) ──────────────────────  │
│ → 使用    React (TECHNOLOGY)        │
│ → 集成    Vercel AI SDK (TECH)      │
│ → 搭配    Prisma (TECHNOLOGY)       │
│ → 服务于  RAG NoteBook (PRODUCT)    │
│ ← 依赖    PostgreSQL (TECHNOLOGY)   │
│ ← 搭配    shadcn/ui (TECHNOLOGY)    │
│ → 使用    NextAuth (TECHNOLOGY)     │
│ ← 运行于  Docker (TECHNOLOGY)       │
│                                     │
│ ── 来源文档 ──────────────────────  │
│ 📄 tech_stack.md                    │
│ 📄 implementation_plan.md           │
│                                     │
│ [在图谱中展开 2 跳] [查看相关文档]   │
└─────────────────────────────────────┘
```

```typescript
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
    description: string;
  }[];
  sourceDocuments: { filename: string; documentId: string }[];
  onClose: () => void;
}
```

#### 6.4.6 控制栏组件

**新增文件：** `src/components/knowledge/graph-controls.tsx`

图谱画布上方的控制工具栏：

```
┌──────────────────────────────────────────────────────────────────────┐
│ 🔍 [搜索实体...]  │ 类型筛选 ▼  │ 社区筛选 ▼  │ 布局 ▶ ⏸ 🔄 │ 缩放 +− │
└──────────────────────────────────────────────────────────────────────┘
```

功能：
- **搜索框**：输入实体名称 → 定位并高亮匹配的节点
- **类型筛选**：多选下拉 → 只显示特定类型的实体（PERSON / TECH / CONCEPT...）
- **社区筛选**：下拉 → 只显示特定社区的实体和关系
- **布局控制**：启动/暂停/重置 ForceAtlas2 布局动画
- **缩放控制**：放大/缩小/适应画布

#### 6.4.7 图谱页面整合

**新增文件：** `src/app/(main)/knowledge/graph/page.tsx`

```
┌────────────────────────────────────────────────────────────────────┐
│ 📊 知识图谱                                    实体: 156  关系: 342 │
├────────────────────────────────────────────────────────────────────┤
│ [控制栏]                                                           │
├───────────────────────────────────────┬────────────────────────────┤
│                                       │                            │
│                                       │   [节点详情面板]            │
│         [图谱画布]                     │                            │
│      sigma.js WebGL 渲染              │   点击节点后显示            │
│      ForceAtlas2 自动布局             │                            │
│      节点按社区着色                    │                            │
│      边粗细按权重                      │                            │
│                                       │                            │
│                                       │                            │
├───────────────────────────────────────┴────────────────────────────┤
│ 统计：6 个社区 │ 最大社区 "Web 技术栈" (43 实体) │ 平均度 4.4      │
└────────────────────────────────────────────────────────────────────┘
```

页面组件逻辑：
```typescript
export default function GraphPage() {
  const [graphData, setGraphData] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [nodeRelations, setNodeRelations] = useState([]);
  const [filters, setFilters] = useState({ types: [], community: null, search: "" });

  // 加载图谱数据
  useEffect(() => {
    fetch("/api/knowledge/graph-data").then(r => r.json()).then(setGraphData);
  }, []);

  // 节点点击 → 加载关系详情
  const handleNodeClick = async (nodeId: string) => {
    const res = await fetch(`/api/knowledge/graph-entity/${nodeId}/relations`);
    const data = await res.json();
    setNodeRelations(data.relations);
    setSelectedNode(data.entity);
  };

  // 应用筛选 → 过滤 graphData 后传给 GraphCanvas
  const filteredData = applyFilters(graphData, filters);

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col">
        <GraphControls filters={filters} onChange={setFilters} stats={graphData?.stats} />
        <GraphCanvas graphData={filteredData} onNodeClick={handleNodeClick} />
      </div>
      {selectedNode && (
        <NodeDetailPanel node={selectedNode} relations={nodeRelations} onClose={() => setSelectedNode(null)} />
      )}
    </div>
  );
}
```

#### 6.4.8 实体关系详情 API

**新增文件：** `src/app/api/knowledge/graph-entity/[id]/relations/route.ts`

```typescript
// GET /api/knowledge/graph-entity/[id]/relations
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();

  const entity = await prisma.graphEntity.findUnique({
    where: { id: params.id, userId: session.user.id },
  });

  const relations = await prisma.graphRelationship.findMany({
    where: {
      userId: session.user.id,
      OR: [{ sourceEntityId: params.id }, { targetEntityId: params.id }],
    },
    include: { sourceEntity: true, targetEntity: true },
    orderBy: { weight: "desc" },
  });

  // 查找来源文档（通过 sourceChunkId 关联）
  const sourceDocIds = [...new Set(relations.map(r => r.sourceChunkId).filter(Boolean))];
  const sourceDocs = await prisma.knowledgeChunk.findMany({
    where: { id: { in: sourceDocIds } },
    include: { document: { select: { id: true, filename: true } } },
  });

  return NextResponse.json({
    entity,
    relations: relations.map(r => ({
      direction: r.sourceEntityId === params.id ? "outgoing" : "incoming",
      type: r.type,
      targetName: r.sourceEntityId === params.id ? r.targetEntity.name : r.sourceEntity.name,
      targetType: r.sourceEntityId === params.id ? r.targetEntity.type : r.sourceEntity.type,
      description: r.description,
      weight: r.weight,
    })),
    sourceDocuments: [...new Map(sourceDocs.map(d => [d.document.id, d.document]))].map(([, v]) => v),
  });
}
```

#### 6.4.9 导航集成

**修改文件：** `src/components/layout/app-sidebar.tsx`

在侧边栏"知识库"导航项下添加子项：
```
📂 知识库
   ├── 文档列表    /knowledge
   └── 知识图谱    /knowledge/graph  ← 新增
```

#### 6.4.10 响应式适配

- **桌面（≥1280px）**：图谱画布占左侧 70%，节点详情面板占右侧 30%（可折叠）
- **平板（≥768px）**：图谱画布全宽，节点详情以 Sheet 底部弹出
- **手机（<768px）**：图谱画布全宽（双指缩放），节点详情以全屏 Dialog 展示

#### 6.4.11 深色主题适配

- sigma.js 的 `labelColor` 根据 `useTheme()` 动态切换（深色主题白色标签，浅色主题深色标签）
- 节点颜色在深色模式下适当提高亮度
- 边颜色：深色模式 `#555`，浅色模式 `#ddd`
- 背景色跟随 `bg-background` CSS 变量

#### 6.4.12 性能优化

| 策略 | 实现 |
|------|------|
| WebGL 渲染 | sigma.js 原生 WebGL，可流畅渲染万级节点 |
| 标签阈值 | `labelRenderedSizeThreshold: 6`，只在节点够大时才渲染文字 |
| 按需加载 | 筛选时只传过滤后的子图数据给 sigma，而非全量 |
| 布局缓存 | ForceAtlas2 运行完毕后缓存节点坐标，切换筛选后恢复而非重跑 |
| 虚拟边 | 超过 5000 条边时只渲染权重 top 2000 的边 |

### 6.5 图谱管理入口

**修改文件：** `src/app/(main)/knowledge/page.tsx`

在知识库文档列表页添加：
- 顶部"图谱状态"指示器（已索引文档数 / 总文档数 + 实体数 + 关系数）
- "查看图谱"按钮 → 跳转 `/knowledge/graph`
- 每个文档行的"索引图谱"按钮（对单个文档触发 `build_graph`）

用户也可以在对话中直接说"帮我索引这个文档的图谱"，Agent 会调用 `build_graph` 工具。

---

## 7. 数据流全景

### 7.1 一次完整的 Agentic GraphRAG 对话

```
用户："这个项目中，向量检索和图谱检索是怎么配合的？"
  │
  ▼
POST /api/agent-chat
  │
  ├─ Step 1: Agent 思考 → 需要理解项目的检索架构
  │   → 调用 vector_search("向量检索和图谱检索的配合方式")
  │   → 返回 5 条文档片段（关于 hybridSearch、RRF 融合等）
  │
  ├─ Step 2: Agent 评估 → 找到了向量检索的信息，但缺少图谱视角
  │   → 调用 graph_search("向量检索")
  │   → 调用 graph_explore("混合检索", hops=2)
  │   → 返回实体关系：向量检索 → 服务于 → 混合检索 ← 服务于 ← BM25
  │                      混合检索 → 融合于 → RRF
  │                      RRF → 输入给 → LLM Rerank
  │
  ├─ Step 3: Agent 评估 → 信息充分了，可以综合回答
  │   → 生成结构化回答，包含文档引用和图谱关系图
  │
  └─ 持久化 ChatMessage（含 toolCalls 记录）
  │
  ▼
流式返回前端
  ├─ 展示工具调用步骤（可折叠）
  ├─ 展示最终回答
  └─ 展示来源标注
```

### 7.2 对话模式对比

| 维度 | 传统 RAG（现有） | Agentic GraphRAG（新） |
|------|-----------------|----------------------|
| 检索策略 | 固定管线：向量+BM25→RRF→Rerank | Agent 动态决策，按需调用工具 |
| 多跳推理 | 不支持 | 通过 graph_explore 多跳遍历 |
| 全局问题 | 回答质量低 | community_summary 提供全局视角 |
| 笔记联动 | 不支持 | Agent 可搜索/创建笔记 |
| 图谱更新 | 手动触发 API | 对话中直接说"更新图谱" |
| 透明性 | 黑盒检索 | 每步工具调用可见可追溯 |
| 成本 | 固定（每次查询 1 次 LLM） | 可变（1-5 步推理，按需消耗） |
| 延迟 | 较低（~3s） | 较高（~5-15s，多步推理） |

---

## 8. 实施路线

### Phase 1：图谱索引管线（1 周）

复用 GRAPHRAG_PLAN.md 的 G1-G5：

| 步骤 | 内容 | 产出 |
|------|------|------|
| G1 | 安装 graphology + Prompt/Schema 定义 | `src/lib/graph/prompts.ts`, `schemas.ts` |
| G2 | 实体/关系提取（LLM + zod） | `src/lib/graph/extractor.ts`, `indexer.ts` |
| G3 | 图构建 + Louvain 社区检测 | `src/lib/graph/builder.ts`, `community.ts` |
| G4 | 社区摘要生成 + 向量化 | `src/lib/graph/reporter.ts` |
| G5 | 索引 API + 增量索引 | `src/app/api/knowledge/*/route.ts` |

### Phase 2：Agent 工具集 + 对话 API（1 周）

| 步骤 | 内容 | 产出 |
|------|------|------|
| A1 | 实现 9 个工具函数 | `src/lib/agent/tools/*.ts` |
| A2 | Agent 对话 API（streamText + maxSteps） | `src/app/api/agent-chat/route.ts` |
| A3 | System Prompt 调优 | 包含在 A2 中 |
| A4 | 对话历史持久化（含工具调用记录） | 包含在 A2 中 |

### Phase 3：前端集成 + 图谱可视化（1.5 周）

| 步骤 | 内容 | 产出 |
|------|------|------|
| F1 | 工具调用展示组件 | `src/components/chat/tool-call-display.tsx` |
| F2 | 消息渲染增强（多步+来源标注） | `src/components/chat/message-item.tsx` 修改 |
| F3 | 对话页面接入 Agent API | `src/app/(main)/chat/page.tsx` 修改 |
| F4 | sigma.js 图谱画布组件 | `src/components/knowledge/graph-canvas.tsx` |
| F5 | 节点详情面板 + 控制栏 | `graph-node-detail.tsx` + `graph-controls.tsx` |
| F6 | 图谱可视化页面 + 数据 API | `knowledge/graph/page.tsx` + API |
| F7 | 侧边栏导航 + 知识库页集成 | 侧边栏修改 + 知识库页修改 |
| F8 | 深色主题 + 响应式适配 | 各组件样式调整 |

### Phase 4：优化与调优（持续）

| 方向 | 内容 |
|------|------|
| Prompt 调优 | 优化 System Prompt，让 Agent 更准确地选择工具 |
| 工具描述优化 | 根据实际效果调整每个 tool 的 description |
| maxSteps 调优 | 根据实际对话复杂度调整（3-5 步） |
| 缓存策略 | 相同查询缓存工具调用结果，减少重复检索 |
| 成本控制 | 添加 token 用量监控和限制 |
| 并行工具调用 | 让 Agent 同时调用多个独立工具（如 vector + keyword 并行） |

---

## 9. 文件产出汇总

### 新增文件（约 28 个）

```
src/lib/agent/
├── tools/
│   ├── vector-search.ts        # 语义向量搜索工具
│   ├── keyword-search.ts       # BM25 关键词搜索工具
│   ├── graph-explore.ts        # 图谱关系遍历工具
│   ├── graph-search.ts         # 图谱实体搜索工具
│   ├── community-summary.ts    # 社区摘要工具
│   ├── search-notes.ts         # 笔记搜索工具
│   ├── create-note.ts          # 笔记创建工具
│   ├── build-graph.ts          # 图谱构建工具
│   └── get-time.ts             # 时间工具
├── agent-chat.ts               # Agent 对话编排
└── system-prompt.ts            # System Prompt 管理

src/lib/graph/
├── prompts.ts                  # LLM Prompt 模板
├── schemas.ts                  # zod 结构化输出 Schema
├── extractor.ts                # 实体/关系提取服务
├── indexer.ts                  # 图谱索引编排器
├── builder.ts                  # graphology 图构建
├── community.ts                # Louvain 社区检测
├── reporter.ts                 # 社区摘要生成
├── search.ts                   # 图谱检索（Local + Global）
└── colors.ts                   # 社区调色板 + 实体类型图标

src/app/api/
├── agent-chat/route.ts         # Agent 对话 API 端点
└── knowledge/
    ├── graph-data/route.ts     # 图谱可视化数据 API
    └── graph-entity/[id]/
        └── relations/route.ts  # 实体关系详情 API

src/components/knowledge/
├── graph-canvas.tsx            # sigma.js 图谱画布
├── graph-node-detail.tsx       # 节点详情面板
└── graph-controls.tsx          # 图谱控制工具栏

src/app/(main)/knowledge/graph/
└── page.tsx                    # 图谱可视化页面

src/components/chat/
└── tool-call-display.tsx       # 工具调用展示组件
```

### 修改文件（约 6 个）

| 文件 | 修改内容 |
|------|----------|
| `prisma/schema.prisma` | 新增 GraphRAG 模型（4 张表） |
| `src/app/(main)/chat/page.tsx` | 切换到 Agent API + maxSteps |
| `src/components/chat/message-item.tsx` | 支持工具调用步骤渲染 |
| `src/components/chat/source-refs.tsx` | 区分来源类型 |
| `src/components/layout/app-sidebar.tsx` | 新增"知识图谱"导航项 |
| `src/app/(main)/knowledge/page.tsx` | 添加图谱状态指示器+索引按钮 |

### 新增依赖

```bash
# 图处理（索引管线）
pnpm add graphology graphology-communities-louvain graphology-metrics graphology-types

# 图谱可视化（sigma.js + React 集成）
pnpm add sigma @react-sigma/core @react-sigma/layout-forceatlas2 graphology-layout-forceatlas2
```

---

## 10. 与需求文档的对齐

本方案覆盖了需求文档中以下功能项：

| 需求项 | 优先级 | 覆盖情况 |
|--------|--------|----------|
| RAG 对话 + 流式输出 | MVP | ✅ 已有，Agent 模式增强 |
| 混合检索（向量+BM25+RRF） | MVP | ✅ Agent 的 vector_search + keyword_search 工具 |
| LLM 重排序 | MVP | ✅ 可作为 Agent 的内部步骤（可选） |
| 文档来源引用展示 | MVP | ✅ 增强：区分文档/图谱/社区来源 |
| 会话管理 | MVP | ✅ 复用已有会话管理 |
| Agent 对话（4 工具+渐进扩展） | P2 | ✅ 扩展到 9 个工具，覆盖图谱+笔记 |
| AI 写作助手（摘要/续写/扩写） | P2 | 🔮 可作为后续工具扩展添加 |
| 语义搜索（笔记向量化检索） | P1 | 🔮 可作为 search_notes 工具增强 |
| 关联笔记推荐 | P1 | 🔮 Agent 可主动调用 graph_explore 发现关联 |

**核心价值主张：** 用户不再需要手动选择"用向量搜还是 BM25 搜"，Agent 会根据问题自动选择最优策略，并在知识图谱的帮助下给出更全面、更有深度的回答。
