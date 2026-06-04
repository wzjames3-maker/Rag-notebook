# RAG NoteBook — 实施计划（详细版）

## 1. MVP 范围

MVP 聚焦四个核心场景：**用户认证**、**笔记管理**、**知识库 RAG**、**AI 对话**。

### 包含功能
- 用户注册/登录/JWT 认证（NextAuth v5）
- 笔记 CRUD + Markdown 编辑器（Milkdown，GFM/高亮/公式）
- 笔记软删除 + 回收站（30 天自动清理）
- 笔记分类筛选（工作/学习/生活/项目）+ 分页列表
- 笔记关键词搜索（标题/内容）
- RAG 文档上传（TXT/PDF/MD/DOCX，单文件 ≤ 50MB）+ 向量化
- MD5 去重（用户级隔离）
- 混合检索（pgvector 向量 + orama BM25 + RRF 融合）
- LLM 重排序
- RAG 对话 + 流式输出（Vercel AI SDK streamText）
- 文档来源引用展示
- 会话管理（多会话/切换/删除/历史持久化）
- 用户级数据隔离
- 响应式布局（桌面 + 移动端）
- 深色/浅色主题切换
- Dashboard 仪表盘（统计 + 快速入口）

### 不包含功能（后续迭代）
- AI 自动标签、语义搜索、关联推荐（P1）
- AI 写作助手、Agent 对话（P2）
- 间隔重复回顾、批量操作、弱网降级（P3）

---

## 2. 功能优先级矩阵

### MVP — 核心链路
| 功能 | 模块 | 实施步骤 |
|------|------|----------|
| 用户注册/登录 | 认证 | 第 3 步 |
| 笔记 CRUD | 笔记管理 | 第 5 步 |
| Markdown 编辑器 | 笔记管理 | 第 5 步 |
| 软删除 + 回收站 | 笔记管理 | 第 5 步 |
| 分类筛选 + 分页 | 笔记管理 | 第 5 步 |
| 关键词搜索 | 笔记管理 | 第 5 步 |
| 文档上传 + 向量化 | 知识库 | 第 7 步 |
| MD5 去重 | 知识库 | 第 7 步 |
| RAG 对话 + 流式 | AI 对话 | 第 8 步 |
| 混合检索（向量 + BM25 + RRF） | AI 对话 | 第 8 步 |
| LLM 重排序 | AI 对话 | 第 8 步 |
| 来源引用展示 | AI 对话 | 第 8 步 |
| 会话管理 | AI 对话 | 第 8 步 |
| 数据隔离 | 全局 | 贯穿全部步骤 |
| 响应式布局 | 前端 | 第 4、11 步 |
| 深色/浅色主题 | 前端 | 第 4 步 |
| Dashboard | 前端 | 第 9 步 |

### P1 — 增强功能（MVP 之后）
- AI 自动标签 + 自动分类
- 语义搜索（笔记 + 知识库向量化检索）
- 关联笔记推荐
- 笔记 Markdown 导出
- 文档切片可视化

### P2 — AI 深度集成
- AI 写作助手（摘要/续写/扩写）
- Agent 对话（4 工具起步，渐进扩展）
- 多语言 i18n
- 账户注销 + 数据清除
- 笔记分享链接

### P3 — 体验优化
- 间隔重复回顾（AI 复习摘要）
- 文档切片可视化优化
- 批量操作
- 弱网降级

---

## 3. 实施路线（详细版）

### 第 0 步：项目文档体系 ✅ 已完成

**产出文件：**
- `docs/REQUIREMENTS.md` — 需求分析文档
- `docs/TECH_STACK.md` — 技术选型文档
- `docs/IMPLEMENTATION_PLAN.md` — 实施计划文档（本文件）
- `docs/API_DESIGN.md` — API 接口设计文档

---

### 第 1 步：项目初始化 ✅ 已完成

**目标：** 搭建 Next.js 项目骨架 + shadcn/ui + 核心依赖 + Docker 环境

#### 1.1 Next.js 项目创建 ✅ 已完成

```bash
npx create-next-app@latest rag-notebook --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-pnpm
```

#### 1.2 安装核心依赖 ✅ 已完成

```bash
# 数据库
pnpm add prisma @prisma/client

# 认证
pnpm add next-auth@beta bcryptjs
pnpm add -D @types/bcryptjs

# AI SDK
pnpm add @ai-sdk/openai ai

# 搜索引擎
pnpm add @orama/orama

# Markdown 渲染
pnpm add react-markdown remark-gfm rehype-highlight

# Markdown 编辑器
pnpm add @milkdown/react @milkdown/core @milkdown/preset-gfm @milkdown/theme-nord

# 文件上传
pnpm add react-dropzone

# UI 增强
pnpm add lucide-react next-themes sonner zod

# 文档解析
pnpm add pdf-parse mammoth
```

#### 1.3 初始化 shadcn/ui ✅ 已完成

```bash
npx shadcn@latest init
# 选择: Default style, Slate color, CSS variables: yes

# 添加所需组件
npx shadcn@latest add button input card dialog sheet separator badge skeleton dropdown-menu avatar textarea scroll-area tabs alert-dialog select tooltip label
```

#### 1.4 创建 Docker Compose ✅ 已完成

**文件：** `docker-compose.yml`

```yaml
services:
  postgres:
    image: pgvector/pgvector:pg16
    container_name: rag_notebook_db
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: rag_notebook
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  pgdata:
```

**验证命令：**
```bash
docker-compose up -d
docker-compose ps  # 确认 postgres 运行中
```

#### 1.5 创建环境变量模板 ✅ 已完成

**文件：** `.env.local`

```env
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/rag_notebook"

# NextAuth
AUTH_SECRET="change-me-to-random-string"
NEXTAUTH_URL="http://localhost:3000"

# DashScope (阿里云百炼)
DASHSCOPE_API_KEY="sk-xxx"
DASHSCOPE_BASE_URL="https://dashscope.aliyuncs.com/compatible-mode/v1"
DASHSCOPE_CHAT_MODEL="qwen-plus"
DASHSCOPE_EMBEDDING_MODEL="text-embedding-v3"
```

