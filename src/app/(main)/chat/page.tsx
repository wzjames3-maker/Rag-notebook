"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { BotIcon } from "lucide-react";
import { ChatInput } from "@/components/chat/chat-input";
import { MessageList } from "@/components/chat/message-list";
import {
  SessionList,
  type ChatSession,
} from "@/components/chat/session-list";
import type { ChatMessageData } from "@/components/chat/message-item";
import type { ChatSource } from "@/components/chat/source-refs";
import type { ToolCallStep } from "@/components/chat/tool-call-display";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { MenuIcon, PlusIcon } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

type StreamChunk = {
  type: string;
  id?: string;
  delta?: string;
  data?: unknown;
  messageId?: string;
  finishReason?: string;
  errorText?: string;
};

function parseSSEChunk(line: string): StreamChunk | null {
  if (!line.startsWith("data:")) return null;
  const payload = line.slice(5).trim();
  if (!payload || payload === "[DONE]") return null;
  try {
    return JSON.parse(payload) as StreamChunk;
  } catch {
    return null;
  }
}

function normalizeSources(raw: unknown): ChatSource[] | undefined {
  if (!raw) return undefined;
  if (Array.isArray(raw)) return raw as ChatSource[];
  if (typeof raw === "object" && raw !== null && "sources" in raw) {
    const inner = (raw as { sources: unknown }).sources;
    if (Array.isArray(inner)) return inner as ChatSource[];
  }
  return undefined;
}

async function readSSEStream(
  body: ReadableStream<Uint8Array>,
  onChunk: (chunk: StreamChunk) => void
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let sepIdx: number;
    while ((sepIdx = buffer.indexOf("\n\n")) !== -1) {
      const rawEvent = buffer.slice(0, sepIdx);
      buffer = buffer.slice(sepIdx + 2);
      for (const line of rawEvent.split("\n")) {
        const chunk = parseSSEChunk(line);
        if (chunk) onChunk(chunk);
      }
    }
  }

  if (buffer.length > 0) {
    for (const line of buffer.split("\n")) {
      const chunk = parseSSEChunk(line);
      if (chunk) onChunk(chunk);
    }
  }
}

