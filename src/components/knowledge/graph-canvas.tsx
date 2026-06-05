"use client";

import {
  SigmaContainer,
  useLoadGraph,
  useRegisterEvents,
  useSigma,
} from "@react-sigma/core";
import forceAtlas2 from "graphology-layout-forceatlas2";
import Graph from "graphology";
import { useTheme } from "next-themes";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  DARK_THEME,
  GLOW_PREFIX,
  LIGHT_THEME,
  makeEdgeReducer,
  makeNodeReducer,
  type ReducerTheme,
} from "@/lib/graph/reducers";
import { getPositionCache, savePositionCache } from "@/lib/graph/position-cache";

const LABEL_FONT_SIZE = 13;
const LABEL_PAD_X = 8;
const LABEL_PAD_Y = 3;
const LABEL_GAP_FROM_NODE = 8;
const LABEL_BOX_H = LABEL_FONT_SIZE + LABEL_PAD_Y * 2;
const NOOP_DRAW_NODE_HOVER = () => {};

interface GraphCanvasProps {
  graphData: {
    nodes: { key: string; attributes: Record<string, unknown> }[];
    edges: { key: string; source: string; target: string; attributes: Record<string, unknown> }[];
  };
  onNodeClick?: (nodeId: string, nodeData: Record<string, unknown>) => void;
}

interface GraphContentProps extends GraphCanvasProps {
  theme: ReducerTheme;
  nodeReducer: (key: string, data: Record<string, unknown>) => Record<string, unknown>;
  edgeReducer: (key: string, data: Record<string, unknown>) => Record<string, unknown>;
}

interface HoverState {
  nodeId: string;
  label: string;
}

function resolveMainNodeId(sigma: ReturnType<typeof useSigma>, nodeKey: string): string | null {
  if (!sigma) return null;
  if (nodeKey.startsWith(GLOW_PREFIX)) {
    const mainKey = sigma.getGraph().getNodeAttribute(nodeKey, "_mainNode") as string;
    return mainKey || null;
  }
  return nodeKey;
}

function collectPositions(graph: Graph): Record<string, { x: number; y: number }> {
  const positions: Record<string, { x: number; y: number }> = {};
  graph.forEachNode((key, attrs) => {
    if (key.startsWith(GLOW_PREFIX)) return;
    const x = attrs.x as number | undefined;
    const y = attrs.y as number | undefined;
    if (typeof x === "number" && typeof y === "number") {
      positions[key] = { x, y };
    }
  });
  return positions;
}

