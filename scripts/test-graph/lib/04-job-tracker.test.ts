import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@/lib/db";
import {
  createJob,
  advanceJob,
  finishJob,
  getActiveJob,
  getLatestJob,
} from "@/lib/graph/job-tracker";
import { createTestUser, deleteTestUser, type TestUser } from "../helpers/test-user";

let testUser: TestUser;

before(async () => {
  testUser = await createTestUser("jobtracker");
});

after(async () => {
  if (testUser) await deleteTestUser(testUser.id);
});

test("T6.1: createJob initializes running job", async () => {
  const job = await createJob({ userId: testUser.id, scope: "incremental", total: 3 });
  assert.equal(job.status, "running");
  assert.equal(job.scope, "incremental");
  assert.equal(job.total, 3);
  assert.equal(job.completed, 0);
  assert.equal(job.failed, 0);
  assert.ok(job.id, "Job id should be present");
  assert.ok(job.startedAt, "startedAt should be ISO string");
  assert.equal(job.finishedAt, null);
});

test("T6.2: advanceJob increments completed counter", async () => {
  const job = await createJob({ userId: testUser.id, scope: "incremental", total: 5 });
  await advanceJob(job.id, "doc-1.txt", false);
  await advanceJob(job.id, "doc-2.txt", true);
  await advanceJob(job.id, "doc-3.txt", false);

  const updated = await getActiveJob(testUser.id);
  const target = updated?.id === job.id ? updated : await getLatestJob(testUser.id);
  assert.ok(target, "Job should be queryable");
  assert.equal(target?.completed, 3);
  assert.equal(target?.failed, 1);
  assert.equal(target?.currentDoc, "doc-3.txt");
});

test("T6.3: finishJob marks job as completed", async () => {
  const job = await createJob({ userId: testUser.id, scope: "incremental", total: 1 });
  await finishJob(job.id, "completed");

  const latest = await getLatestJob(testUser.id);
  const target = latest?.id === job.id ? latest : null;
  assert.equal(target?.status, "completed");
  assert.ok(target?.finishedAt, "finishedAt should be set");
});

test("T6.4: finishJob can mark job as failed with errorMsg", async () => {
  const job = await createJob({ userId: testUser.id, scope: "rebuild", total: 1 });
  await finishJob(job.id, "failed", "Test failure");

  const stored = await prisma.graphBuildJob.findUnique({ where: { id: job.id } });
  assert.equal(stored?.status, "failed");
  assert.equal(stored?.errorMsg, "Test failure");
  assert.ok(stored?.finishedAt);
});

test("T6.5: getActiveJob returns null when no running job", async () => {
  await prisma.graphBuildJob.updateMany({
    where: { userId: testUser.id, status: "running" },
    data: { status: "interrupted", finishedAt: new Date() },
  });
  const active = await getActiveJob(testUser.id);
  assert.equal(active, null, "Should return null when no running job");
});
