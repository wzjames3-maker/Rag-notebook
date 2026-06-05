# RAG NoteBook

AI 驱动的个人知识管理工具，以 RAG（检索增强生成）为核心引擎，融合 **笔记管理**、**知识库检索**、**GraphRAG 知识图谱** 和 **Agent 智能对话** 四大场景，解决"记而不用"的知识遗忘问题。

---

## 功能特性

### 核心功能

| 模块 | 功能 | 说明 |
|------|------|------|
| **智能对话** | RAG 问答 | 基于知识库的检索增强问答，流式输出，回答附带文档来源引用 |
| | Agent 对话 | 9 个 Agent 工具，LLM 自主决策调用，支持多步推理和工具组合 |
| | GraphRAG | 基于知识图谱的多跳推理、实体搜索、社区摘要，增强复杂问题回答 |
| **知识库** | 文档上传 | 支持 TXT / PDF / MD / DOCX，拖拽上传，MD5 去重 |
| | 混合检索 | pgvector 向量检索 + Orama BM25 全文检索，RRF 融合排序 |
| | LLM 重排序 | 检索结果经 LLM 二次排序，提升相关性 |
| | 知识图谱 | LLM 实体/关系提取 → Louvain 社区检测 → Sigma.js 可视化 |
| **笔记管理** | CRUD | Milkdown Markdown 编辑器，支持 GFM、代码高亮 |
| | 分类筛选 | 工作 / 学习 / 生活 / 项目 四类分类 |
| | 软删除 | 回收站机制，30 天自动清理，支持恢复 |
| | 关键词搜索 | 基于标题和内容的全文搜索 |
| **用户系统** | 注册/登录 | NextAuth.js v5 JWT 认证，bcrypt 密码加密 |
| | 数据隔离 | 所有数据按 userId 严格隔离 |
| | 路由保护 | Edge Runtime 中间件拦截未认证请求 |
| **仪表盘** | 统计概览 | 笔记/文档/会话数量统计，快速入口 |
| **主题** | 深色/浅色 | next-themes 主题切换 |

### Agent 工具集

Agent 模式下，LLM 可自主调用以下 9 个工具：

| 工具 | 说明 |
|------|------|
| `vector_search` | 混合检索（向量 + BM25 + RRF + Rerank） |
| `keyword_search` | 纯 BM25 关键词搜索 |
| `graph_explore` | 知识图谱 BFS 多跳遍历 |
| `graph_search` | 实体向量语义搜索 |
| `community_summary` | 社区摘要搜索 |
| `search_notes` | 笔记全文搜索 |
| `create_note` | 创建笔记 |
| `build_graph` | 触发图谱索引构建 |
| `get_time` | 获取当前时间 |

---

## 技术栈

| 层 | 技术 | 版本 | 用途 |
|----|------|------|------|
| 前端框架 | Next.js (App Router) | 16.x | React 全栈框架，SSR + Route Handlers |
| UI 组件 | shadcn/ui v4 | latest | 基于 @base-ui/react 的可定制组件 |
| CSS | Tailwind CSS | 4.x | 原子化 CSS，响应式布局 |
| 数据库 | PostgreSQL + pgvector | 16 | 关系型存储 + 向量检索 |
| ORM | Prisma | 7.x | 类型安全数据库访问 |
| 认证 | NextAuth.js v5 | 5.x beta | JWT 认证 + Credentials Provider |
| AI SDK | Vercel AI SDK | 6.x | streamText 流式输出 + tool calling |
| LLM | SiliconFlow / SenseNova | OpenAI 兼容 | 对话生成 + 文本向量化 + 重排序 |
| 向量嵌入 | BAAI/bge-m3 | 1024 维 | 多语言嵌入模型 |
| BM25 | @orama/orama | 3.x | 纯 JS 全文搜索引擎 |
| 图谱 | graphology + Louvain | - | 图数据结构 + 社区检测 |
| 图谱可视化 | Sigma.js + ForceAtlas2 | 3.x | 力导向布局 + WebGL 渲染 |
| Markdown | Milkdown | 7.x | 插件化 Markdown 编辑器 |
| 文档解析 | pdf-parse / mammoth | - | PDF / DOCX 内容提取 |
| 校验 | Zod | ~4.4 | TypeScript-first schema 校验 |
| 容器 | Docker (pgvector/pgvector:pg16) | - | 本地 PostgreSQL 运行环境 |

---

## 项目结构

