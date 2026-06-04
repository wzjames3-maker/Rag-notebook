/*
  Warnings:

  - You are about to drop the column `embedding` on the `KnowledgeChunk` table. All the data in the column will be lost.
  - You are about to drop the column `embedding` on the `Note` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ChatMessage" ADD COLUMN     "toolCalls" JSONB;

-- AlterTable
ALTER TABLE "KnowledgeChunk" DROP COLUMN "embedding";

-- AlterTable
ALTER TABLE "KnowledgeDocument" ADD COLUMN     "graphError" TEXT,
ADD COLUMN     "graphIndexed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "graphIndexedAt" TIMESTAMP(3),
ADD COLUMN     "graphIndexing" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Note" DROP COLUMN "embedding";

-- CreateTable
CREATE TABLE "GraphEntity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "documentId" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT,
    "description" TEXT NOT NULL,
    "degree" INTEGER NOT NULL DEFAULT 0,
    "communityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GraphEntity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GraphRelationship" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceEntityId" TEXT NOT NULL,
    "targetEntityId" TEXT NOT NULL,
    "type" TEXT,
    "description" TEXT,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "sourceChunkId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GraphRelationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GraphCommunity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "size" INTEGER NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GraphCommunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GraphCommunityReport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "keyFindings" TEXT[],
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GraphCommunityReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GraphEntity_userId_idx" ON "GraphEntity"("userId");

-- CreateIndex
CREATE INDEX "GraphEntity_userId_name_idx" ON "GraphEntity"("userId", "name");

-- CreateIndex
CREATE INDEX "GraphEntity_userId_type_idx" ON "GraphEntity"("userId", "type");

-- CreateIndex
CREATE INDEX "GraphEntity_userId_communityId_idx" ON "GraphEntity"("userId", "communityId");

-- CreateIndex
CREATE INDEX "GraphRelationship_userId_idx" ON "GraphRelationship"("userId");

-- CreateIndex
CREATE INDEX "GraphRelationship_sourceEntityId_idx" ON "GraphRelationship"("sourceEntityId");

-- CreateIndex
CREATE INDEX "GraphRelationship_targetEntityId_idx" ON "GraphRelationship"("targetEntityId");

-- CreateIndex
CREATE INDEX "GraphCommunity_userId_level_idx" ON "GraphCommunity"("userId", "level");

-- CreateIndex
CREATE UNIQUE INDEX "GraphCommunityReport_communityId_key" ON "GraphCommunityReport"("communityId");

-- CreateIndex
CREATE INDEX "GraphCommunityReport_userId_idx" ON "GraphCommunityReport"("userId");

-- AddForeignKey
ALTER TABLE "GraphEntity" ADD CONSTRAINT "GraphEntity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GraphEntity" ADD CONSTRAINT "GraphEntity_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "GraphCommunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GraphRelationship" ADD CONSTRAINT "GraphRelationship_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GraphRelationship" ADD CONSTRAINT "GraphRelationship_sourceEntityId_fkey" FOREIGN KEY ("sourceEntityId") REFERENCES "GraphEntity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GraphRelationship" ADD CONSTRAINT "GraphRelationship_targetEntityId_fkey" FOREIGN KEY ("targetEntityId") REFERENCES "GraphEntity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GraphCommunity" ADD CONSTRAINT "GraphCommunity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GraphCommunity" ADD CONSTRAINT "GraphCommunity_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "GraphCommunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GraphCommunityReport" ADD CONSTRAINT "GraphCommunityReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GraphCommunityReport" ADD CONSTRAINT "GraphCommunityReport_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "GraphCommunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
