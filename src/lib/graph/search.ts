import { prisma } from "@/lib/db";

export interface GraphExploreResult {
  found: boolean;
  entity?: {
    name: string;
    type: string;
    description: string;
  };
  relations: Array<{
    hop: number;
    source: string;
    sourceType: string;
    relation: string;
    target: string;
    targetType: string;
    description: string | null;
    weight: number;
  }>;
  totalRelations: number;
  message?: string;
}

export async function graphExplore(
  entityName: string,
  userId: string,
  hops: number,
  relationFilter?: string
): Promise<GraphExploreResult> {
  const entity = await prisma.graphEntity.findFirst({
    where: { userId, name: { contains: entityName, mode: "insensitive" } },
  });

  if (!entity) {
    return { found: false, message: `未找到实体 "${entityName}"`, relations: [], totalRelations: 0 };
  }

  const visited = new Set<string>([entity.id]);
  const allRelations: GraphExploreResult["relations"] = [];

  let currentEntityIds = [entity.id];

  for (let hop = 0; hop < hops; hop++) {
    const rels = await prisma.graphRelationship.findMany({
      where: {
        userId,
        OR: [
          { sourceEntityId: { in: currentEntityIds } },
          { targetEntityId: { in: currentEntityIds } },
        ],
        ...(relationFilter ? { type: relationFilter } : {}),
      },
      include: { sourceEntity: true, targetEntity: true },
      orderBy: { weight: "desc" },
    });

    const nextEntityIds: string[] = [];
    for (const rel of rels) {
      allRelations.push({
        hop: hop + 1,
        source: rel.sourceEntity.name,
        sourceType: rel.sourceEntity.type ?? "OTHER",
        relation: rel.type ?? "RELATED_TO",
        target: rel.targetEntity.name,
        targetType: rel.targetEntity.type ?? "OTHER",
        description: rel.description,
        weight: rel.weight,
      });

      const otherId = currentEntityIds.includes(rel.sourceEntityId)
        ? rel.targetEntityId
        : rel.sourceEntityId;

      if (!visited.has(otherId)) {
        visited.add(otherId);
        nextEntityIds.push(otherId);
      }
    }
    currentEntityIds = nextEntityIds;
    if (currentEntityIds.length === 0) break;
  }

  return {
    found: true,
    entity: {
      name: entity.name,
      type: entity.type ?? "OTHER",
      description: entity.description,
    },
    relations: allRelations,
    totalRelations: allRelations.length,
  };
}
