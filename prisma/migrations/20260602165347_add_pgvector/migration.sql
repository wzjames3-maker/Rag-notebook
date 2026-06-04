-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS "vector";

-- Add embedding column to Note (1536 dimensions for DashScope text-embedding-v3)
ALTER TABLE "Note" ADD COLUMN "embedding" vector(1536);

-- Add embedding column to KnowledgeChunk
ALTER TABLE "KnowledgeChunk" ADD COLUMN "embedding" vector(1536);
