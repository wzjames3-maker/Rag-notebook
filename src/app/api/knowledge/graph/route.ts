import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUserId, unauthorized } from "@/lib/api-helpers";
import { getCommunityColor } from "@/lib/graph/colors";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return unauthorized();

  const [entities, relationships, communities, communityReports] = await Promise.all([
    prisma.graphEntity.findMany({
      where: { userId },
      select: {
        id: true, name: true, type: true, description: true,
        degree: true, communityId: true,
      },
    }),
    prisma.graphRelationship.findMany({
      where: { userId },
      select: {
        id: true, sourceEntityId: true, targetEntityId: true,
        type: true, description: true, weight: true,
      },
    }),
    prisma.graphCommunity.findMany({
      where: { userId, level: 0 },
      select: { id: true },
    }),
    prisma.graphCommunityReport.findMany({
      where: { userId },
      select: { communityId: true, title: true, summary: true, rating: true },
    }),
  ]);

  const communityIds = communities.map((c) => c.id);
  const communityColorMap = Object.fromEntries(
    communityIds.map((id) => [id, getCommunityColor(id, communityIds)])
  );

  const communityInfoMap: Record<string, { title: string | null; summary: string | null; rating: number | null }> = {};
  for (const c of communityReports) {
    communityInfoMap[c.communityId] = {
      title: c.title,
      summary: c.summary,
      rating: c.rating,
    };
  }

  const entityTypeSet = new Set<string>();
  for (const e of entities) {
    if (e.type) entityTypeSet.add(e.type);
  }

  const entityColorMap: Record<string, string> = {};
  for (const e of entities) {
    entityColorMap[e.id] = communityColorMap[e.communityId ?? ""] ?? "#999";
  }

  return NextResponse.json({
    nodes: entities.map((e) => ({
      key: e.id,
      attributes: {
        label: e.name,
        entityType: e.type ?? "OTHER",
        type: e.type ?? "OTHER",
        description: e.description,
        degree: e.degree,
        communityId: e.communityId,
        size: Math.max(3, Math.min(20, (e.degree || 1) * 2)),
      },
    })),
    edges: relationships.map((r) => ({
      key: r.id,
      source: r.sourceEntityId,
      target: r.targetEntityId,
      attributes: {
        label: r.type ?? "RELATED_TO",
        description: r.description,
        weight: r.weight,
        sourceColor: entityColorMap[r.sourceEntityId] ?? "#999",
      },
    })),
    stats: {
      entityCount: entities.length,
      relationshipCount: relationships.length,
      communityCount: communities.length,
      entityTypes: [...entityTypeSet].sort(),
    },
    communityMap: communityInfoMap,
  });
}
