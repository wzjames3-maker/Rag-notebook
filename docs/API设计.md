# RAG NoteBook — API 接口设计文档

## 1. 总览

| 分组 | 路径前缀 | 说明 |
|------|----------|------|
| 认证 | `/api/auth/*` | NextAuth 内置 + 注册 |
| 笔记 | `/api/notes/*` | 笔记 CRUD |
| 回收站 | `/api/trash/*` | 软删除管理 |
| 知识库 | `/api/knowledge/*` | 文档上传/管理 |
| 对话 | `/api/chat/*` | RAG 对话 + 会话管理 |
| 用户 | `/api/user/*` | 个人资料 |

### 通用规范

**请求头：**
- 所有保护路由需携带 NextAuth session cookie（自动管理）
- 文件上传使用 `multipart/form-data`
- 其余请求使用 `application/json`

**统一响应格式：**
```json
// 成功
{
  "data": { ... },
  "message": "操作成功"
}

// 列表（分页）
{
  "data": [ ... ],
  "total": 100,
  "page": 1,
  "limit": 20
}

// 错误
{
  "error": "ERROR_CODE",
  "message": "错误描述"
}
```

**错误码规范：**

| 错误码 | HTTP 状态码 | 说明 |
|--------|-------------|------|
| `UNAUTHORIZED` | 401 | 未登录或 session 过期 |
| `FORBIDDEN` | 403 | 无权访问该资源 |
| `NOT_FOUND` | 404 | 资源不存在 |
| `VALIDATION_ERROR` | 400 | 请求参数校验失败 |
| `DUPLICATE` | 409 | 资源已存在（如 MD5 重复） |
| `FILE_TOO_LARGE` | 413 | 文件超过大小限制 |
| `UNSUPPORTED_TYPE` | 415 | 不支持的文件类型 |
| `QUOTA_EXCEEDED` | 429 | 超过配额限制 |
| `AI_SERVICE_ERROR` | 502 | AI 服务调用失败 |
| `INTERNAL_ERROR` | 500 | 服务器内部错误 |

---

## 2. 认证接口

### POST /api/auth/register

注册新用户。

**请求体：**
```json
{
  "username": "string (3-20 字符)",
  "email": "string (合法邮箱)",
  "password": "string (6-20 字符)"
}
```

**响应（201）：**
```json
{
  "data": {
    "id": "uuid",
    "username": "string",
    "email": "string"
  },
  "message": "注册成功"
}
```

**错误：**
- `400 VALIDATION_ERROR` — 参数不合法
- `409 DUPLICATE` — 用户名或邮箱已存在

### POST /api/auth/signin

NextAuth 内置登录端点（Credentials Provider）。

**请求体：**
```json
{
  "username": "string (用户名或邮箱)",
  "password": "string"
}
```

**响应：** NextAuth 自动处理（设置 session cookie + 重定向）

### POST /api/auth/signout

NextAuth 内置登出端点。清除 session cookie。

---

## 3. 笔记接口

### GET /api/notes

获取笔记列表（分页 + 筛选 + 搜索）。

**查询参数：**
| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| page | number | 否 | 1 | 页码 |
| limit | number | 否 | 20 | 每页数量（最大 100） |
| category | string | 否 | - | 分类筛选：WORK/STUDY/LIFE/PROJECT |
| search | string | 否 | - | 关键词搜索（匹配标题和内容） |
| tag | string | 否 | - | 标签筛选 |

**响应（200）：**
```json
{
  "data": [
    {
      "id": "uuid",
      "title": "string",
      "content": "string (前 200 字符预览)",
      "category": "WORK|STUDY|LIFE|PROJECT",
      "tags": ["string"],
      "createdAt": "ISO 8601",
      "updatedAt": "ISO 8601"
    }
  ],
  "total": 42,
  "page": 1,
  "limit": 20
}
```

> 默认只返回未删除的笔记（`deletedAt IS NULL`）。

### POST /api/notes

创建笔记。

**请求体：**
```json
{
  "title": "string (1-200 字符)",
  "content": "string (Markdown)",
  "category": "WORK|STUDY|LIFE|PROJECT",
  "tags": ["string"]
}
```

**响应（201）：**
```json
{
  "data": {
    "id": "uuid",
    "title": "string",
    "content": "string",
    "category": "WORK",
    "tags": ["string"],
    "createdAt": "ISO 8601",
    "updatedAt": "ISO 8601"
  },
  "message": "笔记创建成功"
}
```

### GET /api/notes/[id]

获取单篇笔记详情。

**响应（200）：** 完整笔记对象（含完整 content）

**错误：** `404 NOT_FOUND`

### PUT /api/notes/[id]

更新笔记。

**请求体（部分更新）：**
```json
{
  "title": "string",
  "content": "string",
  "category": "WORK|STUDY|LIFE|PROJECT",
  "tags": ["string"]
}
```

**响应（200）：** 更新后的完整笔记对象

### DELETE /api/notes/[id]

软删除笔记（设置 `deletedAt = now()`）。

