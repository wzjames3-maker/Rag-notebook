"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeftIcon, FileTextIcon, CheckCircle2Icon, AlertCircleIcon,
  Loader2Icon, NetworkIcon, Trash2Icon, ChevronDownIcon, ChevronRightIcon,
  DatabaseIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
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

export const dynamic = "force-dynamic";

interface DocumentDetail {
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
  relationshipCount: number;
  chunks: {
    id: string;
    content: string;
    chunkIndex: number;
    metadata: unknown;
  }[];
}

const statusLabels: Record<DocumentDetail["status"], { label: string; color: string; Icon: typeof CheckCircle2Icon }> = {
  PROCESSING: { label: "处理中", color: "text-blue-600 dark:text-blue-400", Icon: Loader2Icon },
  COMPLETED: { label: "已完成", color: "text-green-600 dark:text-green-400", Icon: CheckCircle2Icon },
  FAILED: { label: "失败", color: "text-red-600 dark:text-red-400", Icon: AlertCircleIcon },
};

const PREVIEW_LENGTH = 200;

export default function KnowledgeDetailPage() {
  const router = useRouter();
  const params = useParams();
  const documentId = params.id as string;

  const [doc, setDoc] = useState<DocumentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [building, setBuilding] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = async () => {
    try {
      const res = await fetch(`/api/knowledge/${documentId}`);
      if (!res.ok) {
        if (res.status === 404) {
          router.push("/knowledge");
          return;
        }
        throw new Error("Failed to load");
      }
      const json = await res.json();
      setDoc(json.data);
    } catch {
      router.push("/knowledge");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [documentId, router]);

  if (loading) {
    return (
      <div className="space-y-4 max-w-5xl">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!doc) return null;

  const status = statusLabels[doc.status];
  const StatusIcon = status.Icon;
  const canBuild = doc.status === "COMPLETED" && !doc.graphIndexed && !doc.graphIndexing;

  const handleBuild = async () => {
    setBuilding(true);
    try {
      const res = await fetch("/api/knowledge/graph/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "incremental", documentIds: [documentId] }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "启动失败");
      toast.success("图谱构建已启动");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "启动失败");
    } finally {
      setBuilding(false);
    }
  };

  const handleDelete = async () => {
    setPendingDelete(false);
    setDeleting(true);
    try {
      const res = await fetch(`/api/knowledge/${documentId}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.message || "删除失败");
      }
      toast.success("文档已删除");
      router.push("/knowledge");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "删除失败");
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={() => router.push("/knowledge")}>
          <ArrowLeftIcon className="mr-1.5 h-4 w-4" />
          返回知识库
        </Button>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleBuild}
            disabled={!canBuild || building}
            title={
              !canBuild
                ? doc.graphIndexed
                  ? "该文档已索引"
                  : doc.graphIndexing
                  ? "正在索引中"
                  : "文档未完成处理"
                : ""
            }
          >
            {building ? (
              <Loader2Icon className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <NetworkIcon className="h-4 w-4 mr-1" />
            )}
            {doc.graphIndexing ? "索引中..." : "构建图谱"}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setPendingDelete(true)}
            disabled={deleting}
          >
            <Trash2Icon className="h-4 w-4 mr-1" />
            删除
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start gap-3">
            <FileTextIcon className="h-6 w-6 text-muted-foreground shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-semibold truncate">{doc.filename}</h1>
              <p className="text-xs text-muted-foreground mt-1">
                {doc.mimeType} · {doc.chunkCount} 个切片 · {new Date(doc.createdAt).toLocaleString("zh-CN")}
              </p>
            </div>
            <div className={`flex items-center gap-1 text-xs shrink-0 ${status.color}`}>
              <StatusIcon
                className={`h-4 w-4 ${doc.status === "PROCESSING" ? "animate-spin" : ""}`}
              />
              <span>{status.label}</span>
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-3 pt-3 border-t">
            <div className="space-y-0.5">
              <div className="text-xs text-muted-foreground">图谱状态</div>
              <div className="text-sm flex items-center gap-1.5">
                {doc.graphIndexing && (
                  <>
                    <Loader2Icon className="h-3.5 w-3.5 animate-spin text-blue-600" />
                    <span>正在索引</span>
                  </>
                )}
                {doc.graphIndexed && !doc.graphIndexing && (
                  <>
                    <DatabaseIcon className="h-3.5 w-3.5 text-green-600" />
                    <span>已索引</span>
                  </>
                )}
                {!doc.graphIndexed && !doc.graphIndexing && (
                  <span className="text-muted-foreground">未索引</span>
                )}
              </div>
              {doc.graphError && (
                <div className="text-xs text-destructive line-clamp-2">{doc.graphError}</div>
              )}
            </div>
            <div className="space-y-0.5">
              <div className="text-xs text-muted-foreground">实体 / 关系</div>
              <div className="text-sm">
                {doc.entityCount} / {doc.relationshipCount}
              </div>
            </div>
            <div className="space-y-0.5">
              <div className="text-xs text-muted-foreground">最近索引时间</div>
              <div className="text-sm">
                {doc.graphIndexedAt
                  ? new Date(doc.graphIndexedAt).toLocaleString("zh-CN")
                  : "—"}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">
          切片内容（{doc.chunks.length}）
        </h2>
        {doc.chunks.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              暂无切片
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {doc.chunks.map((chunk) => {
              const isExpanded = expanded.has(chunk.id);
              const isLong = chunk.content.length > PREVIEW_LENGTH;
              const display = isLong && !isExpanded
                ? chunk.content.slice(0, PREVIEW_LENGTH) + "..."
                : chunk.content;
              return (
                <Card key={chunk.id} size="sm">
                  <CardContent className="p-3">
                    <button
                      type="button"
                      className="flex items-center justify-between w-full mb-1.5 text-left"
                      onClick={() => {
                        setExpanded((prev) => {
                          const next = new Set(prev);
                          if (next.has(chunk.id)) next.delete(chunk.id);
                          else next.add(chunk.id);
                          return next;
                        });
                      }}
                    >
                      <span className="text-xs font-medium text-muted-foreground">
                        切片 #{chunk.chunkIndex + 1}
                      </span>
                      {isLong && (
                        isExpanded
                          ? <ChevronDownIcon className="h-3.5 w-3.5 text-muted-foreground" />
                          : <ChevronRightIcon className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </button>
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">
                      {display}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <AlertDialog open={pendingDelete} onOpenChange={setPendingDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除文档</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除「{doc.filename}」吗？文档及其所有切片将被永久删除。
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
    </div>
  );
}
