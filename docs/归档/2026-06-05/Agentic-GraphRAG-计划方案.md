# RAG NoteBook — Agentic GraphRAG 计划方案（V2）

> **Agentic RAG + GraphRAG + 笔记管理** 三位一体的智能知识助手。
> Agent 是大脑，GraphRAG 是长期记忆，传统 RAG 是短期工作记忆。

---

## 1. 核心理念

### 1.1 传统 RAG 的局限

当前项目已实现完整的混合检索管线（向量 + BM25 → RRF 融合 → LLM Rerank），但检索策略是**硬编码**的：无论用户问什么，系统都走同一套流程。这导致以下问题：

- 无法回答"A 和 B 有什么关系"——只能返回语义最接近的文档片段，无法沿关系链路多跳推理
- 无法回答"知识库整体讲了什么"——缺乏全局视角
- 无法搜索/创建笔记——与用户自己的知识体系脱节
- 检索策略不可调——用户无法让系统"多找找图谱"或"只看笔记"

### 1.2 Agentic RAG 的升级

Agent（LLM）作为"大脑"，自主决定检索策略：

```
用户提问 → Agent 分析意图 → 自主选择和调用工具
         → 评估结果是否充分 → 不够则追加调用/调整策略
         → 充分则综合所有信息生成回答
```

Agent 拥有多个"工具"（向量搜索、BM25 搜索、图谱遍历、社区摘要、笔记搜索等），像一个研究员一样：先想清楚要找什么，再决定用什么方法找，找到后还要判断够不够。

### 1.3 GraphRAG 的角色

知识图谱是 Agent 的**结构化长期记忆**：

- **实体关系网络**：让 Agent 能回答"X 和 Y 是什么关系"这类多跳问题
- **社区摘要**：让 Agent 能快速获得全局视角，回答"整体趋势"类问题
- **增量演化**：随着文档不断增加，图谱持续丰富，Agent 的"知识"越来越深

### 1.4 三者融合架构

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

Agent 通过 Vercel AI SDK v6 的 `tool()` 函数定义工具，通过 `streamText` + `maxSteps` 实现多步推理循环（ReAct 模式）。

### 2.1 工具总览（9 个）

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

### 2.2 工具实现模式

所有工具通过 **工厂函数** `createAgentTools(userId)` 统一创建，通过闭包注入 `userId`。这是因为工具 `execute` 回调中无法访问 NextAuth 的 request context，不能直接调用 `auth()` 或 `getCurrentUserId()`。

```typescript
export function createAgentTools(userId: string) {
  const vector_search = tool({
    description: "...",
    inputSchema: z.object({ ... }),
    execute: async ({ query, topK }) => {
      // userId 通过闭包获取，不需要调用 auth()
      const results = await hybridSearch(query, userId, topK);
      return { results };
    },
  });
  // ... 其他工具
  return { vector_search, keyword_search, ... };
}
```

### 2.3 keyword_search 独立 BM25 实现

当前 `hybridSearch()` 内部已经包含了 BM25 搜索（`bm25Search` 函数），但它是私有函数。为了让 `keyword_search` 工具提供**纯 BM25 搜索**（与 `vector_search` 的语义搜索互补），需要在 `src/lib/rag/search.ts` 中导出独立的 BM25 搜索函数：

```typescript
// 新增导出函数
export async function bm25OnlySearch(
  query: string, userId: string, topK: number
): Promise<SearchResult[]> { ... }
```

这样 `keyword_search` 调用 `bm25OnlySearch`，`vector_search` 调用 `hybridSearch`，两者真正互补。

---

## 3. Agent 对话 API

### 3.1 核心端点

新增 `src/app/api/agent-chat/route.ts`，关键设计：

- **认证**：使用 `getCurrentUserId()` 获取用户 ID（与现有 `chat/route.ts` 一致）
- **会话管理**：复用现有 `ChatSession` / `ChatMessage` 模型
- **消息历史**：先获取历史，再保存用户消息（避免重复）
- **流式响应**：使用 `createUIMessageStream` + `createUIMessageStreamResponse`（与现有 `chat/route.ts` 一致）
- **多步推理**：`streamText` 的 `maxSteps: 5` 控制最大推理步数
- **工具调用记录**：`onFinish` 回调中将 `steps` 中的工具调用信息持久化到 `ChatMessage.toolCalls` 字段

### 3.2 消息持久化策略

现有 `ChatMessage.sources` 字段存储 `SearchResult[]`（文档来源），前端 `SourceRefs` 组件依赖此格式。Agent 模式下新增 `toolCalls` 字段存储工具调用记录，两者互不干扰：

```prisma
model ChatMessage {
  // 已有
  sources   Json?     // SearchResult[]（文档来源，向后兼容）
  // 新增
  toolCalls Json?     // ToolCallRecord[]（Agent 工具调用记录）
}
```

### 3.3 前端流式适配

