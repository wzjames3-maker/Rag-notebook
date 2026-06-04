import { prisma } from "@/lib/db";

export type JobStatus = "running" | "completed" | "failed" | "interrupted";
export type JobScope = "incremental" | "rebuild";

export interface JobView {
  id: string;
  scope: JobScope;
  status: JobStatus;
  total: number;
  completed: number;
  failed: number;
  currentDoc: string | null;
  errorMsg: string | null;
  startedAt: string;
  finishedAt: string | null;
}

export interface CreateJobInput {
  userId: string;
  scope: JobScope;
  total: number;
}

function toView(
  job: {
    id: string;
    scope: string;
    status: string;
    total: number;
    completed: number;
    failed: number;
    currentDoc: string | null;
    errorMsg: string | null;
    startedAt: Date;
    finishedAt: Date | null;
  }
): JobView {
  return {
    id: job.id,
    scope: job.scope as JobScope,
    status: job.status as JobStatus,
    total: job.total,
    completed: job.completed,
    failed: job.failed,
    currentDoc: job.currentDoc,
    errorMsg: job.errorMsg,
    startedAt: job.startedAt.toISOString(),
    finishedAt: job.finishedAt ? job.finishedAt.toISOString() : null,
  };
}

export async function createJob(input: CreateJobInput): Promise<JobView> {
  const job = await prisma.graphBuildJob.create({
    data: {
      userId: input.userId,
      scope: input.scope,
      total: input.total,
      status: "running",
    },
  });
  return toView(job);
}

export async function getActiveJob(userId: string): Promise<JobView | null> {
  const job = await prisma.graphBuildJob.findFirst({
    where: { userId, status: "running" },
    orderBy: { startedAt: "desc" },
  });
  return job ? toView(job) : null;
}

export async function getLatestJob(userId: string): Promise<JobView | null> {
  const job = await prisma.graphBuildJob.findFirst({
    where: { userId },
    orderBy: { startedAt: "desc" },
  });
  return job ? toView(job) : null;
}

export async function advanceJob(
  jobId: string,
  currentDoc: string | null,
  failed: boolean
): Promise<void> {
  await prisma.graphBuildJob.update({
    where: { id: jobId },
    data: {
      completed: { increment: 1 },
      ...(failed ? { failed: { increment: 1 } } : {}),
      currentDoc,
    },
  });
}

export async function finishJob(
  jobId: string,
  status: "completed" | "failed",
  errorMsg?: string
): Promise<void> {
  await prisma.graphBuildJob.update({
    where: { id: jobId },
    data: {
      status,
      finishedAt: new Date(),
      currentDoc: null,
      ...(errorMsg ? { errorMsg } : {}),
    },
  });
}

const STALE_JOB_MINUTES = 10;

export async function interruptStaleJobs(): Promise<number> {
  const cutoff = new Date(Date.now() - STALE_JOB_MINUTES * 60_000);
  const stale = await prisma.graphBuildJob.findMany({
    where: { status: "running", startedAt: { lt: cutoff } },
    select: { id: true, userId: true },
  });
  for (const job of stale) {
    await prisma.graphBuildJob.update({
      where: { id: job.id },
      data: { status: "interrupted", finishedAt: new Date(), errorMsg: "进程中断" },
    });
    await prisma.knowledgeDocument.updateMany({
      where: { userId: job.userId, graphIndexing: true },
      data: { graphIndexing: false, graphError: "进程中断" },
    });
  }
  return stale.length;
}
