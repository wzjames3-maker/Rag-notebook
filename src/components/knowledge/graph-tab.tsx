"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { GraphControls } from "@/components/knowledge/graph-controls";
import { NodeDetailPanel } from "@/components/knowledge/graph-node-detail";
import { GraphLegend } from "@/components/knowledge/graph-legend";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { NetworkIcon, RefreshCwIcon, AlertCircleIcon } from "lucide-react";

const GraphCanvas = dynamic(
  () => import("@/components/knowledge/graph-canvas").then((m) => m.GraphCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
        加载图谱中...
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
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-[600px] flex flex-col items-center justify-center gap-3 text-sm">
        <AlertCircleIcon className="h-10 w-10 text-destructive" />
        <p className="text-destructive">{error}</p>
        <Button variant="outline" size="sm" onClick={loadAll}>
          <RefreshCwIcon className="h-4 w-4 mr-1" />
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
      <div className="h-[600px] flex flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
        <NetworkIcon className="h-12 w-12" />
        <p className="font-medium text-foreground">暂无图谱数据</p>
        <p className="text-xs">切换到「文档」tab 勾选已上传文档，启动增量构建</p>
        <Button variant="outline" size="sm" onClick={loadAll}>
          <RefreshCwIcon className="h-4 w-4 mr-1" />
          刷新
        </Button>
      </div>
    );
  }

  const filteredNodes = graphData.nodes.filter((node) => {
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

  const filteredNodeKeys = new Set(filteredNodes.map((n) => n.key));
  const filteredEdges = graphData.edges.filter(
    (e) => filteredNodeKeys.has(e.source) && filteredNodeKeys.has(e.target)
  );

  const allCommunities = stats.communities;
  const allEntityTypes = stats.entityTypes;

  return (
    <div className="space-y-3">
      <div className="border rounded-lg flex flex-col h-[calc(100vh-18rem)]">
        <GraphControls
          filters={filters}
          onChange={setFilters}
          entityTypes={allEntityTypes}
          communities={allCommunities}
          stats={graphData.stats}
          onRefresh={loadAll}
        />

        <div className="flex flex-1 min-h-0">
          <div className={`flex-1 relative ${selectedNode ? "border-r" : ""}`}>
            <GraphCanvas
              graphData={{ nodes: filteredNodes, edges: filteredEdges }}
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
    </div>
  );
}
