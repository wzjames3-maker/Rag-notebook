"use client";

import { XIcon, FileTextIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { entityTypeIcons, ENTITY_COLORS } from "@/lib/graph/colors";
import { cn } from "@/lib/utils";

interface CommunityInfo {
  title: string | null;
  summary: string | null;
  rating: number | null;
}

interface NodeDetailProps {
  node: {
    id: string;
    label: string;
    type: string;
    description: string;
    communityId: string;
  } | null;
  communityInfo: CommunityInfo | null;
  onClose: () => void;
}

export function NodeDetailPanel({
  node,
  communityInfo,
  onClose,
}: NodeDetailProps) {
  if (!node) return null;

  const typeIcon = entityTypeIcons[node.type] ?? entityTypeIcons.OTHER;
  const typeColor = ENTITY_COLORS[node.type] ?? ENTITY_COLORS.OTHER;
  const hasCommunity = node.communityId && communityInfo;

  return (
    <div className="w-80 border-l bg-card p-4 overflow-auto">
      <div className="rounded-lg bg-muted/50 p-3 mb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-lg shrink-0">{typeIcon}</span>
            <h3 className="font-semibold text-sm truncate">{node.label}</h3>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 -mr-1 -mt-1 shrink-0" onClick={onClose} aria-label="关闭">
            <XIcon className="h-4 w-4" />
          </Button>
        </div>

        <Badge
          variant="outline"
          className="mt-2 text-[10px] h-5 gap-1.5 border-foreground/10"
          style={{ borderLeftColor: typeColor, borderLeftWidth: 3 }}
        >
          {node.type}
        </Badge>
      </div>

      {hasCommunity && communityInfo && (
        <div className="rounded-lg border bg-muted/40 p-3 mb-3 space-y-2">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            所属社区
          </div>
          <div className="text-sm font-medium">
            {communityInfo.title ?? `社区 ${node.communityId.slice(0, 8)}`}
          </div>
          {communityInfo.summary && (
            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-4">
              {communityInfo.summary}
            </p>
          )}
          {communityInfo.rating != null && (
            <div className="flex items-center gap-1.5">
              <div className="flex items-center gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "h-1.5 w-3 rounded-full",
                      i < Math.round(communityInfo.rating!) ? "bg-primary" : "bg-muted-foreground/20"
                    )}
                  />
                ))}
              </div>
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {communityInfo.rating.toFixed(1)}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="space-y-2">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          描述
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {node.description || "（无描述）"}
        </p>
      </div>

      <div className="pt-3 mt-3 border-t">
        <div className="text-xs text-muted-foreground/70 flex items-center gap-1.5">
          <FileTextIcon className="h-3 w-3" />
          来源：实体提取自知识库文档
        </div>
      </div>
    </div>
  );
}
