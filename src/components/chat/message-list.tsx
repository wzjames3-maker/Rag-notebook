"use client";

import { useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageItem, type ChatMessageData } from "./message-item";

interface MessageListProps {
  messages: ChatMessageData[];
  emptyState?: React.ReactNode;
}

export function MessageList({ messages, emptyState }: MessageListProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const lastMessageCountRef = useRef(0);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const scroller =
      viewport.closest<HTMLElement>("[data-slot=scroll-area-viewport]") ??
      viewport;

    const last = messages[messages.length - 1];
    const newMessageAdded = messages.length > lastMessageCountRef.current;
    lastMessageCountRef.current = messages.length;

    if (newMessageAdded || last?.isStreaming) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    } else {
      scroller.scrollTop = scroller.scrollHeight;
    }
  }, [messages]);

  if (messages.length === 0 && emptyState) {
    return (
      <div className="flex flex-1 items-center justify-center px-4">
        {emptyState}
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <div ref={viewportRef} className="divide-y">
        {messages.map((m) => (
          <MessageItem key={m.id} message={m} />
        ))}
        <div ref={bottomRef} className="h-2" />
      </div>
    </ScrollArea>
  );
}
