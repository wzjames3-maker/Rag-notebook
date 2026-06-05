<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# RAG NoteBook — Project Guide

## Architecture

```
src/
├── app/
│   ├── (auth)/          login, register pages
│   ├── (main)/          chat, dashboard, knowledge, notes, trash pages
│   ├── api/             Route Handlers (auth, chat, dashboard, knowledge, notes, trash, user)
│   ├── layout.tsx       root layout
│   └── page.tsx         landing page
├── components/          chat/, dashboard/, knowledge/, layout/, notes/, shared/, ui/ (shadcn)
├── lib/
│   ├── auth.ts          NextAuth v5 config — Prisma lazy-imported inside authorize()
│   ├── db.ts            PrismaClient singleton + PrismaPg adapter for pgvector
│   ├── api-helpers.ts   getCurrentUserId(), unauthorized(), notFound()
│   ├── utils.ts         cn(), formatTimeAgo()
│   ├── ai/              dashscope.ts, embeddings.ts, rerank.ts
│   └── rag/             search.ts (hybrid), vectorize.ts, chunking.ts, parsers.ts
├── middleware.ts        auth gate — no Prisma imports (Edge Runtime)
└── types/next-auth.d.ts Session type augmentation
```

## Quirks & Gotchas

- **pnpm dev / pnpm lint fails** — node_modules has ignored build scripts (sharp, msw, @prisma/engines). Run `CI=true pnpm approve-builds` to fix. After that, use `pnpm` normally. Otherwise use `npx next dev` / `npx eslint`.
- **npx not node_modules/.bin** — node_modules was installed from Windows. Use `npx <cmd>` instead. Works fine.
- **Prisma 7** — uses `prisma.config.ts` + `defineConfig()`, NOT `schema.prisma` datasource URL. Custom output: `src/generated/prisma/`. Run `npx prisma generate` (not `prisma generate`).
- **Edge Runtime + Prisma** — generated Prisma client imports `node:path`/`node:url` incompatible with Edge. Fixed in `auth.ts`: `authorize()` does lazy `import("./db")` instead of top-level import. Do NOT import Prisma in middleware or top-level auth module.
- **AI SDK v6** — NOT v3/v4/v5. Verify API signatures from `node_modules/ai/dist/` before writing. `streamText`, `embed`, `embedMany`, `generateObject` available.
- **@ai-sdk/react NOT installed** — no `useChat` hook. Chat frontend uses native `fetch` + manual SSE parser. Do not import from `@ai-sdk/react`.
- **shadcn v4 uses @base-ui/react** — NOT Radix. `Button` does NOT support `asChild`.
- **NextAuth v5 beta** — uses Next.js 16 `proxy` import path, not `middleware`. Verify import paths.
- **No automated tests** — no test framework configured. Manual E2E flow in `docs/GRAPH_TESTING.md`.
- **Zod ~4.4.3** — code uses v3 API (`z.string().min(1)`). Zod v4 compat layer works; do not upgrade to v5.
- **All DB queries must filter by userId** — data isolation from `getCurrentUserId()`.

## Commands

```bash
docker-compose up -d          # start PostgreSQL (pgvector/pg16, port 5432)
npx prisma generate           # generate Prisma client
npx prisma migrate deploy     # apply migrations
npx next build                # verify build (25 routes)
npx next dev -p 3000          # start dev server (Turbopack)
```

## RAG Pipeline

```
upload → parseDocument() → chunkText() → embedBatch() → vectorizeAndStore()
chat   → hybridSearch(): pgvector cosine + Orama BM25 + RRF + LLM rerank
```

Hybrid search in `src/lib/rag/search.ts`. Uses `@orama/orama` for BM25 (in-memory, rebuilt per request — P2 to migrate to tsvector).

## Graph Module

```
build   → extractAndUpsertDocument() [per doc] → recomputeCommunities() [once per job]
```

- `src/lib/graph/extractor.ts` — LLM 实体/关系提取，错误直接抛出（不再静默吞错）
- `src/lib/graph/indexer.ts` — 两个独立函数：
  - `extractAndUpsertDocument(docId, userId)`：仅写 entity/relationship，不动 community
  - `recomputeCommunities(userId, { onlyAffectedEntityIds? })`：跑 Louvain + 生成 reports
- `src/lib/graph/job-tracker.ts` — 任务进度持久化到 `GraphBuildJob` 表（**不再用内存 Map**）
- `src/lib/graph/cleanup.ts` — 启动时清理孤儿 `graphIndexing=true` 文档和超时 Job
- `src/instrumentation.ts` — Next.js 16 启动钩子调用 cleanup

**重要约定：**
- 增量构建：`extractAndUpsertDocument` 循环完后只对**受影响社区**调 `recomputeCommunities({ onlyAffectedEntityIds })`
- 全量重建：在 `prisma.$transaction` 中清空所有图谱数据 → 循环 extract → 不带 `onlyAffectedEntityIds` 调 `recomputeCommunities()`
- Job 并发：用户已有 running job 时 POST build 返回 409
- 失败注入：extractor 抛错 → indexer 写 `graphError` → 文档不标记 `graphIndexed`

**路由：**
- `GET  /api/knowledge/graph` — 图谱数据
- `GET  /api/knowledge/graph/stats` — 完整统计
- `POST /api/knowledge/graph/build` — 启动构建
- `GET  /api/knowledge/graph/build` — 查询最新 Job

## Docs

| File | Content |
|---|---|
| `docs/MVP实施计划.md` | Master plan, 11 steps |
| `docs/API设计.md` | 18 API endpoints |
| `docs/需求文档.md` | MVP checklist |
| `docs/技术选型.md` | Tech stack |
| `docs/RAG_FLOW.md` | RAG / GraphRAG / 图谱流程图 |
| `docs/GRAPH_TESTING.md` | 7 步手测流程 + 自动化检查 |

## Recurring Conventions

- No comments in code (project-wide rule)
- Route Handler `params` is `Promise<{...}>` (Next.js 16)
- SSE text-delta throttled with `requestAnimationFrame`
- Sources stored as flat array in ChatMessage JSON field
- Zod schemas for request validation in route.ts files