**响应（200）：**
```json
{
  "message": "笔记已移至回收站"
}
```

### GET /api/notes?stats=true

获取笔记统计信息（用于 Dashboard）。

**响应（200）：**
```json
{
  "data": {
    "totalNotes": 42,
    "thisWeek": 5,
    "byCategory": {
      "WORK": 15,
      "STUDY": 12,
      "LIFE": 8,
      "PROJECT": 7
    },
    "recentNotes": [
      { "id": "uuid", "title": "string", "updatedAt": "ISO 8601" }
    ]
  }
}
```

---

## 4. 回收站接口

### GET /api/trash

获取回收站列表（已软删除的笔记）。

**查询参数：**
| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| page | number | 否 | 1 | 页码 |
| limit | number | 否 | 20 | 每页数量 |

**响应（200）：** 同笔记列表格式，包含 `deletedAt` 字段

### PUT /api/trash/[id]

恢复已删除的笔记（设置 `deletedAt = NULL`）。

**响应（200）：**
```json
{
  "message": "笔记已恢复"
}
```

### DELETE /api/trash/[id]

永久删除笔记（从数据库彻底移除）。

**响应（200）：**
```json
{
  "message": "笔记已永久删除"
}
```

---

## 5. 知识库接口

### POST /api/knowledge/upload

上传文档到知识库。

**请求：** `multipart/form-data`
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| file | File | 是 | 上传文件（TXT/PDF/MD/DOCX，≤ 50MB） |

**响应（200）：**
```json
{
  "data": {
    "id": "uuid",
    "filename": "report.pdf",
    "mimeType": "application/pdf",
    "md5": "string",
    "chunkCount": 23,
    "status": "COMPLETED"
  },
  "message": "文档上传成功"
}
```

**错误：**
- `413 FILE_TOO_LARGE` — 文件超过 50MB
- `415 UNSUPPORTED_TYPE` — 不支持的文件类型
- `409 DUPLICATE` — 同 MD5 文件已存在
- `429 QUOTA_EXCEEDED` — 超过用户文档数量或容量上限

### GET /api/knowledge

获取知识库文档列表。

**查询参数：**
| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| page | number | 否 | 1 | 页码 |
| limit | number | 否 | 20 | 每页数量 |

**响应（200）：**
```json
{
  "data": [
    {
      "id": "uuid",
      "filename": "string",
      "mimeType": "string",
      "md5": "string",
      "chunkCount": 23,
      "status": "PROCESSING|COMPLETED|FAILED",
      "graphIndexed": true,
      "graphIndexing": false,
      "graphError": null,
      "graphIndexedAt": "ISO 8601 | null",
      "entityCount": 12,
      "createdAt": "ISO 8601"
    }
  ],
  "total": 10,
  "page": 1,
  "limit": 20
}
```

### GET /api/knowledge/[id]

获取文档详情（含切片列表与图谱统计）。

**响应（200）：**
```json
{
  "data": {
    "id": "uuid",
    "filename": "string",
    "mimeType": "string",
    "md5": "string",
    "chunkCount": 23,
    "status": "COMPLETED",
    "graphIndexed": true,
    "graphIndexing": false,
    "graphError": null,
    "graphIndexedAt": "ISO 8601 | null",
    "entityCount": 12,
    "relationshipCount": 18,
    "createdAt": "ISO 8601",
    "chunks": [
      {
        "id": "uuid",
        "content": "string (切片文本)",
        "chunkIndex": 0,
        "metadata": {}
      }
    ]
  }
}
```

### DELETE /api/knowledge/[id]

删除文档及其所有切片。

**响应（200）：**
```json
{
  "message": "文档已删除"
}
```

---

## 5.1 知识图谱接口

### GET /api/knowledge/graph

获取图谱数据（节点/边/统计/社区映射），用于前端可视化。

**响应（200）：**
```json
{
  "nodes": [
    {
      "key": "uuid",
      "attributes": {
        "label": "string",
        "entityType": "PERSON|ORGANIZATION|...",
        "type": "PERSON|ORGANIZATION|...",
        "description": "string",
        "degree": 3,
        "communityId": "uuid | null",
        "size": 6,
        "color": "#4E79A7"
      }
    }
  ],
  "edges": [
    {
      "key": "uuid",
      "source": "uuid",
      "target": "uuid",
      "attributes": {
        "label": "string (关系类型)",
        "description": "string | null",
        "weight": 1.0,
        "size": 1,
        "color": "#ccc"
      }
    }
  ],
  "stats": {
    "entityCount": 100,
    "relationshipCount": 200,
    "communityCount": 5,
    "entityTypes": ["PERSON", "ORGANIZATION", "..."]
  },
  "communityMap": {
    "uuid": { "title": "string | null", "summary": "string | null", "rating": 4.5 }
  }
}
```

### GET /api/knowledge/graph/stats

获取完整统计信息，含所有社区元数据和实体类型列表。

