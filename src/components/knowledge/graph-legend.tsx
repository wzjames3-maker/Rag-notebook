"use client";

import { entityTypeIcons } from "@/lib/graph/colors";

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
  "#4E79A7", "#F28E2B", "#E15759", "#76B7B2",
  "#59A14F", "#EDC948", "#B07AA1", "#FF9DA7",
  "#9C755F", "#BAB0AC", "#86BCB6", "#8CD17D",
];

function getCommunityColor(id: string, allIds: CommunityOption[]): string {
  const idx = allIds.findIndex((c) => c.id === id);
  if (idx === -1) return "#999";
  return COMMUNITY_COLORS[idx % COMMUNITY_COLORS.length];
}

const ENTITY_TYPE_SHAPES: Record<string, string> = {
  PERSON: "◆",
  ORGANIZATION: "■",
  LOCATION: "▲",
  CONCEPT: "★",
  EVENT: "★",
  TECHNOLOGY: "★",
  PRODUCT: "★",
  OTHER: "●",
};

export function GraphLegend({ communities, communityMap, entityTypes }: GraphLegendProps) {
  if (communities.length === 0 && entityTypes.length === 0) return null;

  return (
    <div className="absolute bottom-3 left-3 max-w-[260px] rounded-md border bg-background/95 backdrop-blur p-3 text-xs space-y-3 shadow-sm">
      {communities.length > 0 && (
        <div>
          <div className="font-medium mb-1.5">社区</div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {communities.slice(0, 12).map((c) => {
              const color = getCommunityColor(c.id, communities);
              const info = communityMap[c.id];
              return (
                <div key={c.id} className="flex items-center gap-2 min-w-0">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-sm shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span className="truncate">
                    {info?.title ?? c.title ?? `社区 ${c.id.slice(0, 6)}`}
                    <span className="text-muted-foreground ml-1">({c.size})</span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {entityTypes.length > 0 && (
        <div>
          <div className="font-medium mb-1.5">实体类型</div>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {entityTypes.map((t) => (
              <span key={t} className="flex items-center gap-1">
                <span className="text-sm leading-none">{ENTITY_TYPE_SHAPES[t] ?? "●"}</span>
                <span className="text-muted-foreground">{t}</span>
                <span className="text-[10px]">{entityTypeIcons[t] ?? ""}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
