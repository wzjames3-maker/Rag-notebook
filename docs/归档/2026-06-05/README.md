# 2026-06-05 文档同步快照

> 归档时间：2026-06-05
> 归档原因：修复 docs/ 与 AGENTS.md 中的关键过期引用（文件名错配、route 数错误、命令过期、route 路径错）

## 包含文件

| 原始路径 | 说明 |
|---|---|
| `AGENTS.md` | 项目主指南（含被修复的 Docs 表格） |
| `graph-error-analysis.md` | 图谱错误分析报告（含仍未应用的 P0 修复） |
| `docs/API设计.md` | API 设计文档 |
| `docs/Agentic-GraphRAG-计划方案.md` | Agentic GraphRAG 计划 |
| `docs/Agentic-GraphRAG-详细实施方案.md` | Agentic GraphRAG 详细实施 |
| `docs/GRAPH_TESTING.md` | 端到端测试手册（含被修复的 migrate 命令、route 数、legend 位置） |
| `docs/MVP实施计划.md` | MVP 实施计划 |
| `docs/RAG_FLOW.md` | 流程图（含被修复的 §5 API 路由） |
| `docs/技术选型.md` | 技术选型 |
| `docs/需求文档.md` | 需求文档 |

## 同步变更（活文件已修改）

### `AGENTS.md`
- **§Quirks**："No tests" → "No automated tests"，指向 `docs/GRAPH_TESTING.md`
- **§Docs 表格**：4 个文件名由英文占位改为实际中文文件名，并新增 RAG_FLOW.md / GRAPH_TESTING.md 两行

### `docs/GRAPH_TESTING.md`
- L7：`npx prisma migrate dev` → `npx prisma migrate deploy`
- L30：「左下角」→「右上角」（与 `graph-legend.tsx` 现状 `top-3 right-3` 对齐）
- L78：route 数 23 → 25

### `docs/RAG_FLOW.md`
- L123：§5 流程图中 `GET /api/knowledge/graph-data` → `GET /api/knowledge/graph` + `GET /api/knowledge/graph/stats`

## 未处理项（未在本批次内，但已知）

1. **`graph-error-analysis.md` P0 修复未应用**：`extractor.ts:36-44` 与 `reporter.ts:49-57` 仍缺 `mode: "json"`，社区报告为空问题持续
2. **`docs/RAG_FLOW.md` §4 图谱索引流程**：未反映 `extractAndUpsertDocument` + `recomputeCommunities` 拆分
3. **AGENTS.md 未记录新模块**：`HoverLabel` portal 重构、`position-cache.ts`、`colors.ts` 共享常量、`layoutKey` 状态
4. **根目录 `README.md` / `CLAUDE.md` 未审计**

## 还原方式

如需还原，将本目录下对应文件 `cp` 回到原路径即可。