**响应（200）：**
```json
{
  "graph": {
    "entities": 100,
    "relationships": 200,
    "communities": 5,
    "reports": 5
  },
  "documents": {
    "indexed": 8,
    "indexing": 1,
    "total": 10
  },
  "communities": [
    { "id": "uuid", "size": 20, "title": "string | null", "summary": "string | null", "rating": 4.5 }
  ],
  "entityTypes": ["PERSON", "ORGANIZATION", "..."]
}
```

### POST /api/knowledge/graph/build

启动图谱构建任务（异步执行，立即返回 Job 状态）。

**请求体：**
```json
{
  "scope": "incremental | rebuild",
  "documentIds": ["uuid", "..."]  // 仅 incremental 模式必填
}
```

**行为：**
- `incremental` 模式：从指定文档提取实体/关系，末尾对**受影响社区**重新生成报告
- `rebuild` 模式：在事务中清空所有图谱数据，重新提取全部文档，运行 Louvain + 生成所有社区报告

**响应（200）：**
```json
{
  "status": "processing",
  "job": {
    "id": "uuid",
    "scope": "incremental | rebuild",
    "status": "running",
    "total": 5,
    "completed": 0,
    "failed": 0,
    "currentDoc": "report.pdf",
    "errorMsg": null,
    "startedAt": "ISO 8601",
    "finishedAt": null
  },
  "message": "已启动 5 个文档的图谱构建"
}
```

**错误：**
- `400 VALIDATION_ERROR` — 请求体字段缺失或类型错误
- `409 IN_PROGRESS` — 已有构建任务正在运行

### GET /api/knowledge/graph/build

查询当前用户的图谱构建任务最新状态。

**响应（200）：**
- 任务运行中：`{ status: "running", job: {...} }`
- 任务完成：`{ status: "completed" | "failed", job: {...} }`
- 无任务：`{ status: "no_job" }`

---

## 6. 对话接口

### POST /api/chat

RAG 对话（流式响应）。

**请求体：**
```json
{
  "message": "string (用户问题)",
  "sessionId": "uuid (可选，不传则新建会话)"
}
```

**响应：** `text/event-stream`（SSE 流式）

使用 Vercel AI SDK 的 `streamText` 协议，前端通过 `useChat` hook 消费。

流式事件格式（遵循 Vercel AI SDK 标准）：
```
data: {"type": "text", "content": "回答片段..."}

data: {"type": "sources", "sources": [
  {
    "content": "文档片段文本",
    "filename": "report.pdf",
    "chunkIndex": 3,
    "score": 0.92
  }
]}

data: {"type": "finish"}
```

**后端处理流程：**
1. 向量化用户问题（DashScope embedding）
2. 并行检索：pgvector cosine similarity (top 20) + orama BM25 (top 20)
3. RRF 融合 → top 10
4. LLM Rerank (DashScope) → top 5
5. 构建 Prompt（system + 检索上下文 + 对话历史 + 用户问题）
6. streamText 流式生成
7. 完成后持久化 ChatMessage（含 sources）

### GET /api/chat/sessions

获取会话列表。

**响应（200）：**
```json
{
  "data": [
    {
      "id": "uuid",
      "title": "string (自动生成)",
      "lastMessage": "string (最后一条消息预览)",
      "createdAt": "ISO 8601",
      "updatedAt": "ISO 8601"
    }
  ]
}
```

### GET /api/chat/sessions/[id]

获取会话消息历史。

**响应（200）：**
```json
{
  "data": {
    "id": "uuid",
    "title": "string",
    "messages": [
      {
        "id": "uuid",
        "role": "user|assistant|system",
        "content": "string",
        "sources": [
          {
            "content": "string",
            "filename": "string",
            "chunkIndex": 0,
            "score": 0.92
          }
        ],
        "createdAt": "ISO 8601"
      }
    ]
  }
}
```

### DELETE /api/chat/sessions/[id]

删除会话及其所有消息。

**响应（200）：**
```json
{
  "message": "会话已删除"
}
```

---

## 7. 用户接口

### GET /api/user

获取当前用户信息。

**响应（200）：**
```json
{
  "data": {
    "id": "uuid",
    "username": "string",
    "email": "string",
    "avatar": "string|null",
    "bio": "string|null",
    "createdAt": "ISO 8601"
  }
}
```

### PUT /api/user

更新用户资料。

**请求体（部分更新）：**
```json
{
  "username": "string",
  "avatar": "string (URL)",
  "bio": "string (≤ 500 字符)"
}
```

**响应（200）：** 更新后的用户对象

---

## 8. 数据隔离规则

所有数据查询均按 `userId` 隔离：

| 接口 | 隔离方式 |
|------|----------|
| 笔记 | `WHERE userId = session.userId` |
| 回收站 | `WHERE userId = session.userId AND deletedAt IS NOT NULL` |
| 知识库 | `WHERE userId = session.userId` |
| 对话/会话 | `WHERE userId = session.userId` |
| RAG 检索 | `WHERE userId = session.userId`（pgvector + orama 查询均带此条件） |
| MD5 去重 | `UNIQUE(userId, md5)` 联合唯一约束 |
