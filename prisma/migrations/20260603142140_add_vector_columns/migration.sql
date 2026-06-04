-- AlterTable
ALTER TABLE "GraphCommunityReport" ADD COLUMN     "embedding" vector(1536);

-- AlterTable
ALTER TABLE "GraphEntity" ADD COLUMN     "embedding" vector(1536);

-- AlterTable
ALTER TABLE "KnowledgeChunk" ADD COLUMN     "embedding" vector(1536);
