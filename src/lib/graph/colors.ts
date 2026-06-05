const PALETTE = [
  "#4E79A7", "#F28E2B", "#E15759", "#76B7B2",
  "#59A14F", "#EDC948", "#B07AA1", "#FF9DA7",
  "#9C755F", "#BAB0AC", "#86BCB6", "#8CD17D",
];

export function getCommunityColor(communityId: string, allCommunityIds: string[]): string {
  const index = allCommunityIds.indexOf(communityId);
  if (index === -1) return "#999";
  return PALETTE[index % PALETTE.length];
}

export const ENTITY_COLORS: Record<string, string> = {
  PERSON: "#f59e0b",
  ORGANIZATION: "#6366f1",
  LOCATION: "#22c55e",
  CONCEPT: "#a855f7",
  TECHNOLOGY: "#ec4899",
  PRODUCT: "#ef4444",
  EVENT: "#0ea5e9",
  OTHER: "#94a3b8",
};

export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export const entityTypeIcons: Record<string, string> = {
  PERSON: "👤",
  ORGANIZATION: "🏢",
  LOCATION: "📍",
  CONCEPT: "💡",
  EVENT: "📅",
  TECHNOLOGY: "⚙️",
  PRODUCT: "📦",
  OTHER: "🔹",
};
