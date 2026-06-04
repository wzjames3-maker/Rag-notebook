"use client";

import { Loader2Icon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { useBuildProgress } from "@/hooks/use-build-progress";
import { Button } from "@/components/ui/button";

interface BuildProgressBannerProps {
  onCompleted?: () => void;
}

export function BuildProgressBanner({ onCompleted }: BuildProgressBannerProps) {
  const { job, visible, dismiss } = useBuildProgress(onCompleted);

  if (!visible || !job) return null;

  const pct = job.total > 0 ? Math.round((job.completed / job.total) * 100) : 0;

  const handleDismiss = () => {
    dismiss();
    toast.info("任务仍在后台运行，可前往知识库页查看", { duration: 5000 });
  };

  return (
    <div className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center gap-3">
        <Loader2Icon className="h-4 w-4 animate-spin text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-muted-foreground truncate">
              {job.scope === "rebuild" ? "全量重建" : "增量构建"}图谱中
              {job.currentDoc ? `：${job.currentDoc}` : "..."}
              {job.failed > 0 && `（${job.failed} 个失败）`}
            </span>
            <span className="font-medium text-foreground ml-2 shrink-0">
              {job.completed}/{job.total} · {pct}%
            </span>
          </div>
          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleDismiss}
          aria-label="关闭进度提示"
        >
          <XIcon className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
