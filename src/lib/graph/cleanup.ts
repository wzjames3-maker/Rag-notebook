import { prisma } from "@/lib/db";
import { interruptStaleJobs } from "./job-tracker";

export async function recoverOrphanIndexing(): Promise<{
  orphanDocs: number;
  staleJobs: number;
}> {
  const orphanDocs = await prisma.knowledgeDocument.findMany({
    where: { graphIndexing: true },
    select: { id: true, userId: true },
  });

  const runningJobs = await prisma.graphBuildJob.findMany({
    where: { status: "running" },
    select: { userId: true },
    distinct: ["userId"],
  });
  const usersWithRunningJob = new Set(runningJobs.map((j) => j.userId));

  const orphanIds = orphanDocs
    .filter((doc) => !usersWithRunningJob.has(doc.userId))
    .map((doc) => doc.id);

  if (orphanIds.length > 0) {
    await prisma.knowledgeDocument.updateMany({
      where: { id: { in: orphanIds } },
      data: { graphIndexing: false, graphError: "进程中断" },
    });
  }

  const staleJobs = await interruptStaleJobs();
  return { orphanDocs: orphanIds.length, staleJobs };
}
