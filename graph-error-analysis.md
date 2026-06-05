# 知识图谱可视化错误分析报告

> 分析时间：2026-06-04 | 项目：LangChain-RAG-supabase

---

## 🔴 严重问题：`generateObject` JSON Schema 格式不兼容

### 根本原因
`ai` SDK 的 `generateObject()` 在传入 Zod schema 时，**默认发送** `response_format: { type: 'json_schema', json_schema: {...} }`。

但 **Sensenova API 的 `deepseek-v4-flash` 模型不支持 `json_schema` 格式**，只支持 `json_object`。

API 返回错误：
```
Model 'deepseek/deepseek-v4-flash' does not support 'json_schema' response format.
Supported formats: json_object.
```

### 影响范围

| 文件 | 功能 | 严重程度 | 说明 |
|------|------|---------|------|
| `src/lib/graph/reporter.ts` (L26-31) | 社区报告生成 `generateCommunityReports()` | 🔴 必定失败 | 测试运行中两次都报错 |
| `src/lib/graph/extractor.ts` (L29-34) | 实体关系提取 `extractFromChunks()` | 🟡 可能不稳定 | 测试中偶发成功（可能有 SDK 自动降级） |

### 直接后果

1. **社区报告全部为空** — `GraphLegend` 面板只显示社区 ID，没有标题和摘要
2. **图谱 sidebar 缺失** — `NodeDetailPanel` 的"所属社区"卡片无信息
3. **entity extraction 不可靠** — 如果提取失败，整个图谱为空，前端显示"暂无图谱数据"

### 修复方案

在两个文件中，给 `generateObject()` 调用添加 `mode: "json"` 参数：

```typescript
// extractor.ts (L29)
const result = await generateObject({
  model: chatModel,
  schema: ExtractionSchema,
  system: ENTITY_EXTRACTION_PROMPT,
  prompt: combinedText,
  maxOutputTokens: 8192,
  mode: "json",  // ← 添加：强制使用 json_object 格式
});

// reporter.ts (L26-31)
const result = await generateObject({
  model: chatModel,
  schema: CommunitySummarySchema,
  system: COMMUNITY_SUMMARY_PROMPT,
  prompt: entityDescriptions,
  maxOutputTokens: 8192,
  mode: "json",  // ← 添加：强制使用 json_object 格式
});
```

---

## 🟡 可视化渲染问题

### 1. 节点颜色双层覆盖（逻辑冲突）

- **API 层** (`src/app/api/knowledge/graph/route.ts` L43-56)：按 `communityId` 分配颜色 `communityColorMap`
- **渲染层** (`src/components/knowledge/graph-canvas.tsx` L127-133)：`nodeReducer` 按 `entityType` 重新覆盖颜色

**结果**：API 返回的社区颜色被忽略，所有节点按实体类型着色。两个着色方案永远不会一致。

**修复建议**：二选一，统一着色策略。
- 方案 A：删除 `nodeReducer` 中的颜色覆盖，使用 API 返回的社区色
- 方案 B：移除 API 中的颜色计算，由前端全权负责颜色

### 2. Sigma 容器配置问题

```tsx
// graph-canvas.tsx L140-151
settings={{
  allowInvalidContainer: true,  // 掩盖容器尺寸问题
  autoRescale: false,            // 图谱可能超出可视区域
}}
```

- `allowInvalidContainer: true` 在容器尺寸为 0 时被触发，说明存在 CSS 布局问题导致 Sigma 容器初始化时尺寸为 0
- `autoRescale: false` 可能导致图谱初始缩放不当，需要用户手动缩放

**修复建议**：
1. 确认 `h-[calc(100vh-18rem)]` 在父容器中有效计算
2. 添加容器尺寸监听，在就绪后再挂载 GraphCanvas
3. 考虑将 `autoRescale` 设为 `true`

### 3. 高亮节点功能未实现

`nodeReducer` (L132-136) 有 `highlighted` 逻辑但 API 从不设置 `highlighted: true`：

```ts
if (data.highlighted) {  // ← 永远不会为 true
  res.size = (Number(data.size) || 3) * 1.4;
  res.zIndex = 1;
}
```

这只是未完成的功能，不算 bug。

---

## 🟢 测试运行结果总结

所有 22 个测试均通过（含 13 个核心测试 + 6 个修复验证 + 3 个 API 测试），但关键错误出现在 reporter 日志中：

```
[Graph Reporter] Failed to generate report ... APICallError: 
Model 'deepseek/deepseek-v4-flash' does not support 'json_schema' response format.
```

测试中的 `recomputeCommunities` 会触发 `generateCommunityReports()`，虽然测试通过（因为 reporter 优雅处理了失败），但社区报告实际未生成。

---

## 📊 错误影响链路

```
用户上传文档 → extractFromChunks() ──json_schema──→ Sensenova API → ❌ 400 错误
                                                                    ↓
                                                         提取可能失败 / 不稳定
                                                                    ↓
              recomputeCommunities() → 社区检测成功（louvain 算法）
                         ↓
              generateCommunityReports() ──json_schema──→ Sensenova API → ❌ 400 错误
                                                                    ↓
                                                         社区报告全部为空
                                                                    ↓
              前端渲染 → GraphLegend 无标题摘要 / NodeDetailPanel 无社区信息
```

---

## 🔧 修复优先级

| 优先级 | 问题 | 修复难度 |
|--------|------|---------|
| 🔴 P0 | `generateObject` 添加 `mode: "json"` | 简单（2行代码） |
| 🟡 P1 | Sigma 容器 `autoRescale: true` | 简单（1行配置） |
| 🟡 P1 | 统一节点着色策略 | 中等（涉及前后端协调） |
| 🟢 P2 | `highlighted` 功能实现 | 中等（需要新交互逻辑） |