#### 1.6 验证 ✅ 已完成

```bash
pnpm dev
# 访问 http://localhost:3000 → 看到 Next.js 默认页面
```

**产出文件清单：**
- `docker-compose.yml`
- `.env.local`
- `package.json`（已更新依赖）
- `components.json`（shadcn/ui 配置）
- `src/components/ui/*`（shadcn 组件）

---

### 第 2 步：数据库 + Prisma ✅ 已完成

**目标：** 定义数据模型、创建迁移、启用 pgvector

#### 2.1 Prisma Schema ✅ 已完成

**文件：** `prisma/schema.prisma`

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum NoteCategory {
  WORK
  STUDY
  LIFE
  PROJECT
}

enum DocStatus {
  PROCESSING
  COMPLETED
  FAILED
}

enum MessageRole {
  USER
  ASSISTANT
  SYSTEM
}

model User {
  id        String   @id @default(uuid())
  username  String   @unique
  email     String   @unique
  password  String
  avatar    String?
  bio       String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  notes      Note[]
  sessions   ChatSession[]
  documents  KnowledgeDocument[]
  chunks     KnowledgeChunk[]
}

model Note {
  id        String        @id @default(uuid())
  userId    String
  title     String
  content   String
  category  NoteCategory  @default(WORK)
  tags      String[]
  deletedAt DateTime?
  createdAt DateTime      @default(now())
  updatedAt DateTime      @updatedAt

  user User @relation(fields: [userId], references: [id])

  @@index([userId, deletedAt])
  @@index([userId, category])
}

model ChatSession {
  id        String   @id @default(uuid())
  userId    String
  title     String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user     User          @relation(fields: [userId], references: [id])
  messages ChatMessage[]

  @@index([userId])
}

model ChatMessage {
  id        String      @id @default(uuid())
  sessionId String
  role      MessageRole
  content   String
  sources   Json?
  createdAt DateTime    @default(now())

  session ChatSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  @@index([sessionId, createdAt])
}

model KnowledgeDocument {
  id         String    @id @default(uuid())
  userId     String
  filename   String
  mimeType   String
  md5        String
  chunkCount Int       @default(0)
  status     DocStatus @default(PROCESSING)
  createdAt  DateTime  @default(now())

  user   User             @relation(fields: [userId], references: [id])
  chunks KnowledgeChunk[]

  @@unique([userId, md5])
  @@index([userId])
}

model KnowledgeChunk {
  id         String @id @default(uuid())
  documentId String
  userId     String
  content    String
  metadata   Json?
  chunkIndex Int

  document KnowledgeDocument @relation(fields: [documentId], references: [id], onDelete: Cascade)
  user     User              @relation(fields: [userId], references: [id])

  @@index([documentId])
  @@index([userId])
}
```

#### 2.2 pgvector 扩展 SQL ✅ 已完成

**文件：** `prisma/migrations/0_init/migration.sql`（在迁移后手动添加）

```sql
-- 启用 pgvector
CREATE EXTENSION IF NOT EXISTS "vector";

-- Note embedding 字段（Prisma 不直接支持 vector 类型）
ALTER TABLE "Note" ADD COLUMN IF NOT EXISTS "embedding" vector(1536);

-- KnowledgeChunk embedding 字段
ALTER TABLE "KnowledgeChunk" ADD COLUMN IF NOT EXISTS "embedding" vector(1536);

-- 向量索引（IVFFlat, cosine）
-- 注意：IVFFlat 需要表中已有数据才能正确构建，初始创建时可先不建索引
-- CREATE INDEX "note_embedding_idx" ON "Note" USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 100);
-- CREATE INDEX "chunk_embedding_idx" ON "KnowledgeChunk" USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 100);
```

#### 2.3 执行迁移 ✅ 已完成

```bash
pnpm prisma migrate dev --name init
# 编辑生成的 migration.sql 添加 pgvector 相关 SQL
pnpm prisma migrate dev --name add_pgvector
pnpm prisma generate
```

#### 2.4 Prisma 客户端单例 ✅ 已完成

**文件：** `src/lib/db.ts`

```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

#### 2.5 验证 ✅ 已完成

```bash
pnpm prisma studio
# 浏览器打开 Prisma Studio，确认所有表结构正确
```

**产出文件：**
- `prisma/schema.prisma`
- `prisma/migrations/` 目录
- `src/lib/db.ts`

---

### 第 3 步：认证系统 ✅ 已完成

**目标：** 实现注册/登录/JWT 认证 + 路由保护

#### 3.1 NextAuth 配置 ✅ 已完成

**文件：** `src/lib/auth.ts`

```typescript
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "./db";
import bcrypt from "bcryptjs";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        username: { label: "用户名或邮箱", type: "text" },
        password: { label: "密码", type: "password" },
      },
      async authorize(credentials) {
        const { username, password } = credentials;
        // 查询用户（支持用户名或邮箱）
        const user = await prisma.user.findFirst({
          where: {
            OR: [
              { username: username as string },
              { email: username as string },
            ],
          },
        });
        if (!user) return null;
        const isValid = await bcrypt.compare(password as string, user.password);
        if (!isValid) return null;
        return { id: user.id, name: user.username, email: user.email };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id as string;
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
```

#### 3.2 注册 API ✅ 已完成

**文件：** `src/app/api/auth/register/route.ts`

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { z } from "zod";

const schema = z.object({
  username: z.string().min(3).max(20),
  email: z.string().email(),
  password: z.string().min(6).max(20),
});

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", message: parsed.error.message },
      { status: 400 }
    );
  }

  const { username, email, password } = parsed.data;
  const existing = await prisma.user.findFirst({
    where: { OR: [{ username }, { email }] },
  });
  if (existing) {
    return NextResponse.json(
      { error: "DUPLICATE", message: "用户名或邮箱已存在" },
      { status: 409 }
    );
  }

  const hashed = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { username, email, password: hashed },
  });

  return NextResponse.json(
    { data: { id: user.id, username: user.username, email: user.email } },
    { status: 201 }
  );
}
```

#### 3.3 认证中间件 ✅ 已完成

**文件：** `src/middleware.ts`

```typescript
import { auth } from "@/lib/auth";

