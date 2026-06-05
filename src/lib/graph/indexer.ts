import { prisma } from "@/lib/db";
import { extractFromChunks } from "./extractor";
import { buildGraph } from "./builder";
import { detectCommunities } from "./community";
import { generateCommunityReports } from "./reporter";

export interface ExtractAndUpsertResult {
  entities: number;
  relations: number;
  newEntityIds: string[];
}

export async function extractAndUpsertDocument(
  documentId: string,
  userId: string
): Promise<ExtractAndUpsertResult> {
  const doc = await prisma.knowledgeDocument.findUnique({
    where: { id: documentId, userId },
  });

  if (!doc) throw new Error(`Document ${documentId} not found`);
  if (doc.status !== "COMPLETED") {
    throw new Error(`Document ${documentId} is not COMPLETED (status=${doc.status})`);
  }

  await prisma.knowledgeDocument.update({
    where: { id: documentId },
    data: { graphIndexing: true, graphError: null },
  });

  try {
    const chunks = await prisma.knowledgeChunk.findMany({
      where: { documentId },
      orderBy: { chunkIndex: "asc" },
    });

    if (chunks.length === 0) {
      throw new Error("No chunks found for document");
    }

    const extraction = await extractFromChunks(chunks);
    const newEntityNames: string[] = [];

    const entityIdMap = new Map<string, string>();
    for (const entity of extraction.entities) {
      const existing = await prisma.graphEntity.findFirst({
        where: { userId, name: entity.name },
      });

      if (existing) {
        entityIdMap.set(entity.name, existing.id);
        await prisma.graphEntity.update({
          where: { id: existing.id },
          data: { description: entity.description, degree: { increment: 1 } },
        });
      } else {
        const created = await prisma.graphEntity.create({
          data: {
            userId,
            documentId,
            name: entity.name,
            type: entity.type,
            description: entity.description,
            degree: 1,
          },
        });
        entityIdMap.set(entity.name, created.id);
        newEntityNames.push(entity.name);
      }
    }

    let skippedRels = 0;
    for (const rel of extraction.relations) {
      const sourceId = entityIdMap.get(rel.sourceName);
      const targetId = entityIdMap.get(rel.targetName);
      if (!sourceId || !targetId) {
        skippedRels++;
        continue;
      }

      const existingRel = await prisma.graphRelationship.findFirst({
        where: {
          userId,
          sourceEntityId: sourceId,
          targetEntityId: targetId,
          type: rel.type,
        },
      });

      if (existingRel) {
        await prisma.graphRelationship.update({
          where: { id: existingRel.id },
          data: { weight: { increment: 0.5 } },
        });
      } else {
        await prisma.graphRelationship.create({
          data: {
            userId,
            sourceEntityId: sourceId,
            targetEntityId: targetId,
            type: rel.type,
            description: rel.description,
            weight: 1.0,
            sourceChunkId: chunks[0]?.id,
          },
        });
      }
    }

    if (skippedRels > 0) {
      console.warn(
        `[Graph Indexer] Skipped ${skippedRels} relations in document ${documentId} due to missing entity references`,
      );
    }

    await prisma.knowledgeDocument.update({
      where: { id: documentId },
      data: {
        graphIndexed: true,
        graphIndexing: false,
        graphIndexedAt: new Date(),
      },
    });

    const newEntityIds = newEntityNames.length > 0
      ? (
          await prisma.graphEntity.findMany({
            where: { userId, name: { in: newEntityNames } },
            select: { id: true },
          })
        ).map((e) => e.id)
      : [];

    return {
      entities: extraction.entities.length,
      relations: extraction.relations.length,
      newEntityIds,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    await prisma.knowledgeDocument.update({
      where: { id: documentId },
      data: {
        graphIndexing: false,
        graphError: errorMessage,
      },
    });
    console.error(`[Graph Indexer] Failed to index document ${documentId}:`, err);
    throw err;
  }
}

export interface RecomputeCommunitiesResult {
  communities: number;
  reportsGenerated: number;
  reportsFailed: number;
}

export async function recomputeCommunities(
  userId: string,
  options?: { onlyAffectedEntityIds?: string[]; debug?: boolean }
): Promise<RecomputeCommunitiesResult> {
  const graph = await buildGraph(userId);
  const { newCommunityIds } = await detectCommunities(graph, userId, options?.debug);

  const affectedEntityIds = options?.onlyAffectedEntityIds;
  let reportCommunityIds: string[] | undefined;

  if (affectedEntityIds && affectedEntityIds.length > 0) {
    const affectedEntities = await prisma.graphEntity.findMany({
      where: { id: { in: affectedEntityIds }, userId },
      select: { communityId: true },
    });
    reportCommunityIds = [
      ...new Set(
        affectedEntities.map((e) => e.communityId).filter(Boolean) as string[]
      ),
    ];
  }

  const reportResult = await generateCommunityReports(userId, {
    onlyForCommunityIds: reportCommunityIds,
    debug: options?.debug,
  });

  return {
    communities: newCommunityIds.length,
    reportsGenerated: reportResult.generated,
    reportsFailed: reportResult.failed,
  };
}
