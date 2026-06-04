import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@/lib/db";
import { POST as buildPOST, GET as buildGET } from "@/app/api/knowledge/graph/build/route";
import { getActiveJob } from "@/lib/graph/job-tracker";
import { createTestUser, deleteTestUser, type TestUser } from "../helpers/test-user";
import { seedTestDoc } from "../helpers/test-data";
import { useTestUser, clearTestUser, buildRequest } from "../helpers/session";

type RouteHandler = (req: Request) => Promise<Response>;
const callBuildPOST = buildPOST as unknown as RouteHandler;
const callBuildGET = buildGET as unknown as RouteHandler;

const CHUNK_A = `Docker 是一种容器化技术，由 Solomon Hykes 于 2013 年发布。
Docker 让应用程序及其依赖打包到轻量级容器中，可在任何环境一致运行。
Docker 使用 Linux 内核特性 cgroups 和 namespaces 实现隔离。`;

const CHUNK_B = `Kubernetes 是 Google 开源的容器编排系统，2014 年发布。
Kubernetes 自动化部署、扩展和管理容器化应用。
Kubernetes 已成为云原生时代的标准平台。`;

let testUser: TestUser;

before(async () => {
  testUser = await createTestUser("buildapi");
  useTestUser(testUser.id);

  await prisma.graphBuildJob.updateMany({
    where: { userId: testUser.id, status: "running" },
    data: { status: "interrupted", finishedAt: new Date() },
  });
  await prisma.knowledgeDocument.updateMany({
    where: { userId: testUser.id, graphIndexing: true },
    data: { graphIndexing: false },
  });
});

after(async () => {
  clearTestUser();
  if (testUser) await deleteTestUser(testUser.id);
});

