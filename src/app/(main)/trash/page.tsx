"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
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
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RotateCcwIcon, Trash2Icon, TrashIcon } from "lucide-react";

interface TrashNote {
  id: string;
  title: string;
  content: string;
  category: string;
  deletedAt: string;
}

export default function TrashPage() {
  const [notes, setNotes] = useState<TrashNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/trash");
        if (!res.ok) throw new Error("Failed to fetch");
        const json = await res.json();
        if (!cancelled) setNotes(json.data);
      } catch {
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  async function handleRestore(id: string) {
    try {
      const res = await fetch(`/api/trash/${id}`, { method: "PUT" });
      if (!res.ok) throw new Error("Failed to restore");
      setNotes((prev) => prev.filter((n) => n.id !== id));
    } catch {
    }
  }

  async function handlePermanentDelete(id: string) {
    try {
      const res = await fetch(`/api/trash/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      setNotes((prev) => prev.filter((n) => n.id !== id));
      setDeleteId(null);
    } catch {
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <TrashIcon className="h-6 w-6" />
        <h1 className="text-2xl font-bold tracking-tight">回收站</h1>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
      ) : notes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <TrashIcon className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">回收站是空的</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => (
            <Card key={note.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{note.title || "无标题"}</h3>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRestore(note.id)}
                    >
                      <RotateCcwIcon className="mr-1 h-3.5 w-3.5" />
                      恢复
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => setDeleteId(note.id)}
                    >
                      <Trash2Icon className="mr-1 h-3.5 w-3.5" />
                      永久删除
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {note.category}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    删除于 {new Date(note.deletedAt).toLocaleDateString("zh-CN")}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>永久删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要永久删除这篇笔记吗？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && handlePermanentDelete(deleteId)}
              className="bg-destructive text-destructive-foreground"
            >
              永久删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
