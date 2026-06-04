-- CreateTable
CREATE TABLE "GraphBuildJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "total" INTEGER NOT NULL,
    "completed" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "currentDoc" TEXT,
    "errorMsg" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "GraphBuildJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GraphBuildJob_userId_status_idx" ON "GraphBuildJob"("userId", "status");

-- CreateIndex
CREATE INDEX "GraphBuildJob_userId_startedAt_idx" ON "GraphBuildJob"("userId", "startedAt");

-- AddForeignKey
ALTER TABLE "GraphBuildJob" ADD CONSTRAINT "GraphBuildJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
