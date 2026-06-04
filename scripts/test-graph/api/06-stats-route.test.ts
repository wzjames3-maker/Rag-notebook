import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import { GET as statsGET } from "@/app/api/knowledge/graph/stats/route";
import { extractAndUpsertDocument, recomputeCommunities } from "@/lib/graph/indexer";
import { createTestUser, deleteTestUser, type TestUser } from "../helpers/test-user";
import { seedTestDoc, seedIndexedDoc } from "../helpers/test-data";
import { useTestUser, clearTestUser, buildRequest } from "../helpers/session";

type RouteGETFn = (req: Request) => Promise<Response>;
const callStatsGET = statsGET as unknown as RouteGETFn;

let testUser: TestUser;

const CHUNK = `React 是 Facebook 开发的 JavaScript 库，用于构建用户界面。
React 采用组件化开发模式和虚拟 DOM 提升性能。
React 由 Jordan Walke 创建，并于 2013 年开源。`;

before(async () => {
  testUser = await createTestUser("statsapi");
  useTestUser(testUser.id);
  const seed = await seedTestDoc(testUser.id, "react.txt", [CHUNK]);
  await extractAndUpsertDocument(seed.documentId, testUser.id);
  await recomputeCommunities(testUser.id);
  await seedIndexedDoc(testUser.id, "indexed-doc-1.txt", true);
  await seedIndexedDoc(testUser.id, "indexed-doc-2.txt", true);
  await seedIndexedDoc(testUser.id, "unindexed-doc.txt", false);
});

after(async () => {
  clearTestUser();
  if (testUser) await deleteTestUser(testUser.id);
});

test("T8.1: GET /api/knowledge/graph/stats returns 401 without auth", async () => {
  clearTestUser();
  try {
    const req = buildRequest("/api/knowledge/graph/stats");
    const res = await callStatsGET(req);
    assert.equal(res.status, 401);
  } finally {
    useTestUser(testUser.id);
  }
});

test("T8.2: GET /api/knowledge/graph/stats returns 200 with correct schema", async () => {
  const req = buildRequest("/api/knowledge/graph/stats");
  const res = await callStatsGET(req);
  assert.equal(res.status, 200);

  const body = await res.json();
  assert.ok(body.graph, "body.graph required");
  assert.equal(typeof body.graph.entities, "number");
  assert.equal(typeof body.graph.relationships, "number");
  assert.equal(typeof body.graph.communities, "number");
  assert.equal(typeof body.graph.reports, "number");

  assert.ok(body.documents, "body.documents required");
  assert.equal(typeof body.documents.indexed, "number");
  assert.equal(typeof body.documents.indexing, "number");
  assert.equal(typeof body.documents.total, "number");

  assert.ok(Array.isArray(body.communities), "body.communities must be array");
  assert.ok(Array.isArray(body.entityTypes), "body.entityTypes must be array");

  assert.ok(body.graph.entities >= 2, `Expected >= 2 entities, got ${body.graph.entities}`);
  assert.ok(body.graph.communities >= 1, `Expected >= 1 community, got ${body.graph.communities}`);
  assert.ok(body.documents.indexed >= 2, `Expected >= 2 indexed docs, got ${body.documents.indexed}`);
  assert.ok(
    body.entityTypes.length >= 1,
    `Expected >= 1 entity type, got ${body.entityTypes.length}`
  );
});
