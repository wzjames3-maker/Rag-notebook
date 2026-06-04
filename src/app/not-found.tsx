import Link from "next/link";
import { FileQuestionIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export default function NotFound() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center p-4">
      <div className="flex max-w-md flex-col items-center text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <FileQuestionIcon className="h-7 w-7" />
        </div>
        <h1 className="text-6xl font-bold tracking-tight mb-2">404</h1>
        <h2 className="text-xl font-semibold mb-2">页面未找到</h2>
        <p className="text-sm text-muted-foreground mb-6">
          你访问的页面不存在或已被移除
        </p>
        <Link
          href="/dashboard"
          className={cn(
            "inline-flex h-8 items-center justify-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/80 transition-colors"
          )}
        >
          返回首页
        </Link>
      </div>
    </div>
  );
}