```
src/
├── app/
│   ├── (auth)/              # 认证页面
│   │   ├── login/           #   登录
│   │   └── register/        #   注册
│   ├── (main)/              # 主应用页面
│   │   ├── chat/            #   AI 对话（RAG + Agent）
│   │   ├── dashboard/       #   仪表盘
│   │   ├── knowledge/       #   知识库管理 + 图谱可视化
│   │   ├── notes/           #   笔记管理
│   │   └── trash/           #   回收站
│   ├── api/                 # Route Handlers
│   │   ├── auth/            #   NextAuth + 注册
│   │   ├── chat/            #   RAG 对话 + Agent 对话 + 会话管理
│   │   ├── dashboard/       #   统计接口
│   │   ├── knowledge/       #   文档上传/列表/删除 + 图谱 CRUD/构建
│   │   ├── notes/           #   笔记 CRUD
│   │   ├── trash/           #   回收站（恢复/永久删除）
│   │   └── user/            #   个人资料
│   ├── layout.tsx           # 根布局
│   └── page.tsx             # Landing 页面
├── components/
│   ├── chat/                # 对话组件（消息流、输入框、来源引用、工具调用展示）
│   ├── dashboard/           # 仪表盘组件
│   ├── knowledge/           # 知识库组件（上传、文档列表、图谱画布、控制面板）
│   ├── layout/              # 布局组件（侧边栏、顶栏、移动端导航）
│   ├── notes/               # 笔记组件（编辑器、列表、卡片）
│   ├── shared/              # 共享组件（空状态、确认对话框）
│   └── ui/                  # shadcn/ui 基础组件
├── lib/
│   ├── ai/                  # AI 服务
│   │   ├── dashscope.ts     #   OpenAI 兼容客户端
│   │   ├── embeddings.ts    #   embed / embedBatch
│   │   └── rerank.ts        #   LLM 重排序
│   ├── rag/                 # RAG 管道
│   │   ├── search.ts        #   hybridSearch（向量 + BM25 + RRF + Rerank）
│   │   ├── vectorize.ts     #   vectorizeAndStore
│   │   ├── chunking.ts      #   chunkText
│   │   └── parsers.ts       #   parseDocument（TXT/PDF/DOCX/MD）
│   ├── graph/               # GraphRAG 模块
│   │   ├── extractor.ts     #   LLM 实体/关系提取
│   │   ├── indexer.ts       #   extractAndUpsertDocument + recomputeCommunities
│   │   ├── builder.ts       #   图谱构建编排
│   │   ├── community.ts     #   Louvain 社区检测
│   │   ├── reporter.ts      #   社区摘要生成
│   │   ├── search.ts        #   图谱搜索（实体向量搜索 + BFS 多跳）
│   │   ├── job-tracker.ts   #   构建任务进度持久化
│   │   ├── cleanup.ts       #   启动时清理孤儿数据
│   │   ├── colors.ts        #   社区颜色分配
│   │   ├── position-cache.ts#   节点位置缓存
│   │   ├── prompts.ts       #   LLM 提示词模板
│   │   ├── reducers.ts      #   实体/关系归约
│   │   └── schemas.ts       #   Zod schema 定义
│   ├── agent/               # Agent 模块
│   │   └── tools/           #   9 个 Agent 工具定义
│   ├── auth.ts              #   NextAuth v5 配置
│   ├── db.ts                #   PrismaClient 单例 + PrismaPg adapter
│   ├── api-helpers.ts       #   getCurrentUserId / unauthorized / notFound
│   └── utils.ts             #   cn() / formatTimeAgo()
├── middleware.ts             # Edge Runtime 认证中间件
└── types/
    └── next-auth.d.ts       # Session 类型增强
```

---

## 快速开始

### 前置要求

| 依赖 | 版本 | 说明 |
|------|------|------|
| Node.js | >= 18.18 | Next.js 16 要求 |
| pnpm | >= 9 | 包管理器 |
| Docker | >= 24 | 本地 PostgreSQL 容器 |
| 磁盘空间 | >= 10 GB | node_modules + 数据库 |

### 1. 克隆项目

```bash
git clone https://github.com/wzjames3-maker/Rag-notebook.git
cd Rag-notebook
```

### 2. 启动 PostgreSQL

```bash
docker-compose up -d
```

使用 `pgvector/pgvector:pg16` 镜像，端口 5432，数据持久化到 `pgdata` volume。

### 3. 安装依赖

```bash
pnpm install
```

> 如果 `pnpm dev` / `pnpm lint` 报错，先运行 `CI=true pnpm approve-builds` 允许构建脚本（sharp、msw、@prisma/engines 等）。

### 4. 配置环境变量

在项目根目录创建 `.env.local`：

```env
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/rag_notebook"

# NextAuth
AUTH_SECRET="替换为随机字符串"
NEXTAUTH_URL="http://localhost:3000"

# 向量嵌入（SiliconFlow）
SILICONFLOW_API_KEY="你的 API Key"
SILICONFLOW_BASE_URL="https://api.siliconflow.cn/v1"
SILICONFLOW_EMBEDDING_MODEL="BAAI/bge-m3"

# 对话模型（SenseNova 或其他 OpenAI 兼容服务）
SENSENOVA_API_KEY="你的 API Key"
SENSENOVA_BASE_URL="https://token.sensenova.cn/v1"
SENSENOVA_CHAT_MODEL="deepseek-v4-flash"
```