async function waitForJobCompletion(userId: string, timeoutMs = 180_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const active = await getActiveJob(userId);
    if (!active) return;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Job did not complete within ${timeoutMs}ms`);
}

test("T9: POST /api/knowledge/graph/build (incremental) starts job and processes docs", async () => {
  const a = await seedTestDoc(testUser.id, "docker.txt", [CHUNK_A]);
  const b = await seedTestDoc(testUser.id, "k8s.txt", [CHUNK_B]);

  const req = buildRequest("/api/knowledge/graph/build", {
    method: "POST",
    body: { scope: "incremental", documentIds: [a.documentId, b.documentId] },
  });
  const res = await callBuildPOST(req);
  assert.equal(res.status, 200, `Expected 200, got ${res.status}`);

  const body = await res.json();
  assert.equal(body.status, "processing");
  assert.ok(body.job, "job should be returned");
  assert.equal(body.job.scope, "incremental");
  assert.equal(body.job.total, 2);

  await waitForJobCompletion(testUser.id, 90_000);

  const finalJob = await prisma.graphBuildJob.findUnique({ where: { id: body.job.id } });
  assert.equal(finalJob?.status, "completed", `Job should be completed, got ${finalJob?.status}`);
  assert.equal(finalJob?.completed, 2);

  const entityCount = await prisma.graphEntity.count({ where: { userId: testUser.id } });
  assert.ok(entityCount >= 2, `Expected >= 2 entities, got ${entityCount}`);
});

test("T10: POST /api/knowledge/graph/build (rebuild) wipes and recreates graph", async () => {
  const beforeEntities = await prisma.graphEntity.count({ where: { userId: testUser.id } });
  const beforeCommunityIds = (
    await prisma.graphCommunity.findMany({
      where: { userId: testUser.id },
      select: { id: true },
    })
  ).map((c) => c.id);
  assert.ok(beforeEntities > 0, "Prerequisite: entities must exist from T9");
  assert.ok(beforeCommunityIds.length > 0, "Prerequisite: communities must exist from T9");

  await seedTestDoc(testUser.id, "extra1.txt", [CHUNK_A]);
  await seedTestDoc(testUser.id, "extra2.txt", [CHUNK_B]);

  const req = buildRequest("/api/knowledge/graph/build", {
    method: "POST",
    body: { scope: "rebuild" },
  });
  const res = await callBuildPOST(req);
  assert.equal(res.status, 200);

  const body = await res.json();
  assert.equal(body.job.scope, "rebuild");

  await waitForJobCompletion(testUser.id, 120_000);

  const oldCommunitiesStill = await prisma.graphCommunity.findMany({
    where: { id: { in: beforeCommunityIds }, userId: testUser.id },
  });
  assert.equal(
    oldCommunitiesStill.length,
    0,
    `Old community IDs should be wiped, but ${oldCommunitiesStill.length} still exist`
  );

  const newCommunities = await prisma.graphCommunity.findMany({
    where: { userId: testUser.id },
  });
  assert.ok(newCommunities.length >= 1, "New communities should exist after rebuild");
  const allNewIds = new Set(newCommunities.map((c) => c.id));
  for (const oldId of beforeCommunityIds) {
    assert.ok(
      !allNewIds.has(oldId),
      `Old community ${oldId} should not appear in new communities`
    );
  }

  const remainingEntities = await prisma.graphEntity.count({
    where: { userId: testUser.id },
  });
  assert.ok(
    remainingEntities > 0,
    "Entities should be recreated after rebuild (wipe + re-extract)"
  );
});

test("T11: POST /api/knowledge/graph/build (409) rejects concurrent builds", async () => {
  await seedTestDoc(testUser.id, "conflict-a.txt", [CHUNK_A]);
  await seedTestDoc(testUser.id, "conflict-b.txt", [CHUNK_B]);
  await seedTestDoc(testUser.id, "conflict-c.txt", [CHUNK_A]);
  await seedTestDoc(testUser.id, "conflict-d.txt", [CHUNK_B]);

  const allDocs = await prisma.knowledgeDocument.findMany({
    where: { userId: testUser.id, status: "COMPLETED", graphIndexed: false, graphIndexing: false },
    select: { id: true },
  });
  const docIds = allDocs.map((d) => d.id);

  const first = buildRequest("/api/knowledge/graph/build", {
    method: "POST",
    body: { scope: "incremental", documentIds: docIds },
  });
  const firstRes = await callBuildPOST(first);
  assert.equal(firstRes.status, 200, "First build should start");

  const second = buildRequest("/api/knowledge/graph/build", {
    method: "POST",
    body: { scope: "incremental", documentIds: docIds },
  });
  const secondRes = await callBuildPOST(second);
  assert.equal(secondRes.status, 409, `Expected 409, got ${secondRes.status}`);

  const secondBody = await secondRes.json();
  assert.equal(secondBody.error, "IN_PROGRESS");

  await waitForJobCompletion(testUser.id, 120_000);
});

test("T12.1: GET /api/knowledge/graph/build returns no_job when none exists", async () => {
  await prisma.graphBuildJob.updateMany({
    where: { userId: testUser.id, status: "running" },
    data: { status: "interrupted", finishedAt: new Date() },
  });

  const req = buildRequest("/api/knowledge/graph/build");
  const res = await callBuildGET(req);
  assert.equal(res.status, 200);

  const body = await res.json();
  assert.ok(body.job, "Should return latest completed job");
  assert.notEqual(body.status, "running");
});

test("T12.2: GET /api/knowledge/graph/build returns running job when active", async () => {
  await prisma.graphBuildJob.updateMany({
    where: { userId: testUser.id, status: "running" },
    data: { status: "interrupted", finishedAt: new Date() },
  });

  await seedTestDoc(testUser.id, "poll-test-1.txt", [CHUNK_A]);
  await seedTestDoc(testUser.id, "poll-test-2.txt", [CHUNK_B]);

  const allDocs = await prisma.knowledgeDocument.findMany({
    where: { userId: testUser.id, status: "COMPLETED", graphIndexed: false, graphIndexing: false },
    select: { id: true },
  });

  const startReq = buildRequest("/api/knowledge/graph/build", {
    method: "POST",
    body: { scope: "incremental", documentIds: allDocs.map((d) => d.id) },
  });
  await callBuildPOST(startReq);

  await new Promise((r) => setTimeout(r, 200));

  const pollReq = buildRequest("/api/knowledge/graph/build");
  const pollRes = await callBuildGET(pollReq);
  const body = await pollRes.json();
  assert.equal(body.status, "running", "Should detect running job");

  await waitForJobCompletion(testUser.id, 90_000);
});
