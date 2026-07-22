<div align="center">

# 📓 RAG NoteBook

**AI 驱动的个人知识管理工具 — 记了就能用**

融合 RAG 检索增强问答、GraphRAG 知识图谱、Agent 智能对话和笔记管理，解决"记而不用"的知识遗忘问题。

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-pgvector-4169E1?logo=postgresql)](https://postgresql.org)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma)](https://prisma.io)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

</div>

---

## ✨ 核心能力

| 模块 | 能力 |
|------|------|
| 🤖 RAG 问答 | 混合检索（向量 + BM25 + RRF + Rerank），流式输出，附带来源引用 |
| 🕸️ GraphRAG | LLM 实体/关系提取 → Louvain 社区检测 → 多跳推理 → Sigma.js 可视化 |
| 🧰 Agent 对话 | 9 个工具，LLM 自主决策调用，支持多步推理和工具组合 |
| 📚 知识库 | TXT/PDF/MD/DOCX 上传，MD5 去重，自动切片向量化 |
| 📝 笔记管理 | Milkdown Markdown 编辑器，分类筛选，软删除 + 回收站 |
| 🔐 用户系统 | NextAuth.js v5 JWT 认证，数据按 userId 严格隔离 |

### Agent 工具集

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

## 🏗️ 架构

```
┌─────────────────────────────────────────────────────┐
│              Next.js 16 App (Port 3000)              │
│                                                     │
│  Pages (App Router)      Route Handlers (API)       │
│  ├─ dashboard            ├─ /api/chat/*             │
│  ├─ notes                ├─ /api/knowledge/*        │
│  ├─ knowledge            ├─ /api/notes/*            │
│  ├─ chat                 ├─ /api/trash/*            │
│  └─ trash                └─ /api/user/*             │
│                                                     │
│  Lib                                              │
│  ├─ ai/      (LLM client, embeddings, rerank)       │
│  ├─ rag/     (hybridSearch, chunking, parsers)      │
│  ├─ graph/   (extractor, indexer, community)        │
│  ├─ agent/   (9 tools for ReAct loop)               │
│  └─ db.ts    (PrismaClient singleton)               │
└──────────┬──────────────────────────┬───────────────┘
           │ Prisma + pgvector        │ Vercel AI SDK
           ▼                          ▼
┌──────────────────────┐    ┌─────────────────────────┐
│  PostgreSQL 16       │    │  LLM API                │
│  + pgvector          │    │  (SiliconFlow/SenseNova)│
│                      │    │                         │
│  ├─ 关系型数据       │    │  ├─ 对话生成            │
│  ├─ 向量检索         │    │  ├─ 文本向量化          │
│  └─ 全文搜索         │    │  └─ 实体/关系提取       │
└──────────────────────┘    └─────────────────────────┘
```

## 🔄 RAG 管道

```
上传文件 → MD5 去重 → parseDocument() → chunkText() → embedBatch() → vectorizeAndStore()
                       pdf-parse/         ~500 tokens    bge-m3         pgvector
                       mammoth/           overlap=50     1024 维        批量写入
                       原生读取

用户提问
  ├── embedText(query) → pgvector cosine → top 20
  └── Orama BM25 全文搜索 → top 20
        └── RRF 融合（K=60）→ top 10
              └── LLM Rerank → top 5
                    └── streamText 流式生成
```

## 🚀 快速开始

### 前置要求

| 依赖 | 版本 |
|------|------|
| Node.js | >= 18.18 |
| pnpm | >= 9 |
| Docker | >= 24 |

### 部署

```bash
git clone https://github.com/wzjames3-maker/Rag-notebook.git
cd Rag-notebook

# 启动 PostgreSQL (pgvector)
docker-compose up -d

# 安装依赖
pnpm install

# 配置环境变量
cp .env.example .env.local  # 编辑填写 API Keys

# 初始化数据库
npx prisma generate
npx prisma migrate deploy

# 启动
npx next dev -p 3000
```

访问 http://localhost:3000

### 环境变量

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/rag_notebook"
AUTH_SECRET="随机字符串"
SILICONFLOW_API_KEY="你的 Key"        # 向量嵌入
SENSENOVA_API_KEY="你的 Key"          # 对话模型
```

## 🛠️ 技术栈

| 层 | 技术 |
|----|------|
| 框架 | Next.js 16 (App Router) + React 19 |
| UI | shadcn/ui v4 + Tailwind CSS 4 |
| 数据库 | PostgreSQL 16 + pgvector |
| ORM | Prisma 7.x |
| 认证 | NextAuth.js v5 (JWT + Credentials) |
| AI SDK | Vercel AI SDK 6.x (streamText + tool calling) |
| LLM | SiliconFlow / SenseNova (OpenAI 兼容) |
| 嵌入 | BAAI/bge-m3 (1024 维) |
| BM25 | @orama/orama 3.x |
| 图谱 | graphology + Louvain + Sigma.js 3.x |
| 编辑器 | Milkdown 7.x |
| 校验 | Zod 4.x |

## 📁 项目结构

```
src/
├── app/
│   ├── (auth)/           # 登录 / 注册
│   ├── (main)/           # dashboard / notes / knowledge / chat / trash
│   └── api/              # Route Handlers (auth/chat/knowledge/notes/trash/user)
├── components/
│   ├── chat/             # 消息列表、输入框、来源引用、工具调用
│   ├── knowledge/        # 上传、文档列表、图谱画布
│   ├── notes/            # 编辑器、列表、卡片
│   └── ui/               # shadcn/ui 基础组件
├── lib/
│   ├── ai/               # LLM client, embeddings, rerank
│   ├── rag/              # hybridSearch, chunking, parsers, vectorize
│   ├── graph/            # extractor, indexer, community, search, builder
│   └── agent/tools/      # 9 个 Agent 工具
└── middleware.ts         # Edge Runtime 认证中间件
```

## 🔒 安全特性

- JWT 认证 + Edge Runtime 路由保护
- bcrypt 密码哈希
- Prisma 参数化查询（无 SQL 注入）
- 数据按 userId 严格隔离
- 文件上传白名单 + 50MB 限制 + 500 篇上限

## ⚠️ 已知限制

- LLM API 依赖：对话/向量化/重排序需外部 API
- Orama 内存索引：每次请求重建，大规模知识库需关注内存
- pgvector：建议万级文档以内（超过可切 HNSW）

## 📄 License

MIT © [wzjames3-maker](https://github.com/wzjames3-maker)

---

<div align="center">

**记了就能用，问了就有答。**

Star ⭐ if you believe knowledge should work for you!

</div>
