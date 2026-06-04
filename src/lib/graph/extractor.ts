import { generateObject } from "ai";
import { chatModel } from "@/lib/ai/sensenova";
import { ENTITY_EXTRACTION_PROMPT } from "./prompts";
import { ExtractionSchema } from "./schemas";

export interface ExtractedEntity {
  name: string;
  type: string;
  description: string;
}

export interface ExtractedRelationship {
  sourceName: string;
  targetName: string;
  type: string;
  description?: string;
}

export interface ExtractionResult {
  entities: ExtractedEntity[];
  relationships: ExtractedRelationship[];
}

export async function extractFromChunks(
  chunks: Array<{ content: string; chunkIndex: number }>,
  debug?: boolean
): Promise<ExtractionResult> {
  const combinedText = chunks
    .map((c) => `[Chunk ${c.chunkIndex}]\n${c.content}`)
    .join("\n\n");

  if (debug) {
    console.log("[Graph Extractor] Input text length:", combinedText.length);
  }

  const result = await generateObject({
    model: chatModel,
    schema: ExtractionSchema,
    system: ENTITY_EXTRACTION_PROMPT,
    prompt: combinedText,
    maxOutputTokens: 8192,
  });

  if (debug) {
    console.log("[Graph Extractor] Raw LLM response:", JSON.stringify(result.object, null, 2));
  }

  return {
    entities: result.object.entities,
    relationships: result.object.relationships,
  };
}
