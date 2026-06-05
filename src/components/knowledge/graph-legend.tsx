"use client";

import { ENTITY_COLORS, hexToRgba } from "@/lib/graph/colors";

interface CommunityOption {
  id: string;
  size: number;
  title: string | null;
  rating: number | null;
}

interface CommunityInfo {
  title: string | null;
  summary: string | null;
  rating: number | null;
}

interface GraphLegendProps {
  communities: CommunityOption[];
  communityMap: Record<string, CommunityInfo>;
  entityTypes: string[];
}

const COMMUNITY_COLORS = [
  "#6366f1", "#f59e0b", "#22c55e", "#ec4899",
  "#0ea5e9", "#a855f7", "#ef4444", "#14b8a6",
  "#f97316", "#8b5cf6", "#06b6d4", "#84cc16",
];

function getCommunityColor(id: string, allIds: CommunityOption[]): string {
  const idx = allIds.findIndex((c) => c.id === id);
  if (idx === -1) return "#999";
  return COMMUNITY_COLORS[idx % COMMUNITY_COLORS.length];
}

function NodeDot({ color }: { color: string }) {
  return (
    <span className="relative inline-flex items-center justify-center w-4 h-4 shrink-0">
      <span
        className="absolute inset-0 rounded-full"
        style={{
          backgroundColor: hexToRgba(color, 0.15),
          boxShadow: `0 0 6px ${hexToRgba(color, 0.3)}`,
        }}
      />
      <span
        className="relative w-2 h-2 rounded-full"
        style={{
          backgroundColor: color,
          boxShadow: `0 0 0 1.5px ${hexToRgba(color, 0.4)}`,
        }}
      />
    </span>
  );
}

export function GraphLegend({ communities, communityMap, entityTypes }: GraphLegendProps) {
  if (communities.length === 0 && entityTypes.length === 0) return null;

  return (
    <div className="absolute top-3 right-3 z-2 max-w-[260px] rounded-xl ring-1 ring-foreground/10 bg-card/95 backdrop-blur-md p-3.5 text-xs space-y-3 shadow-lg">
      {communities.length > 0 && (
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            社区
          </div>
          <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
            {communities.slice(0, 12).map((c) => {
              const color = getCommunityColor(c.id, communities);
              const info = communityMap[c.id];
              return (
                <div key={c.id} className="flex items-center gap-2 min-w-0">
                  <NodeDot color={color} />
                  <span className="truncate text-foreground/80">
                    {info?.title ?? c.title ?? `社区 ${c.id.slice(0, 6)}`}
                    <span className="text-muted-foreground/60 ml-1">({c.size})</span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {entityTypes.length > 0 && (
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            实体类型
          </div>
          <div className="flex flex-wrap gap-1.5">
            {entityTypes.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground"
              >
                <NodeDot color={ENTITY_COLORS[t] ?? ENTITY_COLORS.OTHER} />
                {t}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
