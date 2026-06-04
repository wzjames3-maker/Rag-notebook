ALTER TABLE "Note" ALTER COLUMN "embedding" TYPE vector(1024);
ALTER TABLE "KnowledgeChunk" ALTER COLUMN "embedding" TYPE vector(1024);
ALTER TABLE "GraphEntity" ALTER COLUMN "embedding" TYPE vector(1024);
ALTER TABLE "GraphCommunityReport" ALTER COLUMN "embedding" TYPE vector(1024);
