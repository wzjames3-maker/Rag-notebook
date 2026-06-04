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
