"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeftIcon, Trash2Icon } from "lucide-react";
import { NoteEditor } from "@/components/notes/note-editor";

interface Note {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
}

export default function NoteEditorPage() {
  const router = useRouter();
  const params = useParams();
  const noteId = params.id as string;

  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("saved");
  const contentRef = useRef("");
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    async function fetchNote() {
      try {
        const res = await fetch(`/api/notes/${noteId}`);
        if (!res.ok) {
          if (res.status === 404) {
            router.push("/notes");
            return;
          }
          throw new Error("Failed to fetch");
        }
        const json = await res.json();
        setNote(json.data);
        contentRef.current = json.data.content;
      } catch {
        router.push("/notes");
      } finally {
        setLoading(false);
      }
    }
    fetchNote();
  }, [noteId, router]);

  const saveNote = useCallback(async () => {
    if (!note) return;
    setSaving(true);
    setSaveStatus("saving");

    try {
      const res = await fetch(`/api/notes/${noteId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: note.title,
          content: contentRef.current,
          category: note.category,
          tags: note.tags,
        }),
      });

      if (!res.ok) throw new Error("Failed to save");
      setSaveStatus("saved");
    } catch {
      setSaveStatus("unsaved");
    } finally {
      setSaving(false);
    }
  }, [note, noteId]);

  const handleContentChange = useCallback((content: string) => {
    contentRef.current = content;
    setSaveStatus("unsaved");

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    autoSaveTimerRef.current = setTimeout(() => {
      saveNote();
    }, 1500);
  }, [saveNote]);

  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  async function handleTitleChange(title: string) {
    setNote((prev) => prev ? { ...prev, title } : null);
    setSaveStatus("unsaved");

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    autoSaveTimerRef.current = setTimeout(() => {
      saveNote();
    }, 1500);
  }

  async function handleCategoryChange(category: string | null) {
    if (!category) return;
    setNote((prev) => prev ? { ...prev, category } : null);
    setSaveStatus("unsaved");

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    autoSaveTimerRef.current = setTimeout(() => {
      saveNote();
    }, 1500);
  }

  async function handleDelete() {
    try {
      const res = await fetch(`/api/notes/${noteId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      router.push("/notes");
    } catch {
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!note) return null;

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push("/notes")}>
          <ArrowLeftIcon className="mr-1.5 h-4 w-4" />
          返回
        </Button>

        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {saveStatus === "saved" ? "已保存" : saveStatus === "saving" ? "保存中..." : "未保存"}
          </span>

          <AlertDialog>
            <AlertDialogTrigger className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground h-9 w-9 text-destructive">
              <Trash2Icon className="h-4 w-4" />
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>删除笔记</AlertDialogTitle>
                <AlertDialogDescription>
                  确定要删除这篇笔记吗？删除后可在回收站中恢复。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
                  删除
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="flex items-start gap-4">
        <Input
          value={note.title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="笔记标题"
          className="text-2xl font-bold border-none shadow-none focus-visible:ring-0 px-0 h-auto"
        />
        <Select value={note.category} onValueChange={handleCategoryChange}>
          <SelectTrigger className="w-28 shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="WORK">工作</SelectItem>
            <SelectItem value="STUDY">学习</SelectItem>
            <SelectItem value="LIFE">生活</SelectItem>
            <SelectItem value="PROJECT">项目</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-lg min-h-[500px]">
        <NoteEditor
          defaultValue={note.content}
          onChange={handleContentChange}
        />
      </div>
    </div>
  );
}
