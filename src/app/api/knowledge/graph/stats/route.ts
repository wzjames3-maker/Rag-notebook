import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUserId, unauthorized } from "@/lib/api-helpers";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return unauthorized();

  const [
    entityCount,
    relationshipCount,
    communityCount,
    reportCount,
    indexedDocs,
    totalDocs,
    indexingDocs,
    communitiesRaw,
    entityTypesRaw,
  ] = await Promise.all([
    prisma.graphEntity.count({ where: { userId } }),
    prisma.graphRelationship.count({ where: { userId } }),
    prisma.graphCommunity.count({ where: { userId } }),
    prisma.graphCommunityReport.count({ where: { userId } }),
    prisma.knowledgeDocument.count({ where: { userId, graphIndexed: true } }),
    prisma.knowledgeDocument.count({ where: { userId, status: "COMPLETED" } }),
    prisma.knowledgeDocument.count({ where: { userId, graphIndexing: true } }),
    prisma.graphCommunity.findMany({
      where: { userId, level: 0 },
      select: { id: true, size: true },
    }),
    prisma.graphEntity.findMany({
      where: { userId },
      select: { type: true },
      distinct: ["type"],
    }),
  ]);

  const communityIds = communitiesRaw.map((c) => c.id);
  const reports = communityIds.length > 0
    ? await prisma.graphCommunityReport.findMany({
        where: { communityId: { in: communityIds } },
        select: { communityId: true, title: true, summary: true, rating: true },
      })
    : [];

  const reportMap = new Map(reports.map((r) => [r.communityId, r]));

  return NextResponse.json({
    graph: {
      entities: entityCount,
      relationships: relationshipCount,
      communities: communityCount,
      reports: reportCount,
    },
    documents: {
      indexed: indexedDocs,
      indexing: indexingDocs,
      total: totalDocs,
    },
    communities: communitiesRaw.map((c) => {
      const r = reportMap.get(c.id);
      return {
        id: c.id,
        size: c.size,
        title: r?.title ?? null,
        summary: r?.summary ?? null,
        rating: r?.rating ?? null,
      };
    }),
    entityTypes: entityTypesRaw
      .map((e) => e.type)
      .filter((t): t is string => !!t)
      .sort(),
  });
}