export default function ChatPage() {
  const isMobile = useIsMobile();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mode, setMode] = useState<"rag" | "agent">("rag");
  const abortRef = useRef<AbortController | null>(null);
  const rafIdRef = useRef(0);

  const loadSessions = useCallback(async () => {
    setLoadingSessions(true);
    try {
      const res = await fetch("/api/chat/sessions");
      if (!res.ok) throw new Error("Failed to load sessions");
      const json = await res.json();
      setSessions(json.data);
    } catch {
      toast.error("加载会话列表失败");
    } finally {
      setLoadingSessions(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const loadSessionMessages = useCallback(async (sessionId: string) => {
    setLoadingMessages(true);
    setMessages([]);
    try {
      const res = await fetch(`/api/chat/sessions/${sessionId}`);
      if (!res.ok) throw new Error("Failed to load messages");
      const json = await res.json();
      const loaded: ChatMessageData[] = (json.data.messages || []).map(
        (m: {
          id: string;
          role: string;
          content: string;
          sources: unknown;
        }) => ({
          id: m.id,
          role: m.role.toLowerCase() as ChatMessageData["role"],
          content: m.content,
          sources: normalizeSources(m.sources),
        })
      );
      setMessages(loaded);
    } catch {
      toast.error("加载消息历史失败");
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    if (currentSessionId) {
      loadSessionMessages(currentSessionId);
    } else {
      setMessages([]);
    }
  }, [currentSessionId, loadSessionMessages]);

  const handleSelectSession = (id: string) => {
    if (isStreaming) return;
    setCurrentSessionId(id);
    setDrawerOpen(false);
  };

  const handleNewSession = () => {
    if (isStreaming) return;
    setCurrentSessionId(null);
    setMessages([]);
    setDrawerOpen(false);
  };

  const handleDeleteSession = async (id: string) => {
    if (isStreaming) {
      toast.error("生成中无法删除");
      return;
    }
    try {
      const res = await fetch(`/api/chat/sessions/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
      setSessions((prev) => prev.filter((s) => s.id !== id));
      if (currentSessionId === id) {
        setCurrentSessionId(null);
        setMessages([]);
      }
      toast.success("会话已删除");
    } catch {
      toast.error("删除失败");
    }
  };

  const handleStop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    cancelAnimationFrame(rafIdRef.current);
    rafIdRef.current = 0;
  };

  const handleSend = async (content: string) => {
    if (isStreaming) return;

    const userMessage: ChatMessageData = {
      id: `user-${Date.now()}`,
      role: "user",
      content,
    };

    const assistantId = `assistant-${Date.now()}`;

    const assistantMessage: ChatMessageData = {
      id: assistantId,
      role: "assistant",
      content: "",
      isStreaming: true,
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setIsStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(mode === "agent" ? "/api/agent-chat" : "/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: content,
          sessionId: currentSessionId ?? undefined,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.message || `请求失败 (${res.status})`);
      }
      if (!res.body) {
        throw new Error("响应为空");
      }

      const newSessionId = res.headers.get("X-Session-Id");
      if (newSessionId && !currentSessionId) {
        setCurrentSessionId(newSessionId);
      }

      let finalContent = "";
      let sources: ChatSource[] | undefined;
      let currentToolCalls: ToolCallStep[] = [];

      await readSSEStream(res.body, (chunk) => {
        if (chunk.type === "text-delta" && typeof chunk.delta === "string") {
          finalContent += chunk.delta;
          if (!rafIdRef.current) {
            rafIdRef.current = requestAnimationFrame(() => {
              rafIdRef.current = 0;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: finalContent, isStreaming: true }
                    : m
                )
              );
            });
          }
        } else if (
          chunk.type === "data-sources" &&
          Array.isArray(chunk.data)
        ) {
          sources = chunk.data as ChatSource[];
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, sources }
                : m
            )
          );
        } else if (chunk.type === "tool-call") {
          const toolCall = chunk.data as { toolName: string; args: Record<string, unknown>; toolCallId: string };
          currentToolCalls.push({
            toolName: toolCall.toolName,
            args: toolCall.args,
            status: "loading" as const,
          });
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, toolCalls: [...currentToolCalls] }
                : m
            )
          );
        } else if (chunk.type === "tool-result") {
          const result = chunk.data as { toolName: string; result: unknown; toolCallId: string };
          const idx = currentToolCalls.findIndex(
            (tc) => tc.toolName === result.toolName && tc.status === "loading"
          );
          if (idx >= 0) {
            currentToolCalls[idx] = {
              ...currentToolCalls[idx],
              result: result.result,
              status: "success" as const,
            };
          }
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, toolCalls: [...currentToolCalls] }
                : m
            )
          );
        } else if (chunk.type === "error") {
          toast.error(chunk.errorText || "生成失败");
        }
      });

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                content: finalContent,
                sources,
                isStreaming: false,
              }
            : m
        )
      );

      await loadSessions();
    } catch (err) {
      const isAbort = err instanceof DOMException && err.name === "AbortError";
      if (isAbort) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, isStreaming: false } : m
          )
        );
      } else {
        const message = err instanceof Error ? err.message : "请求失败";
        toast.error(message);
        setMessages((prev) => prev.filter((m) => m.id !== assistantId));
      }
    } finally {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = 0;
      setIsStreaming(false);
      abortRef.current = null;
    }
  };

  const sidebar = (
    <SessionList
      sessions={sessions}
      currentSessionId={currentSessionId}
      loading={loadingSessions}
      onSelect={handleSelectSession}
      onCreate={handleNewSession}
      onDelete={handleDeleteSession}
    />
  );

  return (
    <div className="flex h-[calc(100vh-8rem)] -mt-4 -mx-4 lg:-mt-6 lg:-mx-6">
      {!isMobile && (
        <aside className="w-64 shrink-0 border-r bg-muted/20">{sidebar}</aside>
      )}

      <div className="flex flex-1 flex-col min-w-0 bg-background">
        <div className="flex items-center justify-between border-b px-4 py-2">
          <div className="flex items-center gap-2 min-w-0">
            {isMobile && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setDrawerOpen(true)}
                aria-label="打开会话列表"
              >
                <MenuIcon className="h-4 w-4" />
              </Button>
            )}
            <h1 className="font-semibold text-sm truncate">
              {currentSessionId
                ? sessions.find((s) => s.id === currentSessionId)?.title ||
                  "对话"
                : "新对话"}
            </h1>
          </div>
          {isMobile && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleNewSession}
              disabled={isStreaming}
            >
              <PlusIcon className="h-4 w-4" />
            </Button>
          )}
        </div>

        <div className="flex items-center gap-1 px-4 py-1 border-b">
          <button
            className={`text-xs px-2 py-1 rounded ${mode === "rag" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => setMode("rag")}
          >
            普通 RAG
          </button>
          <button
            className={`text-xs px-2 py-1 rounded ${mode === "agent" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => setMode("agent")}
          >
            智能 Agent
          </button>
        </div>

        {loadingMessages ? (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
            加载中...
          </div>
        ) : (
          <MessageList
            messages={messages}
            emptyState={
              <div className="flex flex-col items-center text-center max-w-sm">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <BotIcon className="h-6 w-6 text-muted-foreground" />
                </div>
                <h2 className="text-lg font-semibold mb-1">开始你的 AI 对话</h2>
                <p className="text-sm text-muted-foreground">
                  上传文档到知识库后，AI 助手会基于文档内容回答你的问题。
                </p>
              </div>
            }
          />
        )}

        <ChatInput
          onSend={handleSend}
          isStreaming={isStreaming}
          onStop={handleStop}
        />
      </div>

      {isMobile && (
        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <SheetContent side="left" className="w-72 p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>会话列表</SheetTitle>
              <SheetDescription>查看和管理所有对话</SheetDescription>
            </SheetHeader>
            {sidebar}
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}