export default auth((req) => {
  const isAuthPage = req.nextUrl.pathname.startsWith("/login") ||
                     req.nextUrl.pathname.startsWith("/register");
  const isAuthenticated = !!req.auth;

  if (isAuthPage && isAuthenticated) {
    return Response.redirect(new URL("/dashboard", req.url));
  }

  const protectedPaths = ["/dashboard", "/notes", "/knowledge", "/chat", "/trash"];
  const isProtected = protectedPaths.some((p) => req.nextUrl.pathname.startsWith(p));

  if (isProtected && !isAuthenticated) {
    return Response.redirect(new URL("/login", req.url));
  }
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
```

#### 3.4 认证页面 ✅ 已完成

**文件：** `src/app/(auth)/layout.tsx`
- 居中卡片布局，全高背景
- 包含 Logo + 表单

**文件：** `src/app/(auth)/login/page.tsx`
- 表单字段：用户名/邮箱 + 密码
- 提交调用 `signIn("credentials", { ... })`
- 错误提示（用户名或密码错误）
- 链接到注册页

**文件：** `src/app/(auth)/register/page.tsx`
- 表单字段：用户名 + 邮箱 + 密码 + 确认密码
- 前端校验（zod）
- 提交调用 `POST /api/auth/register`
- 成功后跳转到登录页
- 链接到登录页

#### 3.5 验证 ✅ 已完成

```bash
# 1. 访问 /register → 注册新用户
# 2. 访问 /login → 登录
# 3. 访问 /dashboard → 应跳转（目前是空白页）
# 4. 登出后访问 /notes → 应重定向到 /login
```

**产出文件：**
- `src/lib/auth.ts`
- `src/app/api/auth/register/route.ts`
- `src/app/api/auth/[...nextauth]/route.ts`
- `src/middleware.ts`
- `src/app/(auth)/layout.tsx`
- `src/app/(auth)/login/page.tsx`
- `src/app/(auth)/register/page.tsx`

---

### 第 4 步：主布局 + 导航 ✅ 已完成

**目标：** 桌面侧边栏 + 移动端底部导航 + 主题切换

#### 4.1 根布局 ✅ 已完成

**文件：** `src/app/layout.tsx`
- 字体：`Inter` + `Noto Sans SC`（next/font）
- `<ThemeProvider>` 包裹（next-themes）
- `<Toaster>` 组件（sonner）
- 全局 CSS 变量（主题色）

#### 4.2 主应用布局 ✅ 已完成

**文件：** `src/app/(main)/layout.tsx`
- 左侧 `<AppSidebar>` 桌面端固定（min-width: 1024px）
- 底部 `<MobileNav>` 移动端显示（max-width: 1023px）
- 顶部 `<Header>` 含用户头像 + 登出按钮 + 主题切换

#### 4.3 侧边栏 ✅ 已完成

**文件：** `src/components/layout/app-sidebar.tsx`
- 导航项：Dashboard、笔记、知识库、对话、回收站
- 当前路由高亮
- 折叠/展开按钮
- 使用 shadcn `Sidebar` 组件

#### 4.4 移动端导航 ✅ 已完成

**文件：** `src/components/layout/mobile-nav.tsx`
- 底部固定 Tab Bar（4 个图标）

#### 4.5 主题切换 ✅ 已完成

**文件：** `src/components/layout/theme-toggle.tsx`
- 太阳/月亮图标切换
- 使用 `useTheme()` from next-themes

#### 4.6 验证 ✅ 已完成

```bash
# 1. 登录后看到侧边栏 + 顶部栏
# 2. 点击导航项切换页面
# 3. 切换深色/浅色主题
# 4. 移动端视口 → 底部 Tab Bar 出现
```

**产出文件：**
- `src/app/layout.tsx`（更新：ThemeProvider + Toaster）
- `src/app/page.tsx`（根页重定向到 /dashboard）
- `src/app/(main)/layout.tsx`
- `src/app/(main)/dashboard/page.tsx`（占位页面）
- `src/components/layout/app-sidebar.tsx`
- `src/components/layout/mobile-nav.tsx`
- `src/components/layout/header.tsx`
- `src/components/layout/theme-toggle.tsx`

---

### 第 5 步：笔记 CRUD + 软删除 + 回收站 + 关键词搜索

**目标：** 完整的笔记管理功能

#### 5.1 API 实现

**文件：** `src/app/api/notes/route.ts`

```typescript
// GET /api/notes?page=1&limit=20&category=WORK&search=关键词
export async function GET(req: Request) {
  const session = await auth();
  const { page, limit, category, search } = parseQuery(req);

  const where = {
    userId: session.user.id,
    deletedAt: null,
    ...(category && { category }),
    ...(search && {
      OR: [
        { title: { contains: search, mode: "insensitive" } },
        { content: { contains: search, mode: "insensitive" } },
      ],
    }),
  };

  const [notes, total] = await Promise.all([
    prisma.note.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.note.count({ where }),
  ]);

  return NextResponse.json({ data: notes, total, page, limit });
}

// POST /api/notes
export async function POST(req: Request) {
  const session = await auth();
  const body = await req.json();
  // zod 校验 title(1-200), content, category, tags
  const note = await prisma.note.create({
    data: { ...body, userId: session.user.id },
  });
  return NextResponse.json({ data: note }, { status: 201 });
}
```

**文件：** `src/app/api/notes/[id]/route.ts`

```typescript
// GET /api/notes/[id] → 返回单篇笔记
// PUT /api/notes/[id] → 更新笔记
// DELETE /api/notes/[id] → 软删除（SET deletedAt = new Date()）
```

**文件：** `src/app/api/trash/route.ts`

```typescript
// GET /api/trash → 返回已删除笔记列表
// WHERE userId = session.user.id AND deletedAt IS NOT NULL
```

**文件：** `src/app/api/trash/[id]/route.ts`

```typescript
// PUT /api/trash/[id] → 恢复笔记（SET deletedAt = null）
// DELETE /api/trash/[id] → 永久删除（prisma.note.delete）
```

#### 5.2 笔记列表页

**文件：** `src/app/(main)/notes/page.tsx`

**布局：**
- 顶部：标题 "我的笔记" + 新建按钮 + 搜索框
- 分类 Tab：全部 / 工作 / 学习 / 生活 / 项目
- 卡片网格：2 列桌面 / 1 列移动端
- 无限滚动：Intersection Observer 触发加载下一页

**组件拆分：**
- `note-card.tsx` — 单张笔记卡片（标题 + 内容预览 + 分类 Badge + 标签 + 时间）
- `note-list.tsx` — 列表容器 + 无限滚动逻辑
- `note-filters.tsx` — 分类 Tab
- `note-search.tsx` — 搜索输入框（debounce 300ms）

#### 5.3 笔记编辑页

**文件：** `src/app/(main)/notes/[id]/page.tsx`

**布局：**
- 顶部：返回按钮 + 标题输入 + 分类选择 + 标签编辑 + 删除按钮
- 主体：Milkdown 编辑器

**自动保存逻辑：**
```typescript
// useDebounce hook，1500ms 延迟
// 内容变化时自动调用 PUT /api/notes/[id]
// 保存状态指示器："已保存" / "保存中..."
```

**Milkdown 编辑器集成：**
```typescript
// 使用 @milkdown/react 的 Milkdown 组件
// 启用插件：GFM、代码高亮、数学公式
// 工具栏：加粗/斜体/标题/列表/代码块/链接/图片
```

#### 5.4 回收站页面

**文件：** `src/app/(main)/trash/page.tsx`

**布局：**
- 列表展示已删除笔记
- 每条记录：标题 + 删除时间 + 恢复按钮 + 永久删除按钮
- 永久删除弹出确认对话框

#### 5.5 验证

```bash
# 1. 创建 3 篇不同分类的笔记
# 2. 分类筛选 → 只显示对应分类
# 3. 搜索关键词 → 正确匹配标题/内容
# 4. 删除笔记 → 从列表消失 → 回收站出现
# 5. 恢复笔记 → 回到列表
# 6. 永久删除 → 数据库无记录
```

**产出文件：**
- `src/app/api/notes/route.ts`
- `src/app/api/notes/[id]/route.ts`
- `src/app/api/trash/route.ts`
- `src/app/api/trash/[id]/route.ts`
- `src/app/(main)/notes/page.tsx`
- `src/app/(main)/notes/[id]/page.tsx`
- `src/app/(main)/trash/page.tsx`
- `src/components/notes/note-card.tsx`
- `src/components/notes/note-list.tsx`
- `src/components/notes/note-editor.tsx`
- `src/components/notes/note-filters.tsx`
- `src/components/notes/note-search.tsx`
- `src/components/trash/trash-list.tsx`

---

### 第 6 步：AI 基础设施（DashScope + Embedding + Rerank）

**目标：** 封装 DashScope API 客户端 + 文本向量化 + LLM 重排序

#### 6.1 DashScope 客户端

**文件：** `src/lib/ai/dashscope.ts`

```typescript
import { createOpenAI } from "@ai-sdk/openai";

export const dashscope = createOpenAI({
  baseURL: process.env.DASHSCOPE_BASE_URL!,
  apiKey: process.env.DASHSCOPE_API_KEY!,
});

export const chatModel = dashscope(process.env.DASHSCOPE_CHAT_MODEL || "qwen-plus");
```

#### 6.2 文本向量化

**文件：** `src/lib/ai/embeddings.ts`

```typescript
import { embed, embedMany } from "ai";
import { dashscope } from "./dashscope";

const EMBEDDING_MODEL = process.env.DASHSCOPE_EMBEDDING_MODEL || "text-embedding-v3";
const EMBEDDING_DIM = 1536;

const embeddingModel = dashscope.embedding(EMBEDDING_MODEL);

export async function embedText(text: string): Promise<number[]> {
  const { embedding } = await embed({ model: embeddingModel, value: text });
  return embedding;
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  // DashScope embedding API 支持批量，但单次最多 25 条
  // 分批处理，每批 25 条
  const BATCH_SIZE = 25;
  const results: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const { embeddings } = await embedMany({ model: embeddingModel, values: batch });
    results.push(...embeddings);
  }
  return results;
}
```

#### 6.3 LLM 重排序

**文件：** `src/lib/ai/rerank.ts`

```typescript
import { generateObject } from "ai";
import { z } from "zod";
import { chatModel } from "./dashscope";

interface Chunk {
  id: string;
  content: string;
  score: number;
}

export async function rerank(query: string, chunks: Chunk[], topK = 5): Promise<Chunk[]> {
  const { object } = await generateObject({
    model: chatModel,
    schema: z.object({
      rankedIds: z.array(z.string()),
    }),
    prompt: `Given the query: "${query}"
Rank the following document chunks by relevance (most relevant first):
${chunks.map((c) => `[ID: ${c.id}] ${c.content.substring(0, 200)}`).join("\n")}
Return the IDs of the top ${topK} most relevant chunks, ordered from most to least relevant.`,
  });

  return object.rankedIds
    .map((id) => chunks.find((c) => c.id === id))
    .filter(Boolean) as Chunk[];
}
```

#### 6.4 验证

```bash
# 在 Node REPL 或测试脚本中：
# 1. embedText("测试文本") → 返回 1536 维数组
# 2. embedBatch(["文本1", "文本2"]) → 返回二维数组
# 3. rerank("问题", [...chunks]) → 返回排序后的 chunks
```

**产出文件：**
- `src/lib/ai/dashscope.ts`
- `src/lib/ai/embeddings.ts`
- `src/lib/ai/rerank.ts`

---

### 第 7 步：知识库 — 文档上传 + 向量化

**目标：** 实现文档上传/解析/切片/向量化完整流水线

#### 7.1 文档解析器

**文件：** `src/lib/rag/parsers.ts`

```typescript
import pdfParse from "pdf-parse";
import mammoth from "mammoth";

export async function parseDocument(
  file: File | Blob,
  mimeType: string
): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());

  switch (mimeType) {
    case "text/plain":
    case "text/markdown":
      return buffer.toString("utf-8");

    case "application/pdf":
      const pdfData = await pdfParse(buffer);
      return pdfData.text;

    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      const docxResult = await mammoth.extractRawText({ buffer });
      return docxResult.value;

    default:
      throw new Error(`Unsupported file type: ${mimeType}`);
  }
}
```

#### 7.2 文本切片

**文件：** `src/lib/rag/chunking.ts`

```typescript
interface Chunk {
  content: string;
  chunkIndex: number;
  metadata: { startChar: number; endChar: number };
}