> `.env.local` 已被 `.gitignore` 排除，不会被提交到 Git。

### 5. 初始化数据库

```bash
npx prisma generate        # 生成 Prisma Client（输出到 src/generated/prisma/）
npx prisma migrate deploy  # 执行数据库迁移
```

### 6. 启动开发服务器

```bash
npx next dev -p 3000
```

访问 http://localhost:3000 即可使用。

---

## 常用命令

```bash
# 开发
npx next dev -p 3000          # 启动开发服务器（Turbopack）
pnpm dev                       # 同上（webpack 模式）

# 构建
npx next build                 # 生产构建（25 个路由）

# 数据库
npx prisma generate            # 重新生成 Prisma Client
npx prisma migrate deploy      # 应用迁移
npx prisma migrate dev         # 开发迁移（修改 schema.prisma 后）

# 代码质量
npx eslint                     # ESLint 检查

# 图谱测试
pnpm test:graph                # 运行 GraphRAG 模块测试
```

---

## RAG 管道

### 文档入库

```
上传文件 → MD5 去重 → parseDocument() → chunkText() → embedBatch() → vectorizeAndStore()
                         │                   │              │                │
                    pdf-parse/          ~500 tokens     bge-m3          pgvector
                    mammoth/            overlap=50     1024 维         批量写入
                    原生读取
```

- **文档解析**：TXT 直接读取，PDF 用 pdf-parse，DOCX 用 mammoth，MD 原生读取
- **文本切片**：固定 ~500 tokens，overlap 50 tokens
- **向量化**：BAAI/bge-m3 模型，1024 维，25 条/批
- **存储**：Prisma $transaction 批量写入，50 条/批

### 混合检索

```
用户提问
  ├── embedText(query) → vector
  │     ├── pgvector cosine similarity → top 20
  │     └── Orama BM25 全文搜索 → top 20
  │
  └── RRF 融合（K=60）→ top 10
        └── LLM Rerank → top 5
              └── 构建 Prompt → streamText 流式生成
```

- **向量检索**：pgvector cosine similarity，利用 PostgreSQL 向量索引
- **全文检索**：@orama/orama 内存 BM25 索引（每次请求重建）
- **融合排序**：Reciprocal Rank Fusion (RRF)，K=60
- **重排序**：LLM prompt 方式对 top 10 结果二次排序，取 top 5

### GraphRAG

```
文档 → LLM 实体/关系提取 → 存入 GraphEntity/GraphRelationship
  → graphology 构建内存图 → Louvain 社区检测
  → 社区摘要生成（LLM） → 向量化摘要存储
  → Sigma.js + ForceAtlas2 可视化
```

- **实体提取**：LLM 从文档切片中提取实体和关系，支持增量合并
- **社区检测**：Louvain 算法自动发现实体聚类
- **社区报告**：LLM 为每个社区生成标题、摘要和关键发现
- **可视化**：Sigma.js WebGL 渲染 + ForceAtlas2 力导向布局
- **构建任务**：异步执行，进度持久化到 `GraphBuildJob` 表，支持增量/全量两种模式

---

## API 接口

| 分组 | 路径 | 说明 |
|------|------|------|
| 认证 | `POST /api/auth/register` | 用户注册 |
| | `POST /api/auth/signin` | 登录（NextAuth） |
| | `POST /api/auth/signout` | 登出 |
| 笔记 | `GET /api/notes` | 笔记列表（分页/筛选/搜索） |
| | `POST /api/notes` | 创建笔记 |
| | `GET /api/notes/[id]` | 笔记详情 |
| | `PUT /api/notes/[id]` | 更新笔记 |
| | `DELETE /api/notes/[id]` | 软删除笔记 |
| 回收站 | `GET /api/trash` | 回收站列表 |
| | `PUT /api/trash/[id]` | 恢复笔记 |
| | `DELETE /api/trash/[id]` | 永久删除 |
| 知识库 | `POST /api/knowledge/upload` | 上传文档 |
| | `GET /api/knowledge` | 文档列表 |
| | `GET /api/knowledge/[id]` | 文档详情（含切片） |
| | `DELETE /api/knowledge/[id]` | 删除文档 |
| 图谱 | `GET /api/knowledge/graph` | 图谱数据（节点/边/统计） |
| | `GET /api/knowledge/graph/stats` | 完整统计 |
| | `POST /api/knowledge/graph/build` | 启动图谱构建 |
| | `GET /api/knowledge/graph/build` | 查询构建任务状态 |
| 对话 | `POST /api/chat` | RAG 对话（SSE 流式） |
| | `POST /api/agent-chat` | Agent 对话（SSE 流式） |
| | `GET /api/chat/sessions` | 会话列表 |
| | `GET /api/chat/sessions/[id]` | 会话消息历史 |
| | `DELETE /api/chat/sessions/[id]` | 删除会话 |
| 用户 | `GET /api/user` | 获取用户信息 |
| | `PUT /api/user` | 更新个人资料 |
| 仪表盘 | `GET /api/dashboard` | 统计数据 |

