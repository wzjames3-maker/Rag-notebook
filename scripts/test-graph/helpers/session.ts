import { setTestUserId } from "@/lib/api-helpers";

export function useTestUser(userId: string): void {
  setTestUserId(userId);
}

export function clearTestUser(): void {
  setTestUserId(null);
}

export function buildRequest(
  url: string,
  init?: { method?: string; body?: unknown }
): Request {
  const headers: Record<string, string> = {};
  if (init?.body) headers["content-type"] = "application/json";

  return new Request(`http://localhost:3000${url}`, {
    method: init?.method ?? "GET",
    headers,
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
}