现有前端使用**自定义 SSE 解析器**（`readSSEStream` + `parseSSEChunk`），不使用 Vercel AI SDK 的 `useChat` hook。改造策略是**扩展现有 SSE 解析器**而非替换：

- 现有事件类型：`text-delta`、`data-sources`、`error`
- 新增事件类型：`tool-call`、`tool-result`、`step-start`、`step-finish`

`createUIMessageStream` 自动输出这些事件，前端只需在 `readSSEStream` 回调中添加对新事件类型的处理。

---

## 4. 图谱索引管线

### 4.1 流程概览

```
文档文本 → LLM 实体/关系提取 → graphology 内存图构建
        → Louvain 社区检测 → LLM 社区摘要生成 → 向量化存储
```

### 4.2 数据模型（4 张新表）

| 模型 | 说明 | 关键索引 |
|------|------|----------|
| `GraphEntity` | 实体（人、技术、概念等） | userId+name, userId+type, userId+communityId |
| `GraphRelationship` | 实体间关系 | sourceEntityId, targetEntityId |
| `GraphCommunity` | Louvain 社区 | userId+level |
| `GraphCommunityReport` | 社区 LLM 摘要 | userId |

`embedding` 列（vector(1536)）通过迁移 SQL 的 `ALTER TABLE` 添加，因为 Prisma 不原生支持 `vector` 类型。

### 4.3 增量索引

新文档上传后，提取的实体/关系与已有图谱**合并**（非全量重建）：新实体直接添加，已有实体合并描述，新关系添加或累加权重，然后仅对受影响的子图重新运行社区检测和摘要生成。

### 4.4 依赖

```bash
pnpm add graphology graphology-communities-louvain graphology-metrics graphology-types graphology-utils
```

---

## 5. 图谱可视化

### 5.1 技术选型

使用 **sigma.js** + **@react-sigma/core**，基于 WebGL 渲染，可流畅展示万级节点。布局使用 **ForceAtlas2** 力导向算法。

### 5.2 核心功能

- **交互式 2D 图谱**：节点按社区着色，边按权重调整粗细
- **节点点击**：右侧弹出详情面板（实体信息、关系列表、来源文档）
- **搜索定位**：输入实体名称，定位并高亮匹配节点
- **筛选过滤**：按实体类型、社区筛选
- **布局控制**：启动/暂停/重置 ForceAtlas2
- **响应式 + 深色主题**：桌面/平板/手机适配

### 5.3 依赖

```bash
pnpm add sigma @react-sigma/core @react-sigma/layout-forceatlas2 graphology-layout-forceatlas2
```

---

## 6. 实施路线

### Phase 1：图谱索引管线（1 周）

| 步骤 | 内容 | 产出文件 |
|------|------|----------|
| G1 | Prisma Schema 迁移（4 模型 + embedding 列 + ChatMessage.toolCalls） | `schema.prisma` + `migration.sql` |
| G2 | LLM Prompt 模板 + zod 输出 Schema | `src/lib/graph/prompts.ts`, `schemas.ts` |
| G3 | 实体/关系提取（LLM + generateObject） | `src/lib/graph/extractor.ts` |
| G4 | graphology 图构建 + Louvain 社区检测 | `src/lib/graph/builder.ts`, `community.ts` |
| G5 | 社区摘要生成 + 向量化 | `src/lib/graph/reporter.ts` |
| G6 | 索引编排器（增量合并） | `src/lib/graph/indexer.ts` |
| G7 | 调色板 + 类型图标 | `src/lib/graph/colors.ts` |
| G8 | 索引 API（单文档/全量/统计） | `src/app/api/knowledge/graph-*/route.ts` |

里程碑：能对一个文档完成图谱索引，数据可在数据库中查看。

### Phase 2：Agent 工具集 + 对话 API（1 周）

| 步骤 | 内容 | 产出文件 |
|------|------|----------|
| A1 | 导出 `bm25OnlySearch`（扩展 search.ts） | `src/lib/rag/search.ts` 修改 |
| A2 | 9 个工具工厂函数 + 错误处理 | `src/lib/agent/tools/index.ts` |
| A3 | 图谱检索函数（graphExplore） | `src/lib/graph/search.ts` |
| A4 | Agent 对话 API（streamText + maxSteps + UIMessageStream） | `src/app/api/agent-chat/route.ts` |
| A5 | System Prompt | 包含在 A4 中 |

里程碑：对话中 Agent 能调用所有工具并流式返回。

### Phase 3：前端集成 + 图谱可视化（1.5 周）

