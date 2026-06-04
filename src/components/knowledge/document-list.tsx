"use client";

import Link from "next/link";
import {
  FileTextIcon, FileType2Icon, Trash2Icon, Loader2Icon, AlertCircleIcon,
  CheckCircle2Icon, DatabaseIcon, RotateCwIcon, NetworkIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { formatTimeAgo } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export interface DocumentItem {
  id: string;
  filename: string;
  mimeType: string;
  md5: string;
  chunkCount: number;
  status: "PROCESSING" | "COMPLETED" | "FAILED";
  graphIndexed: boolean;
  graphIndexing: boolean;
  graphError: string | null;
  graphIndexedAt: string | null;
  createdAt: string;
  entityCount: number;
}

const statusLabels: Record<DocumentItem["status"], { label: string; color: string; Icon: typeof CheckCircle2Icon }> = {
  PROCESSING: { label: "处理中", color: "text-blue-600 dark:text-blue-400", Icon: Loader2Icon },
  COMPLETED: { label: "已完成", color: "text-green-600 dark:text-green-400", Icon: CheckCircle2Icon },
  FAILED: { label: "失败", color: "text-red-600 dark:text-red-400", Icon: AlertCircleIcon },
};

export function DocumentList({
  documents,
  onChanged,
  selectedIds,
  onSelectionChange,
}: {
  documents: DocumentItem[];
  onChanged?: () => void;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
}) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<DocumentItem | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const selectableDocs = documents.filter(
    (d) => d.status === "COMPLETED" && !d.graphIndexed && !d.graphIndexing
  );
  const allSelected = selectableDocs.length > 0 && selectableDocs.every((d) => selectedIds?.includes(d.id));

  function toggleDoc(docId: string) {
    if (!onSelectionChange) return;
    const current = selectedIds ?? [];
    const next = current.includes(docId)
      ? current.filter((id) => id !== docId)
      : [...current, docId];
    onSelectionChange(next);
  }

  function toggleAll() {
    if (!onSelectionChange) return;
    if (allSelected) {
      onSelectionChange([]);
    } else {
      onSelectionChange(selectableDocs.map((d) => d.id));
    }
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    setDeletingId(pendingDelete.id);
    try {
      const res = await fetch(`/api/knowledge/${pendingDelete.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.message || "删除失败");
      }
      toast.success("文档已删除");
      onChanged?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : "删除失败";
      toast.error(message);
    } finally {
      setDeletingId(null);
      setPendingDelete(null);
    }
  }

  async function handleRetry(doc: DocumentItem) {
    setRetryingId(doc.id);
    try {
      const res = await fetch("/api/knowledge/graph/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "incremental", documentIds: [doc.id] }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.message || "重试失败");
      }
      toast.success("图谱构建已启动");
      onChanged?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : "重试失败";
      toast.error(message);
    } finally {
      setRetryingId(null);
    }
  }

  if (documents.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          还没有文档，上传第一个文档开始构建知识库
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {onSelectionChange && selectableDocs.length > 0 && (
        <div className="flex items-center gap-2 pb-1">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleAll}
            className="h-4 w-4 accent-primary shrink-0"
          />
          <span className="text-xs text-muted-foreground">全选</span>
        </div>
      )}
      <div className="space-y-2">
        {documents.map((doc) => {
          const status = statusLabels[doc.status];
          const StatusIcon = status.Icon;
          const canSelect = doc.status === "COMPLETED" && !doc.graphIndexed && !doc.graphIndexing;
          const isSelected = selectedIds?.includes(doc.id);
          const hasGraphError = !!doc.graphError;
          return (
            <Card
              key={doc.id}
              size="sm"
              className={`hover:bg-accent/30 transition-colors ${
                hasGraphError ? "border-destructive/40" : ""
              }`}
              title={hasGraphError ? `图谱错误: ${doc.graphError}` : undefined}
            >
              <CardContent className="flex items-center gap-2 p-3">
                {onSelectionChange && (
                  <input
                    type="checkbox"
                    checked={!!isSelected}
                    disabled={!canSelect}
                    onChange={() => toggleDoc(doc.id)}
                    className="shrink-0 h-4 w-4 accent-primary"
                  />
                )}
                <FileType2Icon className="h-5 w-5 text-muted-foreground shrink-0" />
                <Link
                  href={`/knowledge/${doc.id}`}
                  className="flex-1 min-w-0 group"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate group-hover:underline">
                      {doc.filename}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                    <FileTextIcon className="h-3 w-3" />
                    <span>{doc.chunkCount} 个切片</span>
                    <span>·</span>
                    <span>{formatTimeAgo(new Date(doc.createdAt))}</span>
                    {doc.graphIndexed && doc.entityCount > 0 && (
                      <>
                        <span>·</span>
                        <span>{doc.entityCount} 个实体</span>
                      </>
                    )}
                  </div>
                  {hasGraphError && (
                    <div className="text-xs text-destructive mt-0.5 truncate">
                      图谱错误: {doc.graphError}
                    </div>
                  )}
                </Link>
                <div className="flex items-center gap-1.5 shrink-0">
                  {doc.graphIndexing && (
                    <span className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
                      <Loader2Icon className="h-3 w-3 animate-spin" />
                      索引中
                    </span>
                  )}
                  {doc.graphIndexed && !doc.graphIndexing && (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      <DatabaseIcon className="h-3 w-3" />
                      已索引
                    </span>
                  )}
                  <div className={`flex items-center gap-1 text-xs ${status.color}`}>
                    <StatusIcon
                      className={`h-3.5 w-3.5 ${doc.status === "PROCESSING" ? "animate-spin" : ""}`}
                    />
                    <span>{status.label}</span>
                  </div>
                </div>
                {doc.status === "COMPLETED" && hasGraphError && !doc.graphIndexing && (
                  <Button
                    variant="outline"
                    size="icon-sm"
                    onClick={() => handleRetry(doc)}
                    disabled={retryingId === doc.id}
                    title="重试图谱构建"
                  >
                    {retryingId === doc.id ? (
                      <Loader2Icon className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <NetworkIcon className="h-3.5 w-3.5" />
                    )}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setPendingDelete(doc)}
                  disabled={deletingId === doc.id}
                  title="删除"
                >
                  <Trash2Icon className="h-4 w-4 text-destructive" />
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除文档</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除「{pendingDelete?.filename}」吗？文档及其所有切片将被永久删除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