export function chunkText(
  text: string,
  chunkSize = 500,  // tokens ≈ chars / 4
  overlap = 50
): Chunk[] {
  const charChunkSize = chunkSize * 4;
  const charOverlap = overlap * 4;
  const chunks: Chunk[] = [];

  let start = 0;
  let index = 0;

  while (start < text.length) {
    const end = Math.min(start + charChunkSize, text.length);
    const content = text.substring(start, end).trim();

    if (content.length > 0) {
      chunks.push({
        content,
        chunkIndex: index,
        metadata: { startChar: start, endChar: end },
      });
      index++;
    }

    if (end >= text.length) break;
    start = end - charOverlap;
  }

  return chunks;
}
```

#### 7.3 向量化 + 写入

**文件：** `src/lib/rag/vectorize.ts`

```typescript
import { prisma } from "@/lib/db";
import { embedBatch } from "@/lib/ai/embeddings";

export async function vectorizeAndStore(
  documentId: string,
  userId: string,
  chunks: { content: string; chunkIndex: number; metadata: any }[]
): Promise<number> {
  // 批量向量化
  const texts = chunks.map((c) => c.content);
  const embeddings = await embedBatch(texts);

  // 写入 KnowledgeChunk 表
  for (let i = 0; i < chunks.length; i++) {
    const embedding = embeddings[i];
    await prisma.$executeRaw`
      INSERT INTO "KnowledgeChunk" (id, "documentId", "userId", content, "chunkIndex", metadata, embedding)
      VALUES (${crypto.randomUUID()}, ${documentId}, ${userId}, ${chunks[i].content}, ${chunks[i].chunkIndex}, ${JSON.stringify(chunks[i].metadata)}::jsonb, ${`[${embedding.join(",")}]`}::vector)
    `;
  }

  // 更新文档状态
  await prisma.knowledgeDocument.update({
    where: { id: documentId },
    data: { status: "COMPLETED", chunkCount: chunks.length },
  });

  return chunks.length;
}
```

#### 7.4 上传 API

**文件：** `src/app/api/knowledge/upload/route.ts`

```typescript
export async function POST(req: Request) {
  const session = await auth();
  const formData = await req.formData();
  const file = formData.get("file") as File;

  // 校验文件类型
  const allowedTypes = ["text/plain", "application/pdf", "text/markdown",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
  if (!allowedTypes.includes(file.type)) {
    return error("UNSUPPORTED_TYPE", 415);
  }

  // 校验文件大小（50MB）
  if (file.size > 50 * 1024 * 1024) {
    return error("FILE_TOO_LARGE", 413);
  }

  // 计算 MD5
  const buffer = Buffer.from(await file.arrayBuffer());
  const md5 = crypto.createHash("md5").update(buffer).digest("hex");

  // 去重检查
  const existing = await prisma.knowledgeDocument.findUnique({
    where: { userId_md5: { userId: session.user.id, md5 } },
  });
  if (existing) return error("DUPLICATE", 409);

  // 创建文档记录
  const doc = await prisma.knowledgeDocument.create({
    data: { userId: session.user.id, filename: file.name, mimeType: file.type, md5 },
  });

  // 解析 → 切片 → 向量化
  try {
    const text = await parseDocument(file, file.type);
    const chunks = chunkText(text);
    await vectorizeAndStore(doc.id, session.user.id, chunks);
  } catch (err) {
    await prisma.knowledgeDocument.update({
      where: { id: doc.id },
      data: { status: "FAILED" },
    });
    throw err;
  }

  return NextResponse.json({ data: doc });
}
```

#### 7.5 知识库管理 API

**文件：** `src/app/api/knowledge/route.ts`
- `GET` — 文档列表（按 userId 隔离，分页）

**文件：** `src/app/api/knowledge/[id]/route.ts`
- `GET` — 文档详情（含切片列表）
- `DELETE` — 删除文档 + 级联删除切片

#### 7.6 前端页面

**文件：** `src/app/(main)/knowledge/page.tsx`

**布局：**
- 拖拽上传区（react-dropzone，虚线边框，拖入高亮）
- 上传进度指示
- 文档列表（表格/卡片：文件名、类型图标、切片数、状态、时间、删除按钮）

**文件：** `src/app/(main)/knowledge/[id]/page.tsx`
- 文档元信息
- 切片列表（可折叠卡片，显示序号 + 内容预览）

#### 7.7 验证

```bash
# 1. 上传 TXT 文件 → 状态 COMPLETED → 切片数 > 0
# 2. 上传 PDF 文件 → 解析成功 → 切片
# 3. 上传同一文件 → 返回 409 DUPLICATE
# 4. 上传 > 50MB 文件 → 返回 413
# 5. 删除文档 → 切片一并删除
```

**产出文件：**
- `src/lib/rag/parsers.ts`
- `src/lib/rag/chunking.ts`
- `src/lib/rag/vectorize.ts`
- `src/app/api/knowledge/upload/route.ts`
- `src/app/api/knowledge/route.ts`
- `src/app/api/knowledge/[id]/route.ts`
- `src/app/(main)/knowledge/page.tsx`
- `src/app/(main)/knowledge/[id]/page.tsx`
- `src/components/knowledge/file-upload.tsx`
- `src/components/knowledge/document-list.tsx`

---

### 第 8 步：RAG 对话（流式 + 混合检索）

**目标：** 实现完整的 RAG 问答流程 + 会话管理

#### 8.1 混合检索

**文件：** `src/lib/rag/search.ts`

```typescript
import { prisma } from "@/lib/db";
import { embedText } from "@/lib/ai/embeddings";
import { rerank } from "@/lib/ai/rerank";
import { create, insert, search } from "@orama/orama";

interface SearchResult {
  id: string;
  content: string;
  filename: string;
  chunkIndex: number;
  score: number;
}

export async function hybridSearch(
  query: string,
  userId: string,
  topK = 5
): Promise<SearchResult[]> {
  // 1. 向量化查询
  const queryEmbedding = await embedText(query);

  // 2. 向量检索（pgvector）
  const vectorResults = await prisma.$queryRaw`
    SELECT kc.id, kc.content, kc."chunkIndex", kd.filename,
           1 - (kc.embedding <=> ${`[${queryEmbedding.join(",")}]`}::vector) as score
    FROM "KnowledgeChunk" kc
    JOIN "KnowledgeDocument" kd ON kc."documentId" = kd.id
    WHERE kc."userId" = ${userId}
    ORDER BY kc.embedding <=> ${`[${queryEmbedding.join(",")}]`}::vector
    LIMIT 20
  `;

  // 3. BM25 检索（orama）
  const db = await create({
    schema: { content: "string", id: "string" },
  });
  // 加载用户所有切片到 orama 内存索引
  const allChunks = await prisma.knowledgeChunk.findMany({
    where: { userId },
    select: { id: true, content: true },
  });
  for (const chunk of allChunks) {
    await insert(db, { id: chunk.id, content: chunk.content });
  }
  const bm25Results = await search(db, { term: query, limit: 20 });

  // 4. RRF 融合
  const rrfScores = new Map<string, number>();
  const K = 60; // RRF 常数

  vectorResults.forEach((r: any, rank: number) => {
    rrfScores.set(r.id, (rrfScores.get(r.id) || 0) + 1 / (K + rank + 1));
  });
  bm25Results.hits.forEach((hit: any, rank: number) => {
    rrfScores.set(hit.id, (rrfScores.get(hit.id) || 0) + 1 / (K + rank + 1));
  });

  // 按 RRF 分数排序，取 top 10
  const topIds = [...rrfScores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id]) => id);

  const topChunks = await prisma.knowledgeChunk.findMany({
    where: { id: { in: topIds } },
    include: { document: true },
  });

  // 5. LLM Rerank
  const reranked = await rerank(query, topChunks.map((c) => ({
    id: c.id,
    content: c.content,
    score: rrfScores.get(c.id) || 0,
  })), topK);

  return reranked.map((r) => {
    const chunk = topChunks.find((c) => c.id === r.id)!;
    return {
      id: r.id,
      content: r.content,
      filename: chunk.document.filename,
      chunkIndex: chunk.chunkIndex,
      score: r.score,
    };
  });
}
```

#### 8.2 对话 API

**文件：** `src/app/api/chat/route.ts`

```typescript
import { streamText } from "ai";
import { chatModel } from "@/lib/ai/dashscope";
import { hybridSearch } from "@/lib/rag/search";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  const session = await auth();
  const userId = session.user.id;
  const { message, sessionId } = await req.json();

  // 获取或创建会话
  let sid = sessionId;
  if (!sid) {
    const chatSession = await prisma.chatSession.create({
      data: { userId, title: message.substring(0, 50) },
    });
    sid = chatSession.id;
  }

  // 保存用户消息
  await prisma.chatMessage.create({
    data: { sessionId: sid, role: "USER", content: message },
  });

  // 获取对话历史（最近 10 轮）
  const history = await prisma.chatMessage.findMany({
    where: { sessionId: sid },
    orderBy: { createdAt: "asc" },
    take: 20,
  });

  // 混合检索
  const sources = await hybridSearch(message, userId);

  // 构建上下文
  const context = sources.map((s) => `[${s.filename} - chunk ${s.chunkIndex}]\n${s.content}`).join("\n\n");

  const result = streamText({
    model: chatModel,
    system: `你是一个知识助手。基于以下检索到的文档片段回答用户问题。如果文档中没有相关信息，请诚实说明。

检索到的文档：
${context}`,
    messages: [
      ...history.map((m) => ({
        role: m.role.toLowerCase(),
        content: m.content,
      })),
    ],
    onFinish: async ({ text }) => {
      // 保存助手消息
      await prisma.chatMessage.create({
        data: {
          sessionId: sid,
          role: "ASSISTANT",
          content: text,
          sources: JSON.stringify(sources),
        },
      });
    },
  });

  return result.toDataStreamResponse();
}
```

#### 8.3 会话管理 API

**文件：** `src/app/api/chat/sessions/route.ts`
- `GET` — 会话列表（按 userId，最近更新的在前）

```typescript
// 使用子查询获取每个 session 的最后一条消息作为 lastMessage
const sessions = await prisma.chatSession.findMany({
  where: { userId },
  orderBy: { updatedAt: "desc" },
  include: {
    messages: {
      orderBy: { createdAt: "desc" },
      take: 1,
      select: { content: true },
    },
  },
});
// 映射 lastMessage 字段
return sessions.map((s) => ({
  ...s,
  lastMessage: s.messages[0]?.content?.substring(0, 100) ?? "",
  messages: undefined,
}));
```

**文件：** `src/app/api/chat/sessions/[id]/route.ts`
- `GET` — 获取会话消息历史
- `DELETE` — 删除会话 + 级联删除消息

#### 8.4 前端对话页面

**文件：** `src/app/(main)/chat/page.tsx`

**布局：**
- 左侧：会话列表（可折叠）
  - 新建会话按钮
  - 会话项（标题 + 时间 + 删除按钮）
- 右侧：对话主区域
  - 消息列表（自动滚动到底部）
  - 来源引用折叠面板
  - 输入框（Shift+Enter 换行，Enter 发送）

**使用 Vercel AI SDK useChat hook：**
```typescript
const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
  api: "/api/chat",
  body: { sessionId: currentSessionId },
});
```

**组件拆分：**
- `chat-input.tsx` — 输入框 + 发送按钮
- `message-list.tsx` — 消息列表容器
- `message-item.tsx` — 单条消息（Markdown 渲染 + 代码高亮）
- `source-refs.tsx` — 来源文档引用（可折叠 Accordion）
- `session-list.tsx` — 会话列表侧栏

#### 8.5 验证

```bash
# 1. 先上传文档到知识库
# 2. 在对话页面提问与文档相关的问题
# 3. 验证流式输出正常
# 4. 验证来源引用显示正确
# 5. 新建会话 → 会话列表更新
# 6. 切换会话 → 历史消息正确加载
# 7. 删除会话 → 会话和消息清除
```

**产出文件：**
- `src/lib/rag/search.ts`
- `src/app/api/chat/route.ts`
- `src/app/api/chat/sessions/route.ts`
- `src/app/api/chat/sessions/[id]/route.ts`
- `src/app/(main)/chat/page.tsx`
- `src/app/(main)/chat/[sessionId]/page.tsx`
- `src/components/chat/chat-input.tsx`
- `src/components/chat/message-list.tsx`
- `src/components/chat/message-item.tsx`
- `src/components/chat/source-refs.tsx`
- `src/components/chat/session-list.tsx`

---

### 第 9 步：Dashboard 仪表盘

**目标：** 展示统计信息和快速操作入口

#### 9.1 统计 API

**文件：** `src/app/api/notes/route.ts`（扩展现有 GET handler）

```typescript
// 在 GET /api/notes 中添加 stats 参数处理
const { page, limit, category, search, stats } = parseQuery(req);

