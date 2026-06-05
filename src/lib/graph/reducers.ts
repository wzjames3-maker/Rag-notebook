import { ENTITY_COLORS, hexToRgba } from "@/lib/graph/colors";

export const GLOW_PREFIX = "__glow__";

export interface ReducerTheme {
  edgeAlpha: number;
  defaultEdgeColor: string;
  nodeAlpha: number;
  nodeBorderColor: string;
  nodeBorderAlpha: number;
  labelColor: string;
  labelBackground: string;
  labelBackgroundAlphaHighlight: number;
  labelBackgroundAlphaNormal: number;
  glowAlphaBase: number;
  glowAlphaRatio: number;
  glowAlphaHighlightBoost: number;
}

export const DARK_THEME: ReducerTheme = {
  edgeAlpha: 0.1,
  defaultEdgeColor: "rgba(100,116,139,0.12)",
  nodeAlpha: 0.55,
  nodeBorderColor: "#ffffff",
  nodeBorderAlpha: 0.45,
  labelColor: "#e2e8f0",
  labelBackground: "15,23,42",
  labelBackgroundAlphaHighlight: 0.85,
  labelBackgroundAlphaNormal: 0.5,
  glowAlphaBase: 0.06,
  glowAlphaRatio: 0.14,
  glowAlphaHighlightBoost: 0.18,
};

export const LIGHT_THEME: ReducerTheme = {
  edgeAlpha: 0.85,
  defaultEdgeColor: "rgba(71,85,105,0.85)",
  nodeAlpha: 0.85,
  nodeBorderColor: "#ffffff",
  nodeBorderAlpha: 0.9,
  labelColor: "#1e293b",
  labelBackground: "255,255,255",
  labelBackgroundAlphaHighlight: 0.95,
  labelBackgroundAlphaNormal: 0.75,
  glowAlphaBase: 0.18,
  glowAlphaRatio: 0.2,
  glowAlphaHighlightBoost: 0.25,
};

export function makeNodeReducer(theme: ReducerTheme) {
  return function nodeReducer(_node: string, data: Record<string, unknown>) {
    const res: Record<string, unknown> = { ...data };
    const isGlow = data._glow === true;
    const entityType = (data.entityType as string) ?? (data.type as string) ?? "OTHER";
    const baseColor = ENTITY_COLORS[entityType] ?? ENTITY_COLORS.OTHER;
    const highlighted = data.highlighted === true;
    const degRatio = Math.min(1, (Number(data._deg) || 0) / 10);

    if (isGlow) {
      const baseAlpha = theme.glowAlphaBase + degRatio * theme.glowAlphaRatio;
      res.type = "circle";
      res.color = hexToRgba(baseColor, highlighted ? baseAlpha + theme.glowAlphaHighlightBoost : baseAlpha);
      res.size = highlighted ? (Number(data.size) || 15) * 1.5 : Number(data.size) || 15;
      res.zIndex = 0;
      res.borderSize = 0;
      res.label = "";
      return res;
    }

    res.type = "circle";

    const baseSize = Number(data.size) || 6;
    if (highlighted) {
      res.size = baseSize * 1.35;
      res.zIndex = 3;
      res.color = hexToRgba(baseColor, 0.88);
      res.borderColor = hexToRgba(theme.nodeBorderColor, theme.nodeBorderAlpha);
      res.borderSize = 2.5;
    } else {
      res.size = baseSize;
      res.zIndex = 1;
      res.color = hexToRgba(baseColor, theme.nodeAlpha);
      res.borderColor = hexToRgba(theme.nodeBorderColor, theme.nodeBorderAlpha);
      res.borderSize = 2;
    }

    const label = (data.label as string) ?? "";
    res.label = label;

    return res;
  };
}

export function makeEdgeReducer(theme: ReducerTheme) {
  return function edgeReducer(_edge: string, data: Record<string, unknown>) {
    const res: Record<string, unknown> = { ...data };
    const sourceColor = (data.sourceColor as string) ?? "#64748b";
    const weight = Number(data.weight) || 1;
    res.type = "line";
    res.size = Math.max(0.3, Math.min(1.8, weight / 6));
    res.color = hexToRgba(sourceColor, theme.edgeAlpha);
    res.zIndex = 0;
    return res;
  };
}
