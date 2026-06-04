"use client";

import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { UserIcon, BotIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { SourceRefs, type ChatSource } from "./source-refs";
import { ToolCallDisplay, type ToolCallStep } from "./tool-call-display";

export interface ChatMessageData {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  sources?: ChatSource[] | null;
  isStreaming?: boolean;
  toolCalls?: ToolCallStep[];
}

interface MessageItemProps {
  message: ChatMessageData;
}

export function MessageItem({ message }: MessageItemProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "flex gap-3 px-4 py-4",
        isUser ? "bg-background" : "bg-muted/30"
      )}
    >
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-secondary text-secondary-foreground"
        )}
      >
        {isUser ? (
          <UserIcon className="h-4 w-4" />
        ) : (
          <BotIcon className="h-4 w-4" />
        )}
      </div>

      <div className="flex-1 min-w-0 space-y-2">
        <div className="font-semibold text-sm">
          {isUser ? "你" : "AI 助手"}
        </div>

        {!isUser && message.toolCalls && message.toolCalls.length > 0 && (
          <ToolCallDisplay toolCalls={message.toolCalls} />
        )}

        <div
          className={cn(
            "prose prose-sm dark:prose-invert max-w-none break-words",
            "prose-pre:bg-muted prose-pre:border prose-pre:border-border",
            "prose-code:before:content-none prose-code:after:content-none"
          )}
        >
          {message.content ? (
            <Markdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
            >
              {message.content}
            </Markdown>
          ) : message.isStreaming ? (
            <span className="text-muted-foreground animate-pulse">
              思考中…
            </span>
          ) : null}
        </div>

        {!isUser && message.sources && message.sources.length > 0 && (
          <SourceRefs sources={message.sources} />
        )}
      </div>
    </div>
  );
}
