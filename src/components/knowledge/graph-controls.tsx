"use client";

import { SearchIcon, RefreshCwIcon, LayoutIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  onResetLayout?: () => void;
}

export function GraphControls({
  filters,
  onChange,
  entityTypes,
  communities,
  stats,
  onRefresh,
  onResetLayout,
}: GraphControlsProps) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b bg-card/80 backdrop-blur-sm flex-wrap">
      <div className="relative flex-1 min-w-[180px] max-w-xs">
        <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="搜索实体..."
          className="h-8 pl-8 text-xs"
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
        />
      </div>

      <Select
        value={filters.types[0] ?? ""}
        onValueChange={(value) =>
          onChange({ ...filters, types: value ? [value] : [] })
        }
      >
        <SelectTrigger className="h-8 w-[140px] text-xs">
          <SelectValue placeholder="所有类型" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">所有类型</SelectItem>
          {entityTypes.map((t) => (
            <SelectItem key={t} value={t}>
              {t}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.community ?? ""}
        onValueChange={(value) =>
          onChange({ ...filters, community: value || null })
        }
      >
        <SelectTrigger className="h-8 w-[160px] text-xs">
          <SelectValue placeholder="所有社区" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">所有社区</SelectItem>
          {communities.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.title ?? `社区 ${c.id.slice(0, 6)}`} ({c.size})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex items-center gap-1.5">
        {onRefresh && (
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={onRefresh}
            title="刷新图谱"
          >
            <RefreshCwIcon className="h-3.5 w-3.5 mr-1.5" />
            刷新
          </Button>
        )}

        {onResetLayout && (
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={onResetLayout}
            title="重置布局"
          >
            <LayoutIcon className="h-3.5 w-3.5 mr-1.5" />
            重置
          </Button>
        )}
      </div>

      {stats && (
        <div className="ml-auto flex items-center gap-2">
          <Badge variant="secondary" className="h-7 gap-1.5 text-xs font-normal">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {stats.entityCount} 实体
          </Badge>
          <Badge variant="secondary" className="h-7 gap-1.5 text-xs font-normal">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
            {stats.relationshipCount} 关系
          </Badge>
          <Badge variant="secondary" className="h-7 gap-1.5 text-xs font-normal">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
            {stats.communityCount} 社区
          </Badge>
        </div>
      )}
    </div>
  );
}