if (stats === "true") {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [totalNotes, thisWeek, byCategory, recentNotes] = await Promise.all([
    prisma.note.count({ where: { userId, deletedAt: null } }),
    prisma.note.count({ where: { userId, deletedAt: null, createdAt: { gte: weekAgo } } }),
    prisma.note.groupBy({ by: ["category"], where: { userId, deletedAt: null }, _count: true }),
    prisma.note.findMany({
      where: { userId, deletedAt: null },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: { id: true, title: true, updatedAt: true },
    }),
  ]);

  return NextResponse.json({
    data: { totalNotes, thisWeek, byCategory, recentNotes },
  });
}
```

同时在 `src/app/api/dashboard/route.ts` 中聚合知识库和对话统计：

```typescript
// GET /api/dashboard — 聚合全部统计数据
const [noteStats, docCount, sessionCount] = await Promise.all([
  // ...notes 统计（同上）
  prisma.knowledgeDocument.count({ where: { userId, status: "COMPLETED" } }),
  prisma.chatSession.count({ where: { userId } }),
]);
```

#### 9.2 Dashboard 页面

**文件：** `src/app/(main)/dashboard/page.tsx`

**布局：**
- 统计卡片行（4 列桌面 / 2 列移动端）：
  - 笔记总数、本周新增、知识库文档数、对话会话数
- 快速操作区（3 个按钮）：
  - 新建笔记 → `/notes/new`
  - 上传文档 → `/knowledge`
  - 开始对话 → `/chat`
- 最近笔记列表（最近 5 篇，点击进入编辑）

**产出文件：**
- `src/app/(main)/dashboard/page.tsx`

---

### 第 10 步：用户资料

**目标：** 查看和编辑个人信息

#### 10.1 API

**文件：** `src/app/api/user/route.ts`
- `GET` — 返回当前用户信息
- `PUT` — 更新用户资料（username/avatar/bio）

#### 10.2 前端

集成到 Header 组件：
- 点击用户头像 → 弹出 Sheet/Dialog
- 表单：头像 URL、用户名、简介
- 保存按钮

**产出文件：**
- `src/app/api/user/route.ts`

---

### 第 11 步：收尾 + UX 完善

**目标：** 全局错误处理、Loading 状态、空状态、响应式测试

#### 11.1 全局错误处理

**文件：** `src/app/error.tsx`
- 友好的错误页面 + "重试" 按钮

**文件：** `src/app/not-found.tsx`
- 404 页面 + 返回首页链接

#### 11.2 Loading 骨架屏

**文件：**
- `src/app/(main)/notes/loading.tsx` — 笔记列表骨架
- `src/app/(main)/chat/loading.tsx` — 对话页骨架
- `src/app/(main)/knowledge/loading.tsx` — 知识库骨架

#### 11.3 空状态组件

**文件：** `src/components/shared/empty-state.tsx`

```typescript
interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
}
```

在各列表页使用：
- 笔记列表为空 → "创建你的第一篇笔记"
- 知识库为空 → "上传文档开始构建知识库"
- 对话列表为空 → "开始你的第一次 AI 对话"
- 回收站为空 → "回收站是空的"

#### 11.4 确认对话框

**文件：** `src/components/shared/confirm-dialog.tsx`

```typescript
interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  onConfirm: () => void;
  variant?: "destructive" | "default";
}
```

在所有删除操作中使用（笔记删除、文档删除、会话删除、永久删除）。

#### 11.5 响应式测试

测试断点：
- 桌面：1280px+
- 平板：768px - 1279px
- 手机：375px - 767px

检查项：
- 侧边栏在桌面显示，移动端隐藏
- 卡片网格自适应列数
- 对话页面侧栏可折叠
- 表单在移动端全宽

#### 11.6 深色/浅色主题测试

- 切换主题 → 所有组件颜色正确
- 代码高亮在两种主题下可读
- Markdown 渲染样式正确

**产出文件：**
- `src/app/error.tsx`
- `src/app/not-found.tsx`
- `src/app/(main)/notes/loading.tsx`
- `src/app/(main)/chat/loading.tsx`
- `src/app/(main)/knowledge/loading.tsx`
- `src/components/shared/empty-state.tsx`
- `src/components/shared/confirm-dialog.tsx`

---

## 4. 数据库 ER 设计

```
┌──────────────┐     1:N     ┌──────────────┐
│    User      │────────────▶│    Note       │
│──────────────│             │──────────────│
│ id (uuid PK) │             │ id (uuid PK) │
│ username     │             │ userId (FK)  │
│ email        │             │ title        │
│ password     │             │ content      │
│ avatar?      │             │ category     │
│ bio?         │             │ tags[]       │
│ createdAt    │             │ embedding?   │
│ updatedAt    │             │ deletedAt?   │
└──────────────┘             │ createdAt    │
       │                     │ updatedAt    │
       │ 1:N                 └──────────────┘
       ├──────────────────▶┌──────────────────┐
       │                   │  ChatSession     │
       │                   │──────────────────│
       │                   │ id (uuid PK)     │
       │                   │ userId (FK)      │
       │                   │ title            │
       │                   │ createdAt        │
       │                   │ updatedAt        │
       │                   └────────┬─────────┘
       │                            │ 1:N (Cascade Delete)
       │                            ▼
       │                   ┌──────────────────┐
       │                   │  ChatMessage     │
       │                   │──────────────────│
       │                   │ id (uuid PK)     │
       │                   │ sessionId (FK)   │
       │                   │ role             │
       │                   │ content          │
       │                   │ sources? (JSON)  │
       │                   │ createdAt        │
       │                   └──────────────────┘
       │
       │ 1:N
       ├──────────────────▶┌──────────────────────┐
       │                   │ KnowledgeDocument     │
       │                   │──────────────────────│
       │                   │ id (uuid PK)         │
       │                   │ userId (FK)          │
       │                   │ filename             │
       │                   │ mimeType             │
       │                   │ md5                  │
       │                   │ chunkCount           │
       │                   │ status               │
       │                   │ createdAt            │
       │                   │ UNIQUE(userId, md5)  │
       │                   └────────┬─────────────┘
       │                            │ 1:N (Cascade Delete)
       │                            ▼
       │                   ┌──────────────────────┐
       │                   │ KnowledgeChunk        │
       │                   │──────────────────────│
       │                   │ id (uuid PK)         │
       │                   │ documentId (FK)      │
       │                   │ userId (FK)          │
       │                   │ content              │
       │                   │ embedding? (vector)  │
       │                   │ metadata? (JSON)     │
       │                   │ chunkIndex           │
       │                   └──────────────────────┘
