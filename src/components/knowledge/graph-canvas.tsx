"use client";

import {
  SigmaContainer,
  useLoadGraph,
  useRegisterEvents,
  useSigma,
} from "@react-sigma/core";
import { useLayoutForceAtlas2 } from "@react-sigma/layout-forceatlas2";
import Graph from "graphology";
import { useEffect, useCallback, useRef } from "react";

interface GraphCanvasProps {
  graphData: {
    nodes: { key: string; attributes: Record<string, unknown> }[];
    edges: { key: string; source: string; target: string; attributes: Record<string, unknown> }[];
  };
  onNodeClick?: (nodeId: string, nodeData: Record<string, unknown>) => void;
  onNodeHover?: (nodeId: string | null) => void;
}

const POSITION_STORAGE_PREFIX = "graph-pos-";

function getPositionCache(userKey: string): Record<string, { x: number; y: number }> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(POSITION_STORAGE_PREFIX + userKey);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function savePositionCache(userKey: string, positions: Record<string, { x: number; y: number }>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(POSITION_STORAGE_PREFIX + userKey, JSON.stringify(positions));
  } catch {
    // quota exceeded, ignore
  }
}

function GraphContent({ graphData, onNodeClick, onNodeHover }: GraphCanvasProps) {
  const loadGraph = useLoadGraph();
  const sigma = useSigma();
  const registerEvents = useRegisterEvents();
  const { assign: assignLayout } = useLayoutForceAtlas2({
    iterations: 300,
    settings: {
      scalingRatio: 20,
      gravity: 1,
      strongGravityMode: true,
    },
  });
  const userKeyRef = useRef<string>("default");
  const graphRef = useRef<Graph | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const userJson = document.cookie
        .split("; ")
        .find((c) => c.startsWith("user-id="))
        ?.split("=")[1];
      userKeyRef.current = userJson || "default";
    }
  }, []);

  useEffect(() => {
    const graph = new Graph();
    graphRef.current = graph;
    const cached = getPositionCache(userKeyRef.current);

    const N = graphData.nodes.length;
    const radius = N > 0 ? Math.max(200, N * 30) : 200;
    graphData.nodes.forEach((node, i) => {
      const saved = cached[node.key];
      let x: number;
      let y: number;
      if (saved) {
        x = saved.x;
        y = saved.y;
      } else {
        const angle = (2 * Math.PI * i) / Math.max(N, 1);
        x = radius * Math.cos(angle);
        y = radius * Math.sin(angle);
      }
      graph.addNode(node.key, {
        ...node.attributes,
        x,
        y,
      });
    });
    for (const edge of graphData.edges) {
      try {
        graph.addEdgeWithKey(edge.key, edge.source, edge.target, edge.attributes);
      } catch {
        // edge may already exist
      }
    }
    loadGraph(graph);

    function fitCamera(): void {
      const g = sigma.getGraph();
      if (g.order === 0) return;
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      g.forEachNode((_key, attrs) => {
        const nx = attrs.x as number;
        const ny = attrs.y as number;
        if (nx < minX) minX = nx;
        if (nx > maxX) maxX = nx;
        if (ny < minY) minY = ny;
        if (ny > maxY) maxY = ny;
      });
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      const graphW = maxX - minX || 1;
      const graphH = maxY - minY || 1;
      const canvas = document.getElementById("sigma-container");
      const canvasW = canvas?.clientWidth || 800;
      const canvasH = canvas?.clientHeight || 600;
      const ratio = Math.max(graphW / canvasW, graphH / canvasH) * 1.3;
      sigma.getCamera().animate(
        { x: cx, y: cy, ratio, angle: 0 },
        { duration: 400 }
      );
    }

    const t = setTimeout(() => {
      assignLayout();
      sigma.refresh();
      const t2 = setTimeout(fitCamera, 100);
      cleanupTimers.push(t2);
    }, 50);
    const cleanupTimers: ReturnType<typeof setTimeout>[] = [t];

    const saveInterval = setInterval(() => {
      const positions: Record<string, { x: number; y: number }> = {};
      graph.forEachNode((key, attrs) => {
        const x = attrs.x as number | undefined;
        const y = attrs.y as number | undefined;
        if (typeof x === "number" && typeof y === "number") {
          positions[key] = { x, y };
        }
      });
      savePositionCache(userKeyRef.current, positions);
    }, 5000);

    return () => {
      cleanupTimers.forEach(clearTimeout);
      clearInterval(saveInterval);
    };
  }, [graphData, loadGraph, assignLayout, sigma]);

  const handleClick = useCallback(
    (e: { node: string }) => {
      const attrs = sigma.getGraph().getNodeAttributes(e.node);
      onNodeClick?.(e.node, attrs);
    },
    [sigma, onNodeClick]
  );
  const handleEnter = useCallback(
    (e: { node: string }) => onNodeHover?.(e.node),
    [onNodeHover]
  );
  const handleLeave = useCallback(() => onNodeHover?.(null), [onNodeHover]);

  useEffect(() => {
    registerEvents({
      clickNode: handleClick,
      enterNode: handleEnter,
      leaveNode: handleLeave,
    });
  }, [registerEvents, handleClick, handleEnter, handleLeave]);

  return null;
}

const ENTITY_COLORS: Record<string, string> = {
  PERSON: "#f59e0b",
  ORGANIZATION: "#3b82f6",
  LOCATION: "#10b981",
  CONCEPT: "#8b5cf6",
  TECHNOLOGY: "#ec4899",
  PRODUCT: "#ef4444",
  EVENT: "#06b6d4",
  OTHER: "#6b7280",
};

function nodeReducer(_node: string, data: Record<string, unknown>) {
  const res: Record<string, unknown> = { ...data };
  res.type = "circle";
  const entityType = (data.entityType as string) ?? (data.type as string) ?? "OTHER";
  res.color = ENTITY_COLORS[entityType] ?? ENTITY_COLORS.OTHER;
  if (data.highlighted) {
    res.size = (Number(data.size) || 3) * 1.4;
    res.zIndex = 1;
  }
  return res;
}

export function GraphCanvas(props: GraphCanvasProps) {
  return (
    <div className="relative w-full h-full bg-background overflow-hidden">
      <SigmaContainer
        id="sigma-container"
        style={{ width: "100%", height: "100%" }}
        settings={{
          allowInvalidContainer: true,
          nodeReducer,
          renderLabels: true,
          labelRenderedSizeThreshold: 6,
          labelSize: 12,
          labelColor: { color: "#333" },
          zIndex: true,
          autoRescale: false,
        }}
      >
        <GraphContent {...props} />
      </SigmaContainer>
    </div>
  );
}
