"use client";

import { XIcon, FileTextIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { entityTypeIcons } from "@/lib/graph/colors";

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
  const hasCommunity = node.communityId && communityInfo;

  return (
    <div className="w-80 border-l bg-background p-4 overflow-auto">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg shrink-0">{typeIcon}</span>
          <h3 className="font-semibold text-sm truncate">{node.label}</h3>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} aria-label="关闭">
          <XIcon className="h-4 w-4" />
        </Button>
      </div>

      <div className="text-xs text-muted-foreground mb-3">
        类型：{node.type}
      </div>

      {hasCommunity && communityInfo && (
        <div className="rounded-md border bg-muted/40 p-3 mb-3 space-y-1.5">
          <div className="text-xs font-medium text-foreground">
            所属社区
          </div>
          <div className="text-sm">
            {communityInfo.title ?? `社区 ${node.communityId.slice(0, 8)}`}
          </div>
          {communityInfo.summary && (
            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-4">
              {communityInfo.summary}
            </p>
          )}
          {communityInfo.rating != null && (
            <div className="text-xs text-muted-foreground">
              相关性评分：{communityInfo.rating.toFixed(1)} / 5
            </div>
          )}
        </div>
      )}

      <div className="text-xs font-medium mb-1.5">描述</div>
      <p className="text-sm mb-4 leading-relaxed">{node.description || "（无描述）"}</p>

      <div className="pt-3 border-t">
        <div className="text-xs text-muted-foreground flex items-center gap-1.5">
          <FileTextIcon className="h-3 w-3" />
          来源：实体提取自知识库文档
        </div>
      </div>
    </div>
  );
}