所有保护路由需携带 NextAuth session cookie。响应统一为 `{ data, message }` 或 `{ error, message }` 格式。

---

## 数据模型

```
User (用户)
 ├── Note (笔记) — title, content, category, tags, deletedAt
 ├── ChatSession (会话) → ChatMessage (消息) — role, content, sources, toolCalls
 ├── KnowledgeDocument (文档) → KnowledgeChunk (切片) — content, embedding(vector)
 ├── GraphEntity (实体) — name, type, description, embedding(vector), communityId
 ├── GraphRelationship (关系) — sourceEntity, targetEntity, type, weight
 ├── GraphCommunity (社区) — level, size, parentId
 ├── GraphCommunityReport (社区报告) — title, summary, keyFindings, embedding(vector)
 └── GraphBuildJob (构建任务) — scope, status, progress
```

所有模型通过 `userId` 实现数据隔离，PostgreSQL pgvector 扩展支持向量字段。

---

## 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                  Next.js 16 App (Port 3000)                  │
│                                                              │
│  Pages (App Router)        Route Handlers (API)              │
│  ├─ (auth)/login,register  ├─ /api/auth/*                    │
│  └─ (main)/                ├─ /api/chat/*                    │
│     ├─ dashboard           ├─ /api/knowledge/*               │
│     ├─ notes               ├─ /api/notes/*                   │
│     ├─ knowledge           ├─ /api/trash/*                   │
│     ├─ chat                ├─ /api/user/*                    │
│     └─ trash               └─ /api/dashboard/*               │
│                                                              │
│  Lib                                                         │
│  ├─ ai/      (LLM client, embeddings, rerank)               │
│  ├─ rag/     (hybridSearch, chunking, parsers, vectorize)    │
│  ├─ graph/   (extractor, indexer, community, search)         │
│  ├─ agent/   (9 tools for Agent ReAct loop)                  │
│  ├─ auth.ts  (NextAuth v5 config)                            │
│  └─ db.ts    (PrismaClient singleton)                        │
└─────────┬──────────────────────────────────┬─────────────────┘
          │ Prisma ORM (pgvector adapter)    │ Vercel AI SDK
          ▼                                  ▼
┌──────────────────────┐       ┌──────────────────────────┐
│  PostgreSQL 16       │       │  LLM API                 │
│  + pgvector          │       │  (SiliconFlow / SenseNova)│
│                      │       │                          │
│  ├─ 关系型数据        │       │  ├─ 对话生成 (streamText) │
│  ├─ 向量检索 (cosine) │       │  ├─ 文本向量化 (embed)    │
│  └─ 全文搜索 (预留)   │       │  ├─ LLM 重排序            │
│                      │       │  └─ 实体/关系提取          │
└──────────────────────┘       └──────────────────────────┘
```

---

## 安全特性

- JWT 认证 + Edge Runtime 中间件路由保护
- bcrypt 密码哈希
- Prisma 参数化查询，无 SQL 注入风险
- 数据按 `userId` 严格隔离
- 敏感配置通过 `.env.local` 注入，禁止硬编码
- 文件上传白名单（TXT/PDF/MD/DOCX），单文件 <= 50MB
- 单用户最多 500 篇文档，总容量 <= 2GB

---

## 已知限制

- **LLM API 依赖**：对话、向量化、重排序依赖外部 LLM API，不可完全离线运行
- **Orama 内存索引**：BM25 索引每次请求在内存中重建，知识库规模过大时需关注内存占用
- **pgvector 规模**：建议万级文档以内，超过后 IVFFlat 索引性能下降（可切换 HNSW）
- **单文件限制**：上传文件 <= 50MB，单用户最多 500 篇文档

---

## 文档

| 文件 | 内容 |
|------|------|
| `docs/需求文档.md` | 完整需求分析（MVP + P1-P3 规划） |
| `docs/API设计.md` | 全部 API 接口设计（含请求/响应格式） |
| `docs/技术选型.md` | 技术栈选型理由和对比 |
| `docs/RAG_FLOW.md` | RAG / GraphRAG / Agent 流程图（Mermaid） |
| `docs/GRAPH_TESTING.md` | 图谱功能手测流程 |
| `docs/MVP实施计划.md` | 11 步实施计划 |

---

## License

MIT
