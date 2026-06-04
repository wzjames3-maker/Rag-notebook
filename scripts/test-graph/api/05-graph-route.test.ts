import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import { GET as graphGET } from "@/app/api/knowledge/graph/route";
import { extractAndUpsertDocument, recomputeCommunities } from "@/lib/graph/indexer";
import { createTestUser, deleteTestUser, type TestUser } from "../helpers/test-user";
import { seedTestDoc } from "../helpers/test-data";
import { useTestUser, clearTestUser, buildRequest } from "../helpers/session";

type GraphGETFn = (req: Request) => Promise<Response>;
const callGraphGET = graphGET as unknown as GraphGETFn;

let testUser: TestUser;

const CHUNK = `Tokyo 是日本的首都，位于本州岛东部，是全球最大的都市圈之一。
Tokyo 拥有约 1400 万人口，GDP 超过 1 万亿美元。
Tokyo Tower 建于 1958 年，是东京的标志性建筑之一。`;

before(async () => {
  testUser = await createTestUser("graphapi");
  useTestUser(testUser.id);
  const seed = await seedTestDoc(testUser.id, "tokyo.txt", [CHUNK]);
  await extractAndUpsertDocument(seed.documentId, testUser.id);
  await recomputeCommunities(testUser.id);
});

after(async () => {
  clearTestUser();
  if (testUser) await deleteTestUser(testUser.id);
});

test("T7.1: GET /api/knowledge/graph returns 401 without auth", async () => {
  clearTestUser();
  try {
    const req = buildRequest("/api/knowledge/graph");
    const res = await callGraphGET(req);
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.error, "UNAUTHORIZED");
  } finally {
    useTestUser(testUser.id);
  }
});

test("T7.2: GET /api/knowledge/graph returns 200 with auth and correct schema", async () => {
  const req = buildRequest("/api/knowledge/graph");
  const res = await callGraphGET(req);
  assert.equal(res.status, 200);

  const body = await res.json();
  assert.ok(Array.isArray(body.nodes), "body.nodes must be array");
  assert.ok(Array.isArray(body.edges), "body.edges must be array");
  assert.ok(body.stats, "body.stats must exist");
  assert.equal(typeof body.stats.entityCount, "number");
  assert.equal(typeof body.stats.relationshipCount, "number");
  assert.equal(typeof body.stats.communityCount, "number");
  assert.ok(Array.isArray(body.stats.entityTypes), "entityTypes must be array");
  assert.ok(typeof body.communityMap === "object", "communityMap must be object");

  assert.ok(body.nodes.length >= 2, `Expected >= 2 nodes, got ${body.nodes.length}`);

  const sampleNode = body.nodes[0];
  assert.ok(sampleNode.key, "Node must have key");
  assert.ok(sampleNode.attributes, "Node must have attributes");
  assert.ok(sampleNode.attributes.label, "Node label required");
  assert.ok(sampleNode.attributes.color, "Node color required");
});
