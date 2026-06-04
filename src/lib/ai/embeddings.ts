import { embed, embedMany } from "ai";
import { siliconflow } from "./siliconflow";

const EMBEDDING_MODEL = process.env.SILICONFLOW_EMBEDDING_MODEL || "BAAI/bge-m3";
export const EMBEDDING_DIM = 1024;

const embeddingModel = siliconflow.embedding(EMBEDDING_MODEL);

export async function embedText(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: embeddingModel,
    value: text,
  });
  return embedding;
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  const BATCH_SIZE = 25;
  const results: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const { embeddings } = await embedMany({
      model: embeddingModel,
      values: batch,
    });
    results.push(...embeddings);
  }
  return results;
}
