"use client";

import { useState } from "react";
import { PlusIcon, Trash2Icon, MessageSquareIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

export interface ChatSession {
  id: string;
  title: string;
  lastMessage: string;
  createdAt: string;
  updatedAt: string;
}

interface SessionListProps {
  sessions: ChatSession[];
  currentSessionId: string | null;
  loading: boolean;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
}

export function SessionList({
  sessions,
  currentSessionId,
  loading,
  onSelect,
  onCreate,
  onDelete,
}: SessionListProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b p-3">
        <Button onClick={onCreate} className="w-full" size="sm">
          <PlusIcon className="mr-1.5 h-4 w-4" />
          新建对话
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-md" />
            ))
          ) : sessions.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
              暂无对话记录
            </div>
          ) : (
            sessions.map((s) => {
              const isActive = s.id === currentSessionId;
              return (
                <div
                  key={s.id}
                  className={cn(
                    "group relative rounded-md border transition-colors cursor-pointer",
                    isActive
                      ? "border-primary bg-primary/10"
                      : "border-transparent hover:bg-muted/50"
                  )}
                  onClick={() => onSelect(s.id)}
                >
                  <div className="px-3 py-2.5 pr-8">
                    <div className="flex items-center gap-2 mb-1">
                      <MessageSquareIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="font-medium text-sm truncate">
                        {s.title || "新对话"}
                      </span>
                    </div>
                    {s.lastMessage && (
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {s.lastMessage}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteId(s.id);
                    }}
                    aria-label="删除会话"
                    className="absolute right-1.5 top-1.5 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-opacity"
                  >
                    <Trash2Icon className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>

      <AlertDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除对话</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除这个对话吗？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteId) onDelete(deleteId);
                setDeleteId(null);
              }}
              className="bg-destructive text-destructive-foreground"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
