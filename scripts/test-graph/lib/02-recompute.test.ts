import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@/lib/db";
import { extractAndUpsertDocument, recomputeCommunities } from "@/lib/graph/indexer";
import { createTestUser, deleteTestUser, type TestUser } from "../helpers/test-user";
import { seedTestDoc } from "../helpers/test-data";

let testUser: TestUser;
let docA: string;
let docB: string;

const CHUNK_A = `Python 是一种高级编程语言，由 Guido van Rossum 于 1991 年发布。
Python 强调代码可读性，使用缩进定义代码块。Python 广泛用于数据科学、机器学习和 Web 开发。`;

const CHUNK_B = `JavaScript 是一种脚本语言，主要用于 Web 前端开发。
JavaScript 由 Brendan Eich 在 1995 年创建，现已扩展到服务器端（Node.js）。
React 和 Vue 是流行的 JavaScript 框架。`;

before(async () => {
  testUser = await createTestUser("recompute");
  const a = await seedTestDoc(testUser.id, "python.txt", [CHUNK_A]);
  const b = await seedTestDoc(testUser.id, "javascript.txt", [CHUNK_B]);
  docA = a.documentId;
  docB = b.documentId;

  await extractAndUpsertDocument(docA, testUser.id);
  await extractAndUpsertDocument(docB, testUser.id);
});

after(async () => {
  if (testUser) await deleteTestUser(testUser.id);
});

test("T3: recomputeCommunities incremental creates communities", async () => {
  const beforeEntities = await prisma.graphEntity.count({ where: { userId: testUser.id } });
  const beforeCommunities = await prisma.graphCommunity.count({ where: { userId: testUser.id } });
  assert.ok(beforeEntities > 0, "Prerequisite: entities must exist");
  assert.equal(beforeCommunities, 0, "Communities should be empty before recompute");

  const newEntityIds = (
    await prisma.graphEntity.findMany({
      where: { userId: testUser.id },
      select: { id: true },
    })
  ).map((e) => e.id);

  const result = await recomputeCommunities(testUser.id, {
    onlyAffectedEntityIds: newEntityIds,
  });

  assert.ok(result.communities >= 1, `Expected >= 1 community, got ${result.communities}`);

  const afterCommunities = await prisma.graphCommunity.findMany({
    where: { userId: testUser.id },
  });
  assert.equal(afterCommunities.length, result.communities, "Community count mismatch");

  const allEntities = await prisma.graphEntity.findMany({
    where: { userId: testUser.id },
  });
  const withCommunity = allEntities.filter((e) => e.communityId !== null);
  assert.ok(withCommunity.length > 0, "At least one entity should be assigned to a community");

  const withReport = await prisma.graphCommunityReport.count({
    where: { userId: testUser.id },
  });
  assert.ok(
    withReport >= 1,
    `At least one report expected, got ${withReport} (reporter may have failed silently)`
  );
});

test("T4: recomputeCommunities full rebuild wipes and recreates", async () => {
  const beforeEntities = await prisma.graphEntity.findMany({
    where: { userId: testUser.id },
    select: { id: true, communityId: true },
  });
  assert.ok(beforeEntities.length > 0, "Prerequisite: entities must exist");
  const oldCommunityIds = new Set(
    beforeEntities.map((e) => e.communityId).filter((id): id is string => !!id)
  );
  assert.ok(oldCommunityIds.size > 0, "Prerequisite: communities must exist");

  const result = await recomputeCommunities(testUser.id);
  assert.ok(result.communities >= 1, "Rebuild should create at least 1 community");

  const oldCommunities = await prisma.graphCommunity.findMany({
    where: { id: { in: Array.from(oldCommunityIds) }, userId: testUser.id },
  });
  assert.equal(oldCommunities.length, 0, "Old communities should be wiped");

  const remainingEntities = await prisma.graphEntity.count({
    where: { userId: testUser.id },
  });
  assert.equal(
    remainingEntities,
    beforeEntities.length,
    "Entity count should be preserved after rebuild"
  );
});