```

### 关键索引
- `Note.embedding` — IVFFlat 向量索引（cosine）
- `KnowledgeChunk.embedding` — IVFFlat 向量索引（cosine）
- `KnowledgeDocument(userId, md5)` — 联合唯一约束
- `Note(userId, deletedAt)` — 复合索引（加速列表+回收站查询）
- `Note(userId, category)` — 复合索引（加速分类筛选）
- `ChatMessage(sessionId, createdAt)` — 复合索引
- `ChatSession(userId)` — 索引
- `KnowledgeDocument(userId)` — 索引
- `KnowledgeChunk(documentId)` — 索引
- `KnowledgeChunk(userId)` — 索引

---

## 5. 验证计划

### 启动流程
```bash
# 1. 启动数据库
docker-compose up -d

# 2. 执行数据库迁移
pnpm prisma migrate dev

# 3. 启动开发服务器
pnpm dev
# → http://localhost:3000
```

### 验证清单

**认证系统：**
- [ ] 注册（用户名/邮箱/密码）→ 成功创建 → 跳转登录
- [ ] 登录 → 跳转 Dashboard
- [ ] 未登录访问保护路由 → 重定向到 /login
- [ ] 登出 → 清除会话 → 重定向到 /login

**笔记管理：**
- [ ] 创建笔记 → 列表中出现
- [ ] 编辑笔记 → Markdown 编辑器正常（GFM/代码/公式）
- [ ] 自动保存 → 修改 1.5s 后自动存储
- [ ] 分类筛选 → 按分类过滤结果正确
- [ ] 关键词搜索 → 标题/内容匹配
- [ ] 分页 → 无限滚动加载

**回收站：**
- [ ] 删除笔记 → 从列表消失 → 出现在回收站
- [ ] 恢复笔记 → 回到笔记列表
- [ ] 永久删除 → 数据彻底清除

**知识库：**
- [ ] 上传 TXT/PDF/MD/DOCX → 解析 + 向量化成功
- [ ] MD5 去重 → 同文件同用户不重复入库
- [ ] 文件 > 50MB → 拒绝上传
- [ ] 删除文档 → 关联切片一并删除
- [ ] 数据隔离 → 不同用户看不到彼此文档

**RAG 对话：**
- [ ] 提问 → 流式输出正常
- [ ] 混合检索 → 向量 + BM25 结果正确融合
- [ ] 来源引用 → 正确显示相关文档片段
- [ ] 新建会话 → 历史会话列表更新
- [ ] 切换会话 → 消息历史正确加载
- [ ] 删除会话 → 会话和消息一并清除

**UX：**
- [ ] 响应式布局（桌面 1280px / 平板 768px / 手机 375px）
- [ ] 深色/浅色主题切换正常
- [ ] 空状态引导（各列表页）
- [ ] 删除操作二次确认
- [ ] API 错误 toast 提示
- [ ] Loading 骨架屏

**安全：**
- [ ] 用户数据隔离
- [ ] 无 session 无法访问保护 API
- [ ] 密码 bcrypt 哈希存储
