"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  FileTextIcon,
  FilePlusIcon,
  UploadCloudIcon,
  MessageSquareIcon,
  ClockIcon,
  DatabaseIcon,
  SparklesIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatTimeAgo } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCard, StatCardSkeleton } from "@/components/dashboard/stat-card";
import { QuickAction } from "@/components/dashboard/quick-action";

interface RecentNote {
  id: string;
  title: string;
  updatedAt: string;
}

interface DashboardData {
  totalNotes: number;
  thisWeekNotes: number;
  byCategory: Record<string, number>;
  recentNotes: RecentNote[];
  documentCount: number;
  sessionCount: number;
}

const categoryLabels: Record<string, string> = {
  WORK: "工作",
  STUDY: "学习",
  LIFE: "生活",
  PROJECT: "项目",
};

export default function DashboardPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const username = session?.user?.name ?? "用户";
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load dashboard");
      const json = await res.json();
      setData(json.data);
    } catch {
      toast.error("加载仪表盘数据失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreateNote = useCallback(async () => {
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "无标题笔记", content: "" }),
      });
      if (!res.ok) throw new Error("Failed to create");
      const json = await res.json();
      router.push(`/notes/${json.data.id}`);
    } catch {
      toast.error("创建笔记失败");
    }
  }, [router]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">你好，{username}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          这里是你的个人知识工作台
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading || !data ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard
              title="笔记总数"
              value={data.totalNotes}
              icon={<FileTextIcon className="h-5 w-5" />}
            />
            <StatCard
              title="本周新增"
              value={data.thisWeekNotes}
              icon={<SparklesIcon className="h-5 w-5" />}
            />
            <StatCard
              title="知识库文档"
              value={data.documentCount}
              icon={<DatabaseIcon className="h-5 w-5" />}
            />
            <StatCard
              title="对话会话"
              value={data.sessionCount}
              icon={<MessageSquareIcon className="h-5 w-5" />}
            />
          </>
        )}
      </div>

      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">快速操作</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <QuickAction
            title="新建笔记"
            description="记录灵感与知识"
            icon={<FilePlusIcon className="h-5 w-5" />}
            onClick={handleCreateNote}
          />
          <QuickAction
            title="上传文档"
            description="构建你的知识库"
            icon={<UploadCloudIcon className="h-5 w-5" />}
            href="/knowledge"
          />
          <QuickAction
            title="开始对话"
            description="基于知识库问答"
            icon={<MessageSquareIcon className="h-5 w-5" />}
            href="/chat"
          />
        </div>
      </div>

      {loading || !data ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-muted-foreground">最近笔记</h2>
            {Object.keys(data.byCategory).length > 0 && (
              <div className="hidden md:flex flex-wrap items-center gap-1.5">
                {Object.entries(data.byCategory).map(([cat, count]) => (
                  <Badge key={cat} variant="secondary" className="text-xs">
                    {categoryLabels[cat] ?? cat} · {count}
                  </Badge>
                ))}
              </div>
            )}
          </div>
          {data.recentNotes.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                还没有笔记，
                <Button
                  variant="link"
                  size="sm"
                  className="px-1 h-auto"
                  onClick={handleCreateNote}
                >
                  创建第一篇
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {data.recentNotes.map((note) => (
                <Link
                  key={note.id}
                  href={`/notes/${note.id}`}
                  className="flex items-center justify-between gap-3 rounded-lg border p-3 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <FileTextIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="font-medium truncate">
                      {note.title || "无标题"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 text-xs text-muted-foreground">
                    <ClockIcon className="h-3.5 w-3.5" />
                    <span>{formatTimeAgo(new Date(note.updatedAt))}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}


