"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlusIcon, SearchIcon } from "lucide-react";
import { NoteCard } from "@/components/notes/note-card";

interface Note {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  updatedAt: string;
}

const categories = [
  { value: "", label: "全部" },
  { value: "WORK", label: "工作" },
  { value: "STUDY", label: "学习" },
  { value: "LIFE", label: "生活" },
  { value: "PROJECT", label: "项目" },
];

export default function NotesPage() {
  const router = useRouter();
  const [notes, setNotes] = useState<Note[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef(1);
  const loadingMoreRef = useRef(false);
  const searchRef = useRef("");
  const limit = 20;

  useEffect(() => {
    let cancelled = false;
    pageRef.current = 1;
    searchRef.current = search;

    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: "1",
          limit: String(limit),
        });
        if (category) params.set("category", category);
        if (search) params.set("search", search);

        const res = await fetch(`/api/notes?${params}`);
        if (!res.ok) throw new Error("Failed to fetch");
        const json = await res.json();
        if (!cancelled) {
          setNotes(json.data);
          setTotal(json.total);
        }
      } catch {
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [category, search]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (!loadMoreRef.current) return;

    observerRef.current = new IntersectionObserver(
      async (entries) => {
        if (
          entries[0].isIntersecting &&
          !loadingMoreRef.current &&
          notes.length < total
        ) {
          loadingMoreRef.current = true;
          setLoadingMore(true);
          try {
            const nextPage = pageRef.current + 1;
            const params = new URLSearchParams({
              page: String(nextPage),
              limit: String(limit),
            });
            if (category) params.set("category", category);
            if (searchRef.current) params.set("search", searchRef.current);

            const res = await fetch(`/api/notes?${params}`);
            if (!res.ok) throw new Error("Failed to fetch");
            const json = await res.json();
            setNotes((prev) => [...prev, ...json.data]);
            pageRef.current = nextPage;
          } catch {
          } finally {
            loadingMoreRef.current = false;
            setLoadingMore(false);
          }
        }
      },
      { threshold: 0.1 }
    );

    observerRef.current.observe(loadMoreRef.current);
    return () => observerRef.current?.disconnect();
  }, [notes.length, total, category]);

  async function handleCreateNote() {
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
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">我的笔记</h1>
        <Button onClick={handleCreateNote} size="sm">
          <PlusIcon className="mr-1.5 h-4 w-4" />
          新建笔记
        </Button>
      </div>

      <div className="relative max-w-sm">
        <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="搜索笔记..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="pl-8"
        />
      </div>

      <Tabs value={category} onValueChange={setCategory}>
        <TabsList>
          {categories.map((cat) => (
            <TabsTrigger key={cat.value} value={cat.value}>
              {cat.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-lg" />
          ))}
        </div>
      ) : notes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-muted-foreground mb-4">
            {search ? "没有找到匹配的笔记" : "还没有笔记，创建第一篇吧"}
          </p>
          {!search && (
            <Button onClick={handleCreateNote} variant="outline">
              <PlusIcon className="mr-1.5 h-4 w-4" />
              创建笔记
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {notes.map((note) => (
              <NoteCard key={note.id} {...note} />
            ))}
          </div>

          <div ref={loadMoreRef} className="h-8">
            {loadingMore && (
              <div className="flex justify-center py-2">
                <Skeleton className="h-4 w-24" />
              </div>
            )}
          </div>

          <p className="text-center text-sm text-muted-foreground">
            共 {total} 篇笔记
          </p>
        </>
      )}
    </div>
  );
}
