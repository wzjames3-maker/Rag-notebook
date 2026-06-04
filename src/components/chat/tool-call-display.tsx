"use client";

import { useState } from "react";
import { ChevronDownIcon, Loader2Icon, CheckIcon, AlertCircleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ToolCallStep {
  toolName: string;
  args: Record<string, unknown>;
  result?: unknown;
  status: "loading" | "success" | "error";
}

interface ToolCallDisplayProps {
  toolCalls: ToolCallStep[];
}

const toolLabels: Record<string, { icon: string; label: string }> = {
  vector_search:     { icon: "🔍", label: "语义搜索知识库" },
  keyword_search:    { icon: "🔎", label: "关键词搜索知识库" },
  graph_explore:     { icon: "🔗", label: "探索实体关系" },
  graph_search:      { icon: "🏷️", label: "搜索知识图谱" },
  community_summary: { icon: "📊", label: "获取社区摘要" },
  search_notes:      { icon: "📝", label: "搜索笔记" },
  create_note:       { icon: "✏️", label: "创建笔记" },
  build_graph:       { icon: "🏗️", label: "构建知识图谱" },
  get_time:          { icon: "⏰", label: "获取当前时间" },
};

export function ToolCallDisplay({ toolCalls }: ToolCallDisplayProps) {
  const [expanded, setExpanded] = useState(false);

  if (!toolCalls || toolCalls.length === 0) return null;

  const completedCount = toolCalls.filter((tc) => tc.status === "success").length;
  const loadingCount = toolCalls.filter((tc) => tc.status === "loading").length;

  return (
    <div className="mt-2 border rounded-md bg-muted/20">
      <Button
        variant="ghost"
        size="sm"
        className="w-full h-8 px-3 text-xs justify-between"
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="flex items-center gap-2">
          {loadingCount > 0 ? (
            <Loader2Icon className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <CheckIcon className="h-3.5 w-3.5 text-green-600" />
          )}
          Agent 调用了 {toolCalls.length} 个工具
          {completedCount > 0 && `（${completedCount} 完成）`}
        </span>
        <ChevronDownIcon
          className={cn(
            "h-3.5 w-3.5 transition-transform",
            expanded && "rotate-180"
          )}
        />
      </Button>

      {expanded && (
        <div className="border-t px-3 py-2 space-y-2">
          {toolCalls.map((tc, idx) => {
            const meta = toolLabels[tc.toolName] ?? { icon: "🔧", label: tc.toolName };
            return (
              <div key={idx} className="text-xs border-l-2 pl-3 py-1 border-primary/30">
                <div className="flex items-center gap-1.5">
                  <span>{meta.icon}</span>
                  <span className="font-medium">{meta.label}</span>
                  {tc.status === "loading" && (
                    <Loader2Icon className="h-3 w-3 animate-spin text-muted-foreground" />
                  )}
                  {tc.status === "success" && (
                    <CheckIcon className="h-3 w-3 text-green-600" />
                  )}
                  {tc.status === "error" && (
                    <AlertCircleIcon className="h-3 w-3 text-destructive" />
                  )}
                </div>
                <div className="text-muted-foreground mt-0.5 font-mono">
                  {Object.entries(tc.args)
                    .map(([k, v]) => `${k}: ${typeof v === "string" ? `"${v}"` : JSON.stringify(v)}`)
                    .join(", ")}
                </div>
                {tc.status === "success" && tc.result != null && (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                      查看结果
                    </summary>
                    <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-auto max-h-40">
                      {JSON.stringify(tc.result, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
