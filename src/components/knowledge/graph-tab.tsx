"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { GraphControls } from "@/components/knowledge/graph-controls";
import { NodeDetailPanel } from "@/components/knowledge/graph-node-detail";
import { GraphLegend } from "@/components/knowledge/graph-legend";
import { Button } from "@/components/ui/button";
import { NetworkIcon, RefreshCwIcon, AlertCircleIcon, Loader2Icon } from "lucide-react";

const GraphCanvas = dynamic(
  () => import("@/components/knowledge/graph-canvas").then((m) => m.GraphCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
        <Loader2Icon className="h-8 w-8 animate-spin text-muted-foreground" />
        <p>加载图谱中...</p>
      </div>
    ),
  }
);

interface GraphNode {
  key: string;
  attributes: Record<string, unknown>;
}

interface GraphEdge {
  key: string;
  source: string;
  target: string;
  attributes: Record<string, unknown>;
}

interface CommunityInfo {
  title: string | null;
  summary: string | null;
  rating: number | null;
}

interface GraphDataResponse {
  nodes: GraphNode[];
  edges: GraphEdge[];
  stats: {
    entityCount: number;
    relationshipCount: number;
    communityCount: number;
    entityTypes: string[];
  };
  communityMap: Record<string, CommunityInfo>;
}

interface GraphStatsResponse {
  graph: { entities: number; relationships: number; communities: number; reports: number };
  documents: { indexed: number; indexing: number; total: number };
  communities: Array<{ id: string; size: number; title: string | null; rating: number | null }>;
  entityTypes: string[];
}

export function GraphTab() {
  const [graphData, setGraphData] = useState<GraphDataResponse | null>(null);
  const [stats, setStats] = useState<GraphStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [layoutKey, setLayoutKey] = useState(0);
  const [selectedNode, setSelectedNode] = useState<{
    id: string;
    label: string;
    type: string;
    description: string;
    communityId: string;
  } | null>(null);
  const [filters, setFilters] = useState<{
    types: string[];
    community: string | null;
    search: string;
  }>({ types: [], community: null, search: "" });

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      const [graphRes, statsRes] = await Promise.all([
        fetch("/api/knowledge/graph"),
        fetch("/api/knowledge/graph/stats"),
      ]);
      if (!graphRes.ok || !statsRes.ok) {
        throw new Error("加载图谱数据失败");
      }
      const graphJson: GraphDataResponse = await graphRes.json();
      const statsJson: GraphStatsResponse = await statsRes.json();
      setGraphData(graphJson);
      setStats(statsJson);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载图谱数据失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const filteredNodes = useMemo(() => {
    if (!graphData) return [];
    return graphData.nodes.filter((node) => {
      if (filters.types.length > 0 && !filters.types.includes(node.attributes.entityType as string ?? node.attributes.type as string)) {
        return false;
      }
      if (filters.community && node.attributes.communityId !== filters.community) {
        return false;
      }
      if (
        filters.search &&
        !(node.attributes.label as string).toLowerCase().includes(filters.search.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [graphData, filters.types, filters.community, filters.search]);

  const filteredNodeKeys = useMemo(
    () => new Set(filteredNodes.map((n) => n.key)),
    [filteredNodes]
  );

  const filteredEdges = useMemo(() => {
    if (!graphData) return [];
    return graphData.edges.filter(
      (e) => filteredNodeKeys.has(e.source) && filteredNodeKeys.has(e.target)
    );
  }, [graphData, filteredNodeKeys]);

  const canvasGraphData = useMemo(
    () => ({ nodes: filteredNodes, edges: filteredEdges }),
    [filteredNodes, filteredEdges]
  );

  const handleNodeClick = (nodeId: string, nodeData: Record<string, unknown>) => {
    setSelectedNode({
      id: nodeId,
      label: (nodeData.label as string) ?? "",
      type: (nodeData.entityType as string) ?? (nodeData.type as string) ?? "OTHER",
      description: (nodeData.description as string) ?? "",
      communityId: (nodeData.communityId as string) ?? "",
    });
  };

  if (loading && !graphData) {
    return (
      <div className="h-[600px] flex flex-col items-center justify-center gap-4">
        <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
          <Loader2Icon className="h-7 w-7 animate-spin text-muted-foreground" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm font-medium">正在加载图谱</p>
          <p className="text-xs text-muted-foreground">请稍候...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-[600px] flex flex-col items-center justify-center gap-4">
        <div className="h-14 w-14 rounded-full bg-destructive/10 flex items-center justify-center">
          <AlertCircleIcon className="h-7 w-7 text-destructive" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm font-medium text-destructive">加载失败</p>
          <p className="text-xs text-muted-foreground">{error}</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadAll}>
          <RefreshCwIcon className="h-4 w-4 mr-1.5" />
          重试
        </Button>
      </div>
    );
  }

  if (!graphData || !stats) {
    return null;
  }

  if (graphData.stats.entityCount === 0) {
    return (
      <div className="h-[600px] flex flex-col items-center justify-center gap-4">
        <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
          <NetworkIcon className="h-7 w-7 text-muted-foreground" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm font-medium">暂无图谱数据</p>
          <p className="text-xs text-muted-foreground">切换到「文档」tab 勾选已上传文档，启动增量构建</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadAll}>
          <RefreshCwIcon className="h-4 w-4 mr-1.5" />
          刷新
        </Button>
      </div>
    );
  }

  const allCommunities = stats.communities;
  const allEntityTypes = stats.entityTypes;

  return (
    <div className="rounded-xl ring-1 ring-foreground/10 flex flex-col h-full bg-card overflow-hidden">
      <GraphControls
        filters={filters}
        onChange={setFilters}
        entityTypes={allEntityTypes}
        communities={allCommunities}
        stats={graphData.stats}
        onRefresh={loadAll}
        onResetLayout={() => {
          Object.keys(localStorage)
            .filter((key) => key.startsWith("graph-pos-"))
            .forEach((key) => localStorage.removeItem(key));
          setLayoutKey((k) => k + 1);
        }}
      />

      <div className="flex flex-1 min-h-0">
        <div className={`flex-1 relative flex flex-col min-h-0 ${selectedNode ? "border-r" : ""}`}>
          <GraphCanvas
            key={layoutKey}
            graphData={canvasGraphData}
            onNodeClick={handleNodeClick}
          />
          <GraphLegend
            communities={allCommunities}
            communityMap={graphData.communityMap}
            entityTypes={allEntityTypes}
          />
        </div>

        {selectedNode && (
          <NodeDetailPanel
            node={selectedNode}
            communityInfo={
              selectedNode.communityId
                ? graphData.communityMap[selectedNode.communityId] ?? null
                : null
            }
            onClose={() => setSelectedNode(null)}
          />
        )}
      </div>
    </div>
  );
}
