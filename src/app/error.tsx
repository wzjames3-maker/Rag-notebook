"use client";

import { useEffect } from "react";
import { AlertTriangleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen w-full items-center justify-center p-4">
      <div className="flex max-w-md flex-col items-center text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangleIcon className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight mb-2">出错了</h1>
        <p className="text-sm text-muted-foreground mb-6">
          页面渲染时发生了意外错误，请稍后重试。
        </p>
        {error.digest && (
          <p className="text-xs text-muted-foreground mb-4 font-mono">
            错误 ID: {error.digest}
          </p>
        )}
        <div className="flex gap-2">
          <Button onClick={() => reset()} size="sm">
            重试
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => (window.location.href = "/dashboard")}
          >
            返回首页
          </Button>
        </div>
      </div>
    </div>
  );
}