| 步骤 | 内容 | 产出文件 |
|------|------|----------|
| F1 | 扩展 SSE 解析器（tool-call / tool-result 事件） | `chat/page.tsx` 修改 |
| F2 | 工具调用展示组件 | `src/components/chat/tool-call-display.tsx` |
| F3 | 消息渲染增强（折叠工具步骤 + 来源标注） | `message-item.tsx` 修改 |
| F4 | sigma.js 图谱画布组件 | `src/components/knowledge/graph-canvas.tsx` |
| F5 | 节点详情面板 + 控制栏 | `graph-node-detail.tsx`, `graph-controls.tsx` |
| F6 | 图谱可视化页面 + 数据 API | `knowledge/graph/page.tsx` + API |
| F7 | 侧边栏导航 + 知识库页集成 | `app-sidebar.tsx` + `knowledge/page.tsx` 修改 |
| F8 | 深色主题 + 响应式适配 | 各组件 |

里程碑：图谱页面可交互浏览，对话页面展示工具调用过程。

### Phase 4：优化与调优（持续）

- System Prompt 调优（让 Agent 更准确地选择工具）
- 工具描述优化（根据实际效果调整）
- maxSteps 调优（3-5 步，按实际对话复杂度）
- 并行工具调用（vector_search + keyword_search 并行）
- 缓存策略（相同查询缓存结果）
- 成本控制（token 用量监控和限制）
- 图谱索引进度追踪 API

---

## 7. 文件清单

### 新增文件（28 个）

```
Phase 1 — 图谱索引管线（8 个）
├── src/lib/graph/prompts.ts            # LLM Prompt 模板
├── src/lib/graph/schemas.ts            # zod 输出 Schema
├── src/lib/graph/extractor.ts          # 实体/关系提取
├── src/lib/graph/indexer.ts            # 索引编排（含增量合并）
├── src/lib/graph/builder.ts            # graphology 图构建
├── src/lib/graph/community.ts          # Louvain 社区检测
├── src/lib/graph/reporter.ts           # 社区摘要生成 + 向量化
└── src/lib/graph/colors.ts             # 调色板 + 类型图标

Phase 2 — Agent 工具集 + API（6 个）
├── src/lib/agent/tools/index.ts        # 工具工厂（createAgentTools）
├── src/lib/graph/search.ts             # graphExplore + 图谱向量搜索
├── src/app/api/agent-chat/route.ts     # Agent 对话端点
├── src/app/api/knowledge/graph-index/route.ts    # 单文档索引触发
├── src/app/api/knowledge/graph-rebuild/route.ts  # 全量重建
├── src/app/api/knowledge/graph-stats/route.ts    # 统计信息

Phase 3 — 前端 + 可视化（10 个）
├── src/components/chat/tool-call-display.tsx       # 工具调用展示
├── src/components/knowledge/graph-canvas.tsx       # sigma.js 画布
├── src/components/knowledge/graph-node-detail.tsx  # 节点详情面板
├── src/components/knowledge/graph-controls.tsx     # 控制工具栏
├── src/app/(main)/knowledge/graph/page.tsx         # 图谱可视化页面
├── src/app/api/knowledge/graph-data/route.ts       # 可视化数据 API
└── src/app/api/knowledge/graph-entity/[id]/
    └── relations/route.ts              # 实体关系详情 API
```

### 修改文件（7 个）

```
├── prisma/schema.prisma                  # +4 GraphRAG 模型 + ChatMessage.toolCalls + User 反向关系
├── prisma/migrations/xxx_add_graphrag/
│   └── migration.sql                     # embedding 列 + toolCalls 列
├── src/lib/rag/search.ts                 # 导出 bm25OnlySearch 函数
├── src/app/(main)/chat/page.tsx          # 扩展 SSE 解析器支持工具调用事件
├── src/components/chat/message-item.tsx  # 支持工具调用步骤渲染
├── src/components/layout/app-sidebar.tsx # +知识图谱导航项
└── src/app/(main)/knowledge/page.tsx     # +图谱状态指示器
```

### 新增依赖

```bash
# Phase 1: 图处理
pnpm add graphology graphology-communities-louvain graphology-metrics graphology-types graphology-utils

# Phase 3: 图谱可视化
pnpm add sigma @react-sigma/core @react-sigma/layout-forceatlas2 graphology-layout-forceatlas2
```

---

## 8. 与需求文档的对齐

| 需求项 | 优先级 | 覆盖情况 |
|--------|--------|----------|
| RAG 对话 + 流式输出 | MVP | 已有，Agent 模式增强 |
| 混合检索（向量+BM25+RRF） | MVP | Agent 的 vector_search + keyword_search 工具 |
| LLM 重排序 | MVP | hybridSearch 内部已包含 |
| 文档来源引用展示 | MVP | 增强：区分文档/图谱/社区来源 |
| 会话管理 | MVP | 复用已有 |
| Agent 对话（多工具） | P2 | 9 个工具，覆盖图谱+笔记 |
| 知识图谱可视化 | 新增 | sigma.js 交互式 2D 图谱 |
| 语义搜索（笔记） | P1 | 可作为 search_notes 增强 |
| 关联笔记推荐 | P1 | Agent 可主动调用 graph_explore 发现关联 |