function HoverLabel({ state, theme }: { state: HoverState; theme: ReducerTheme }) {
  const sigma = useSigma();
  const containerOffsetRef = useRef<{ left: number; top: number }>({ left: 0, top: 0 });
  const elRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  const update = useCallback(() => {
    if (!sigma) return;
    const el = elRef.current;
    if (!el) return;
    const data = sigma.getNodeDisplayData(state.nodeId);
    if (!data) return;
    const { x, y } = sigma.framedGraphToViewport(data);
    const off = containerOffsetRef.current;
    el.style.transform = `translate(${x + data.size + LABEL_GAP_FROM_NODE + off.left}px, ${y - LABEL_BOX_H / 2 + off.top}px)`;
  }, [sigma, state.nodeId]);

  useEffect(() => {
    const measure = () => {
      const el = document.querySelector(".sigma-container") as HTMLElement | null;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      containerOffsetRef.current = { left: rect.left, top: rect.top };
      update();
    };
    measure();
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    const ro = new ResizeObserver(measure);
    const el = document.querySelector(".sigma-container");
    if (el) ro.observe(el);
    return () => {
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
      ro.disconnect();
    };
  }, [update]);

  useLayoutEffect(() => {
    update();
  }, [update]);

  useEffect(() => {
    if (!sigma) return;
    const tick = () => {
      update();
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [sigma, update]);

  return createPortal(
    <div
      ref={elRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        backgroundColor: `rgba(${theme.labelBackground},${theme.labelBackgroundAlphaHighlight})`,
        color: theme.labelColor,
        borderRadius: 4,
        fontSize: LABEL_FONT_SIZE,
        lineHeight: `${LABEL_FONT_SIZE}px`,
        padding: `${LABEL_PAD_Y}px ${LABEL_PAD_X}px`,
        display: "inline-flex",
        alignItems: "center",
        pointerEvents: "none",
        zIndex: 3,
        whiteSpace: "nowrap",
        fontWeight: 600,
        fontFamily: "Arial, sans-serif",
      }}
    >
      {state.label}
    </div>,
    document.body
  );
}

function GraphContent({ graphData, onNodeClick, theme, nodeReducer, edgeReducer }: GraphContentProps) {
  const loadGraph = useLoadGraph();
  const sigma = useSigma();
  const registerEvents = useRegisterEvents();
  const userKeyRef = useRef<string>("default");
  const [hover, setHover] = useState<HoverState | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const userJson = document.cookie
      .split("; ")
      .find((c) => c.startsWith("user-id="))
      ?.split("=")[1];
    userKeyRef.current = userJson || "default";
  }, []);

  useEffect(() => {
    const graph = new Graph();
    const cached = getPositionCache(userKeyRef.current);

    const N = graphData.nodes.length;
    const radius = N > 0 ? Math.max(150, Math.min(600, Math.sqrt(N) * 60)) : 250;

    const degreeMap = new Map<string, number>();
    for (const node of graphData.nodes) degreeMap.set(node.key, 0);
    for (const edge of graphData.edges) {
      degreeMap.set(edge.source, (degreeMap.get(edge.source) ?? 0) + 1);
      degreeMap.set(edge.target, (degreeMap.get(edge.target) ?? 0) + 1);
    }
    const maxDeg = Math.max(1, ...degreeMap.values());

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
      const deg = degreeMap.get(node.key) ?? 0;
      const size = 4 + (deg / maxDeg) * 10;
      graph.addNode(node.key, {
        ...node.attributes,
        x,
        y,
        size,
        _deg: deg,
        _glow: false,
      });
    });

    graphData.nodes.forEach((node) => {
      if (!graph.hasNode(node.key)) return;
      const mainAttrs = graph.getNodeAttributes(node.key);
      const glowKey = GLOW_PREFIX + node.key;
      const mainSize = Number(mainAttrs.size) || 6;
      graph.addNode(glowKey, {
        x: mainAttrs.x as number,
        y: mainAttrs.y as number,
        size: mainSize * 2.5,
        _mainNode: node.key,
        _glow: true,
        ...node.attributes,
      });
    });

    for (const edge of graphData.edges) {
      try {
        graph.addEdgeWithKey(edge.key, edge.source, edge.target, {
          ...edge.attributes,
        });
      } catch {
      }
    }
    loadGraph(graph);

    const cleanupTimers: ReturnType<typeof setTimeout>[] = [];
    const t = setTimeout(() => {
      const order = graph.order;
      forceAtlas2.assign(graph, {
        iterations: Math.min(300, 100 + order),
        settings: {
          scalingRatio: 20,
          strongGravityMode: true,
          gravity: 0.03,
          barnesHutOptimize: order > 2000,
          slowDown: 1 + Math.log(Math.max(order, 1)),
          linLogMode: false,
          outboundAttractionDistribution: true,
        },
      });

      graph.forEachNode((key, attrs) => {
        if (!key.startsWith(GLOW_PREFIX)) return;
        const mainKey = attrs._mainNode as string;
        if (!graph.hasNode(mainKey)) return;
        const mainAttrs = graph.getNodeAttributes(mainKey);
        graph.setNodeAttribute(key, "x", mainAttrs.x);
        graph.setNodeAttribute(key, "y", mainAttrs.y);
      });

      sigma.refresh();
      cleanupTimers.push(
        setTimeout(() => {
          sigma.getCamera().animatedZoom({ duration: 500 });
        }, 150)
      );
    }, 80);
    cleanupTimers.push(t);

    const saveInterval = setInterval(() => {
      savePositionCache(userKeyRef.current, collectPositions(graph));
    }, 5000);

    return () => {
      cleanupTimers.forEach(clearTimeout);
      clearInterval(saveInterval);
      savePositionCache(userKeyRef.current, collectPositions(graph));
    };
  }, [graphData, loadGraph, sigma]);

  const handleClick = useCallback(
    (e: { node: string }) => {
      if (e.node.startsWith(GLOW_PREFIX)) return;
      const attrs = sigma.getGraph().getNodeAttributes(e.node);
      onNodeClick?.(e.node, attrs);
    },
    [sigma, onNodeClick]
  );

  const handleEnter = useCallback(
    (e: { node: string }) => {
      const nodeId = resolveMainNodeId(sigma, e.node);
      if (!nodeId) return;
      const graph = sigma.getGraph();
      graph.setNodeAttribute(nodeId, "highlighted", true);
      const glowKey = GLOW_PREFIX + nodeId;
      if (graph.hasNode(glowKey)) {
        graph.setNodeAttribute(glowKey, "highlighted", true);
      }
      const data = sigma.getNodeDisplayData(nodeId);
      if (data && typeof data.label === "string" && data.label) {
        setHover({ nodeId, label: data.label });
      }
      sigma.refresh();
    },
    [sigma]
  );

  const handleLeave = useCallback(
    (e: { node: string }) => {
      const nodeId = resolveMainNodeId(sigma, e.node);
      if (!nodeId) return;
      const graph = sigma.getGraph();
      graph.setNodeAttribute(nodeId, "highlighted", false);
      const glowKey = GLOW_PREFIX + nodeId;
      if (graph.hasNode(glowKey)) {
        graph.setNodeAttribute(glowKey, "highlighted", false);
      }
      setHover(null);
      sigma.refresh();
    },
    [sigma]
  );

  useEffect(() => {
    registerEvents({
      clickNode: handleClick,
      enterNode: handleEnter,
      leaveNode: handleLeave,
    });
  }, [registerEvents, handleClick, handleEnter, handleLeave]);

  useEffect(() => {
    if (!sigma) return;
    sigma.setSetting("defaultEdgeColor", theme.defaultEdgeColor);
    sigma.setSetting("labelColor", { color: theme.labelColor });
    sigma.setSetting("nodeReducer", nodeReducer);
    sigma.setSetting("edgeReducer", edgeReducer);
    sigma.refresh();
  }, [sigma, theme, nodeReducer, edgeReducer]);

  return hover ? <HoverLabel state={hover} theme={theme} /> : null;
}

