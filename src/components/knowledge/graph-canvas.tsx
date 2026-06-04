"use client";

import {
  SigmaContainer,
  useLoadGraph,
  useRegisterEvents,
  useCamera,
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
  const { reset: resetCamera } = useCamera();
  const registerEvents = useRegisterEvents();
  const { assign: assignLayout } = useLayoutForceAtlas2({ iterations: 100 });
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

    for (const node of graphData.nodes) {
      const saved = cached[node.key];
      graph.addNode(node.key, {
        ...node.attributes,
        x: saved?.x ?? Math.random() * 100,
        y: saved?.y ?? Math.random() * 100,
      });
    }
    for (const edge of graphData.edges) {
      try {
        graph.addEdgeWithKey(edge.key, edge.source, edge.target, edge.attributes);
      } catch {
        // edge may already exist
      }
    }
    loadGraph(graph);

    const t = setTimeout(() => {
      assignLayout();
      resetCamera({ duration: 200 });
    }, 50);

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
      clearTimeout(t);
      clearInterval(saveInterval);
    };
  }, [graphData, loadGraph, assignLayout, resetCamera]);

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

function nodeReducer(_node: string, data: Record<string, unknown>) {
  const res: Record<string, unknown> = { ...data };
  const entityType = (data.entityType as string) ?? (data.type as string) ?? "OTHER";
  switch (entityType) {
    case "PERSON":
      res.type = "diamond";
      break;
    case "ORGANIZATION":
      res.type = "square";
      break;
    case "LOCATION":
      res.type = "triangle";
      break;
    case "CONCEPT":
    case "TECHNOLOGY":
    case "PRODUCT":
      res.type = "star";
      break;
    default:
      res.type = "circle";
  }
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
          autoRescale: true,
        }}
      >
        <GraphContent {...props} />
      </SigmaContainer>
    </div>
  );
}
