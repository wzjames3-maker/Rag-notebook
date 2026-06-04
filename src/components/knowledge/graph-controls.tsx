"use client";

import { SearchIcon, RefreshCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface CommunityOption {
  id: string;
  size: number;
  title: string | null;
  rating: number | null;
}

interface GraphControlsProps {
  filters: {
    types: string[];
    community: string | null;
    search: string;
  };
  onChange: (filters: GraphControlsProps["filters"]) => void;
  entityTypes: string[];
  communities: CommunityOption[];
  stats?: {
    entityCount: number;
    relationshipCount: number;
    communityCount: number;
  };
  onRefresh?: () => void;
}

export function GraphControls({
  filters,
  onChange,
  entityTypes,
  communities,
  stats,
  onRefresh,
}: GraphControlsProps) {
  return (
    <div className="flex items-center gap-2 p-2 border-b flex-wrap">
      <div className="relative flex-1 min-w-[180px] max-w-xs">
        <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="搜索实体..."
          className="h-8 pl-7 text-xs"
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
        />
      </div>

      <select
        className="h-8 px-2 text-xs border rounded bg-background"
        value={filters.types[0] ?? ""}
        onChange={(e) =>
          onChange({ ...filters, types: e.target.value ? [e.target.value] : [] })
        }
      >
        <option value="">所有类型</option>
        {entityTypes.map((t) => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>

      <select
        className="h-8 px-2 text-xs border rounded bg-background max-w-[180px] truncate"
        value={filters.community ?? ""}
        onChange={(e) =>
          onChange({ ...filters, community: e.target.value || null })
        }
      >
        <option value="">所有社区</option>
        {communities.map((c) => (
          <option key={c.id} value={c.id}>
            {c.title ?? `社区 ${c.id.slice(0, 6)}`} ({c.size})
          </option>
        ))}
      </select>

      {onRefresh && (
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-2"
          onClick={onRefresh}
          title="刷新图谱"
        >
          <RefreshCwIcon className="h-3.5 w-3.5" />
        </Button>
      )}

      {stats && (
        <span className="text-xs text-muted-foreground ml-auto whitespace-nowrap">
          实体: {stats.entityCount} · 关系: {stats.relationshipCount} · 社区: {stats.communityCount}
        </span>
      )}
    </div>
  );
}
