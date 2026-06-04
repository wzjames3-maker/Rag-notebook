"use client";

import { useState } from "react";
import { ChevronDownIcon, FileTextIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ChatSource {
  id: string;
  content: string;
  filename: string;
  chunkIndex: number;
  score: number;
}

interface SourceRefsProps {
  sources: ChatSource[];
}

export function SourceRefs({ sources }: SourceRefsProps) {
  const [open, setOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!sources || sources.length === 0) return null;

  return (
    <div className="mt-3 border-t pt-3">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        className="h-7 px-2 text-xs"
      >
        <FileTextIcon className="mr-1 h-3.5 w-3.5" />
        参考来源（{sources.length}）
        <ChevronDownIcon
          className={cn(
            "ml-1 h-3.5 w-3.5 transition-transform",
            open && "rotate-180"
          )}
        />
      </Button>

      {open && (
        <div className="mt-2 space-y-2">
          {sources.map((s, idx) => {
            const isExpanded = expandedId === s.id;
            return (
              <div
                key={s.id}
                className="rounded-md border bg-muted/30 text-xs"
              >
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : s.id)}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-muted/50"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-medium text-muted-foreground shrink-0">
                      [{idx + 1}]
                    </span>
                    <span className="font-medium truncate">{s.filename}</span>
                    <span className="text-muted-foreground shrink-0">
                      chunk {s.chunkIndex}
                    </span>
                  </div>
                  <ChevronDownIcon
                    className={cn(
                      "h-3.5 w-3.5 shrink-0 transition-transform",
                      isExpanded && "rotate-180"
                    )}
                  />
                </button>
                {isExpanded && (
                  <div className="border-t px-3 py-2 text-foreground/80 whitespace-pre-wrap break-words">
                    {s.content}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
