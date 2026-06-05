"use client";

import { useEffect, useRef, useState } from "react";

export interface BuildJobView {
  id: string;
  scope: "incremental" | "rebuild";
  status: "running" | "completed" | "failed" | "interrupted";
  total: number;
  completed: number;
  failed: number;
  currentDoc: string | null;
  errorMsg: string | null;
  startedAt: string;
  finishedAt: string | null;
}

const POLL_INTERVAL_MS = 3000;
const IDLE_INTERVAL_MS = 30000;

export function useBuildProgress(onCompleted?: () => void) {
  const [job, setJob] = useState<BuildJobView | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const onCompletedRef = useRef(onCompleted);
  onCompletedRef.current = onCompleted;
  const lastStatusRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function poll() {
      try {
        const res = await fetch("/api/knowledge/graph/build");
        if (!res.ok) return;
        const json = await res.json();
        if (cancelled) return;
        const next: BuildJobView | null = json.job ?? null;
        setJob(next);
        if (next && next.status !== lastStatusRef.current) {
          if (next.status === "completed" || next.status === "failed") {
            onCompletedRef.current?.();
            setDismissed(false);
          }
          lastStatusRef.current = next.status;
        }
        if (!next) {
          lastStatusRef.current = null;
          setDismissed(false);
        }
      } catch {
      }
    }

    function schedule(delay: number) {
      if (cancelled) return;
      timer = setTimeout(async () => {
        await poll();
        const nextDelay = lastStatusRef.current === "running" ? POLL_INTERVAL_MS : IDLE_INTERVAL_MS;
        schedule(nextDelay);
      }, delay);
    }

    poll();
    schedule(POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  const visible = job && job.status === "running" && !dismissed;

  return {
    job,
    visible,
    dismiss: () => setDismissed(true),
  };
}
