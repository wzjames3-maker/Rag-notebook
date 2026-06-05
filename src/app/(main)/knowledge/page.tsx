"use client";

import { useCallback, useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Loader2Icon, NetworkIcon, RefreshCwIcon } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FileUpload } from "@/components/knowledge/file-upload";
import { DocumentList, type DocumentItem } from "@/components/knowledge/document-list";
import { GraphTab } from "@/components/knowledge/graph-tab";
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

const TABS = ["docs", "graph", "stats"] as const;
type TabValue = (typeof TABS)[number];

function isTabValue(v: string | null): v is TabValue {
  return v !== null && (TABS as readonly string[]).includes(v);
}

function KnowledgePageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab");
  const [tab, setTab] = useState<TabValue>(isTabValue(initialTab) ? initialTab : "docs");

  const onTabChange = useCallback(
    (next: string) => {
      if (!isTabValue(next)) return;
      setTab(next);
      const params = new URLSearchParams(searchParams.toString());
      if (next === "docs") {
        params.delete("tab");
      } else {
        params.set("tab", next);
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [building, setBuilding] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [pendingRebuild, setPendingRebuild] = useState(false);

  const loadDocuments = useCallback(async () => {
    try {
      const res = await fetch("/api/knowledge?limit=100");
      if (!res.ok) throw new Error("Failed to load documents");
      const json = await res.json();
      setDocuments(json.data);
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const handleIncrementalBuild = async () => {
    if (selectedIds.length === 0) return;
    setBuilding(true);
    try {
      const res = await fetch("/api/knowledge/graph/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "incremental", documentIds: selectedIds }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      toast.success(json.message ?? "增量构建已启动");
      setSelectedIds([]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "增量构建失败");
    } finally {
      setBuilding(false);
    }
  };

  const handleFullRebuild = async () => {
    setPendingRebuild(false);
    setRebuilding(true);
    try {
      const res = await fetch("/api/knowledge/graph/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "rebuild" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      toast.success(json.message ?? "全量重建已启动");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "全量重建失败");
    } finally {
      setRebuilding(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto flex flex-col h-[calc(100vh-8rem)]">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">知识库</h1>
        <p className="text-sm text-muted-foreground mt-1">
          上传文档到知识库，系统会自动解析、切片并向量化；可选构建知识图谱
        </p>
      </div>

      <Tabs value={tab} onValueChange={onTabChange} className="flex-1 min-h-0">
        <TabsList>
          <TabsTrigger value="docs">文档</TabsTrigger>
          <TabsTrigger value="graph">图谱</TabsTrigger>
          <TabsTrigger value="stats">统计</TabsTrigger>
        </TabsList>

        <TabsContent value="docs" className="space-y-4 min-h-0 overflow-y-auto flex flex-col">
          <div className="grid lg:grid-cols-[320px,1fr] gap-6">
            <div className="space-y-3">
              <FileUpload onUploaded={loadDocuments} />
              <div className="rounded-lg border bg-card p-3 space-y-2">
                <div className="text-xs font-medium text-muted-foreground">
                  文档统计
                </div>
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">总数</span>
                    <span>{documents.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">已索引</span>
                    <span>{documents.filter((d) => d.graphIndexed).length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">待索引</span>
                    <span>
                      {documents.filter(
                        (d) => d.status === "COMPLETED" && !d.graphIndexed && !d.graphIndexing
                      ).length}
                    </span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => setPendingRebuild(true)}
                  disabled={rebuilding || documents.length === 0}
                >
                  {rebuilding ? (
                    <Loader2Icon className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <RefreshCwIcon className="h-4 w-4 mr-1" />
                  )}
                  全量重建图谱
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              <h2 className="text-sm font-medium text-muted-foreground">
                已上传文档（{documents.length}）
              </h2>
              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 rounded-lg" />
                  ))}
                </div>
              ) : (
                <>
                  <DocumentList
                    documents={documents}
                    onChanged={loadDocuments}
                    selectedIds={selectedIds}
                    onSelectionChange={setSelectedIds}
                  />
                  {selectedIds.length > 0 && (
                    <div className="flex items-center gap-3 py-2">
                      <span className="text-sm text-muted-foreground">
                        已选 {selectedIds.length} 个文档
                      </span>
                      <Button
                        size="sm"
                        onClick={handleIncrementalBuild}
                        disabled={building}
                      >
                        {building ? (
                          <Loader2Icon className="h-4 w-4 mr-1 animate-spin" />
                        ) : (
                          <NetworkIcon className="h-4 w-4 mr-1" />
                        )}
                        {building ? "启动中..." : "增量构建图谱"}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="graph" className="mt-0 min-h-0 overflow-hidden flex flex-col">
          <GraphTab />
        </TabsContent>

        <TabsContent value="stats" className="space-y-3 min-h-0 overflow-y-auto flex flex-col">
          <StatsTab documents={documents} />
        </TabsContent>
      </Tabs>

      <AlertDialog open={pendingRebuild} onOpenChange={setPendingRebuild}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>全量重建图谱</AlertDialogTitle>
            <AlertDialogDescription>
              此操作将删除所有现有实体、关系、社区和报告，然后从所有已上传的文档重新构建。
              构建过程可能持续数分钟。是否继续？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleFullRebuild} className="bg-destructive text-destructive-foreground">
              确认重建
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatsTab({ documents }: { documents: DocumentItem[] }) {
  const [stats, setStats] = useState<{
    graph: { entities: number; relationships: number; communities: number; reports: number };
    documents: { indexed: number; indexing: number; total: number };
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/knowledge/graph/stats")
      .then((r) => r.json())
      .then((json) => {
        setStats(json);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading || !stats) {
    return (
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
    );
  }

  const cards = [
    { label: "实体", value: stats.graph.entities, hint: "从文档中提取的概念" },
    { label: "关系", value: stats.graph.relationships, hint: "实体之间的关联" },
    { label: "社区", value: stats.graph.communities, hint: "Louvain 聚类结果" },
    { label: "已索引文档", value: stats.documents.indexed, hint: `共 ${stats.documents.total} 个` },
  ];

  return (
    <div className="space-y-3">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-lg border bg-card p-4 space-y-1">
            <div className="text-xs text-muted-foreground">{c.label}</div>
            <div className="text-2xl font-bold">{c.value}</div>
            <div className="text-xs text-muted-foreground">{c.hint}</div>
          </div>
        ))}
      </div>
      <div className="text-xs text-muted-foreground">
        文档统计：{documents.length} 个已上传 · {stats.documents.indexing} 个正在索引
      </div>
    </div>
  );
}

export default function KnowledgePage() {
  return (
    <Suspense fallback={<div className="text-sm text-muted-foreground p-4">加载中...</div>}>
      <KnowledgePageContent />
    </Suspense>
  );
}
