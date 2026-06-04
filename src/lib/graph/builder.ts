import Graph from "graphology";
import { prisma } from "@/lib/db";

export async function buildGraph(userId: string): Promise<Graph> {
  const [entities, relationships] = await Promise.all([
    prisma.graphEntity.findMany({ where: { userId } }),
    prisma.graphRelationship.findMany({ where: { userId } }),
  ]);

  const graph = new Graph();

  for (const entity of entities) {
    graph.addNode(entity.id, {
      label: entity.name,
      type: entity.type ?? "OTHER",
      description: entity.description,
      degree: entity.degree,
      communityId: entity.communityId,
      size: Math.max(3, Math.min(20, (entity.degree || 1) * 2)),
    });
  }

  for (const rel of relationships) {
    if (!graph.hasNode(rel.sourceEntityId) || !graph.hasNode(rel.targetEntityId)) continue;
    try {
      graph.addEdgeWithKey(rel.id, rel.sourceEntityId, rel.targetEntityId, {
        label: rel.type ?? "RELATED_TO",
        weight: rel.weight,
      });
    } catch {
      // edge may already exist
    }
  }

  return graph;
}
