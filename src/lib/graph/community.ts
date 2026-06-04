import Graph from "graphology";
import louvain from "graphology-communities-louvain";
import { prisma } from "@/lib/db";

export interface CommunityDetectionResult {
  dbCommunityMap: Map<string, string>;
  newCommunityIds: string[];
}

export async function detectCommunities(
  graph: Graph,
  userId: string,
  debug?: boolean
): Promise<CommunityDetectionResult> {
  if (graph.order === 0) {
    return { dbCommunityMap: new Map(), newCommunityIds: [] };
  }

  const nodeCommunityMap = louvain(graph, {
    getEdgeWeight: (edge) => (graph.getEdgeAttribute(edge, "weight") as number) ?? 1,
  });

  const communityGroups = new Map<string, string[]>();
  for (const [nodeId, commNumber] of Object.entries(nodeCommunityMap)) {
    const commKey = String(commNumber);
    if (!communityGroups.has(commKey)) {
      communityGroups.set(commKey, []);
    }
    communityGroups.get(commKey)!.push(nodeId);
  }

  if (debug) {
    console.log("[Graph Community] Detected", communityGroups.size, "communities");
  }

  await prisma.graphEntity.updateMany({
    where: { userId },
    data: { communityId: null },
  });
  await prisma.graphCommunity.deleteMany({ where: { userId } });

  const dbCommunityMap = new Map<string, string>();
  const newCommunityIds: string[] = [];

  for (const [commKey, nodeIds] of communityGroups) {
    const community = await prisma.graphCommunity.create({
      data: { userId, level: 0, size: nodeIds.length },
    });

    dbCommunityMap.set(commKey, community.id);
    newCommunityIds.push(community.id);

    await prisma.graphEntity.updateMany({
      where: { id: { in: nodeIds }, userId },
      data: { communityId: community.id },
    });
  }

  return { dbCommunityMap, newCommunityIds };
}