export function GraphCanvas(props: GraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const { resolvedTheme } = useTheme();
  const reducerTheme = resolvedTheme === "light" ? LIGHT_THEME : DARK_THEME;
  const nodeReducer = useMemo(() => makeNodeReducer(reducerTheme), [reducerTheme]);
  const edgeReducer = useMemo(() => makeEdgeReducer(reducerTheme), [reducerTheme]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setSize({ width: rect.width, height: rect.height });
      }
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="w-full flex-1 relative min-h-0">
      <div
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          backgroundImage: `
            linear-gradient(rgba(148,163,184,0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(148,163,184,0.06) 1px, transparent 1px)
          `,
          backgroundSize: "20px 20px",
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 33%, rgba(99,102,241,0.06) 0%, transparent 55%)",
        }}
      />
      {size.width > 0 && size.height > 0 && (
        <SigmaContainer
          id="sigma-container"
          style={{
            width: size.width,
            height: size.height,
            position: "relative",
            zIndex: 1,
          }}
          settings={{
            nodeReducer,
            edgeReducer,
            defaultDrawNodeHover: NOOP_DRAW_NODE_HOVER,
            renderLabels: true,
            renderEdgeLabels: false,
            labelRenderedSizeThreshold: 5,
            labelSize: LABEL_FONT_SIZE,
            labelColor: { color: reducerTheme.labelColor },
            labelDensity: 0.1,
            labelGridCellSize: 60,
            zIndex: true,
            autoRescale: true,
            allowInvalidContainer: true,
            defaultEdgeColor: reducerTheme.defaultEdgeColor,
            defaultNodeColor: "#94a3b8",
          }}
        >
          <GraphContent
            graphData={props.graphData}
            onNodeClick={props.onNodeClick}
            theme={reducerTheme}
            nodeReducer={nodeReducer}
            edgeReducer={edgeReducer}
          />
        </SigmaContainer>
      )}
    </div>
  );
}
