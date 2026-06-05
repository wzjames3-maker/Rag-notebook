# 知识图谱端到端测试

## 启动

```bash
docker-compose up -d                # PostgreSQL + pgvector
npx prisma migrate deploy          # 应用迁移（含 GraphBuildJob 表）
npx next dev -p 3000                # 启动开发服务器
```

## 7 步手测流程

### 1. 上传与解析

1. 登录账号
2. 进入「知识库」页（默认在「文档」tab）
3. 上传 3 个不同文档（TXT / Markdown / PDF 各一）
4. 预期：列表出现 3 行；状态依次 PROCESSING → COMPLETED；右侧文档统计面板数字更新

### 2. 增量构建

1. 勾选 2 个 COMPLETED 状态的文档
2. 点击「增量构建图谱」按钮
3. 预期：toast 提示「已启动 2 个文档的图谱构建」；顶部出现 sticky 进度 banner，2-3 秒后消失
4. 完成后：列表行显示「已索引」徽章 + 「N 个实体」

### 3. 图谱可视化

1. 切到「图谱」tab
2. 预期：节点加载完成；右上角出现 legend（社区色块 + 实体类型）
3. 点任一节点：右侧出现详情面板，显示名称、类型、所属社区（带 title 和 summary）、描述
4. 切换实体类型下拉：节点过滤
5. 切换社区下拉：节点过滤
6. 搜索框输入文字：节点过滤

### 4. 全量重建 + 进度恢复

1. 在「文档」tab 点击右侧「全量重建图谱」按钮
2. 预期：弹出确认 dialog 提示「将删除所有现有图谱数据」
3. 确认 → 进度 banner 出现在顶部
4. 浏览器刷新页面
5. 预期：banner 仍然显示（从 `GET /api/knowledge/graph/build` 恢复）
6. 完成后：列表中所有文档 `graphIndexed=true`、banner 消失

### 5. 失败注入与重试

1. 准备一个 LLM API key 无效的环境（修改 `.env.local` 中 `DASHSCOPE_API_KEY` 为空字符串）
2. 重启 dev server
3. 上传一个新文档，等状态变 COMPLETED
4. 增量构建该文档
5. 预期：列表行出现红色边框 + 「图谱错误: ...」文本
6. 行的「重试」按钮（旋转的 network 图标）可点击
7. 修好 API key 后点重试 → 文档应被成功索引

### 6. Agent 工具调用

1. 进入「AI 对话」页
2. 输入"为这个文档构建图谱"或"查看知识图谱社区"
3. 预期：agent 调用 `build_graph` / `community_summary` / `graph_explore` 工具并返回结果
4. 关键调用点：
   - `build_graph(documentId)` → 同步返回 `{indexed, failed, community}` 结果
   - `community_summary(query)` → 返回最相关的社区报告列表
   - `graph_explore(entityName, hops=2)` → 返回多跳关系

### 7. 统计 tab

1. 切到「统计」tab
2. 预期：4 张卡片显示「实体 / 关系 / 社区 / 已索引文档」数量
3. 数字应与图谱 tab 中显示的统计一致

## 自动化检查

```bash
npx tsc --noEmit
npx next build
```

预期：0 错误，构建成功，routes 数 = 25。

## 关键 API 路由

| 路由 | 方法 | 说明 |
|---|---|---|
| `/api/knowledge/graph` | GET | 图谱数据（节点/边/统计/社区映射） |
| `/api/knowledge/graph/stats` | GET | 完整统计（含 entityTypes 和 communities 列表） |
| `/api/knowledge/graph/build` | POST | 启动构建任务 |
| `/api/knowledge/graph/build` | GET | 查询最新任务状态 |
