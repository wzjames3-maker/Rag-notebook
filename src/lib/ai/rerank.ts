import { generateObject } from "ai";
import { z } from "zod";
import { chatModel } from "./sensenova";

export interface RerankChunk {
  id: string;
  content: string;
  score: number;
}

export async function rerank(
  query: string,
  chunks: RerankChunk[],
  topK = 5
): Promise<RerankChunk[]> {
  if (chunks.length === 0) return [];

  const { object } = await generateObject({
    model: chatModel,
    schema: z.object({
      rankedIds: z.array(z.string()),
    }),
    prompt: `Given the query: "${query}"

Rank the following document chunks by relevance (most relevant first).
Return the IDs of the top ${topK} most relevant chunks, ordered from most to least relevant.

${chunks.map((c) => `[ID: ${c.id}] ${c.content.substring(0, 200)}`).join("\n")}

Respond with JSON only.`,
  });

  return object.rankedIds
    .map((id) => chunks.find((c) => c.id === id))
    .filter((c): c is RerankChunk => c !== undefined)
    .slice(0, topK);
}
