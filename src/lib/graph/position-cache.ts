const POSITION_STORAGE_PREFIX = "graph-pos-";

export function getPositionCache(userKey: string): Record<string, { x: number; y: number }> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(POSITION_STORAGE_PREFIX + userKey);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function savePositionCache(userKey: string, positions: Record<string, { x: number; y: number }>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(POSITION_STORAGE_PREFIX + userKey, JSON.stringify(positions));
  } catch {
  }
}
