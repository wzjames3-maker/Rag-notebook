"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { formatTimeAgo } from "@/lib/utils";

const categoryLabels: Record<string, string> = {
  WORK: "工作",
  STUDY: "学习",
  LIFE: "生活",
  PROJECT: "项目",
};

const categoryColors: Record<string, string> = {
  WORK: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  STUDY: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  LIFE: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  PROJECT: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
};

interface NoteCardProps {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  updatedAt: string;
}

export function NoteCard({ id, title, content, category, tags, updatedAt }: NoteCardProps) {
  const timeAgo = formatTimeAgo(new Date(updatedAt));

  return (
    <Link href={`/notes/${id}`}>
      <Card className="h-full hover:bg-accent/50 transition-colors cursor-pointer">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold leading-tight line-clamp-2 flex-1">
              {title || "无标题"}
            </h3>
            <Badge
              variant="secondary"
              className={`text-xs shrink-0 ${categoryColors[category] || ""}`}
            >
              {categoryLabels[category] || category}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-sm text-muted-foreground line-clamp-3 mb-3">
            {content || "暂无内容"}
          </p>
          <div className="flex items-center justify-between gap-2">
            <div className="flex gap-1 flex-wrap">
              {tags.slice(0, 3).map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
              {tags.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{tags.length - 3}
                </Badge>
              )}
            </div>
            <span className="text-xs text-muted-foreground shrink-0">{timeAgo}</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

