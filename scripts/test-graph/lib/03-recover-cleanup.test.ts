import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@/lib/db";
import { recoverOrphanIndexing } from "@/lib/graph/cleanup";
import { interruptStaleJobs } from "@/lib/graph/job-tracker";
import { createTestUser, deleteTestUser, type TestUser } from "../helpers/test-user";
import { seedOrphanIndexingDoc, seedStaleJob } from "../helpers/test-data";

let orphanUser: TestUser;
let staleUser: TestUser;
let orphanDocId: string;
let staleJobId: string;

before(async () => {
  orphanUser = await createTestUser("orphan");
  staleUser = await createTestUser("stale");

  const orphan = await seedOrphanIndexingDoc(orphanUser.id, "orphan-doc.txt");
  orphanDocId = orphan.documentId;

  const stale = await seedStaleJob(staleUser.id, 15);
  staleJobId = stale.jobId;
});

after(async () => {
  if (orphanUser) await deleteTestUser(orphanUser.id);
  if (staleUser) await deleteTestUser(staleUser.id);
});

test("T5.1: recoverOrphanIndexing resets orphan doc for user without running job", async () => {
  const result = await recoverOrphanIndexing();

  assert.ok(result.orphanDocs >= 1, `Expected >= 1 orphanDoc, got ${result.orphanDocs}`);
  assert.ok(result.staleJobs >= 1, `Expected >= 1 staleJob, got ${result.staleJobs}`);

  const doc = await prisma.knowledgeDocument.findUnique({ where: { id: orphanDocId } });
  assert.equal(doc?.graphIndexing, false, "graphIndexing should be reset to false");
  assert.equal(doc?.graphError, "进程中断", "graphError should be set to '进程中断'");
});

test("T5.2: recoverOrphanIndexing marks stale jobs as interrupted", async () => {
  const job = await prisma.graphBuildJob.findUnique({ where: { id: staleJobId } });
  assert.equal(job?.status, "interrupted", "Stale job should be marked interrupted");
  assert.ok(job?.finishedAt, "finishedAt should be set");
  assert.equal(job?.errorMsg, "进程中断", "errorMsg should be '进程中断'");
});

test("T5.3: interruptStaleJobs returns count of interrupted jobs", async () => {
  const fresh = await seedStaleJob(staleUser.id, 15);
  const count = await interruptStaleJobs();
  assert.ok(count >= 1, `Expected >= 1 interrupted, got ${count}`);

  const job = await prisma.graphBuildJob.findUnique({ where: { id: fresh.jobId } });
  assert.equal(job?.status, "interrupted");
});
