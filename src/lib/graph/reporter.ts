import { generateObject } from "ai";
import { chatModel } from "@/lib/ai/sensenova";
import { embedText } from "@/lib/ai/embeddings";
import { prisma } from "@/lib/db";
import { COMMUNITY_SUMMARY_PROMPT } from "./prompts";
import { CommunitySummarySchema } from "./schemas";

function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

export interface GenerateReportsResult {
  generated: number;
  failed: number;
}

export async function generateCommunityReports(
  userId: string,
  options?: { onlyForCommunityIds?: string[]; debug?: boolean }
): Promise<GenerateReportsResult> {
  const communityIds = options?.onlyForCommunityIds;
  const debug = options?.debug ?? false;

  const communities = await prisma.graphCommunity.findMany({
    where: {
      userId,
      ...(communityIds && communityIds.length > 0 ? { id: { in: communityIds } } : {}),
    },
    include: {
      entities: { select: { name: true, type: true, description: true } },
    },
  });

  let generated = 0;
  let failed = 0;

  for (const community of communities) {
    if (community.entities.length === 0) continue;

    const entityDescriptions = community.entities
      .map((e) => `- ${e.name} (${e.type ?? "OTHER"}): ${e.description}`)
      .join("\n");

    if (debug) {
      console.log(`[Graph Reporter] Generating report for community ${community.id} with ${community.entities.length} entities`);
    }

    try {
      const result = await generateObject({
        model: chatModel,
        schema: CommunitySummarySchema,
        system: COMMUNITY_SUMMARY_PROMPT,
        prompt: entityDescriptions,
        maxOutputTokens: 8192,
        maxRetries: 2,
        timeout: 120_000,
      });

      if (debug) {
        console.log(`[Graph Reporter] Community ${community.id} report:`, JSON.stringify(result.object, null, 2));
      }

      const { title, summary, keyFindings, rating } = result.object;
      const summaryEmbedding = await embedText(summary);

      await prisma.graphCommunityReport.upsert({
        where: { communityId: community.id },
        create: {
          userId,
          communityId: community.id,
          title,
          summary,
          keyFindings,
          rating,
        },
        update: {
          title,
          summary,
          keyFindings,
          rating,
        },
      });

      await prisma.$executeRawUnsafe(
        `UPDATE "GraphCommunityReport" SET embedding = $1::vector WHERE "communityId" = $2`,
        toVectorLiteral(summaryEmbedding),
        community.id
      );

      generated++;
    } catch (err) {
      console.error(`[Graph Reporter] Failed to generate report for community ${community.id}:`, err);
      failed++;
    }
  }

  return { generated, failed };
}
