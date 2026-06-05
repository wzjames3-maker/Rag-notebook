import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@/lib/db";
import { extractAndUpsertDocument } from "@/lib/graph/indexer";
import { createTestUser, deleteTestUser, type TestUser } from "../helpers/test-user";
import { seedTestDoc } from "../helpers/test-data";

const TEST_CHUNKS = [
  `OpenAI 是一家美国人工智能研究实验室，成立于 2015 年，总部位于旧金山。
该组织由 Sam Altman 领导，专注于开发安全有益的人工通用智能（AGI）。
OpenAI 的旗舰产品是 GPT 系列大语言模型，广泛应用于对话、写作和编程辅助。`,
];

let testUser: TestUser;
let documentId: string;

before(async () => {
  testUser = await createTestUser("extract");
  const seed = await seedTestDoc(testUser.id, "openai-intro.txt", TEST_CHUNKS);
  documentId = seed.documentId;
});

after(async () => {
  if (testUser) await deleteTestUser(testUser.id);
});

test("T1.1: extractAndUpsertDocument creates entities and relationships", async () => {
  const result = await extractAndUpsertDocument(documentId, testUser.id);

  assert.ok(result.entities >= 2, `Expected >= 2 entities, got ${result.entities}`);
  assert.ok(
    result.relations >= 1,
    `Expected >= 1 relationship, got ${result.relations}`
  );
  assert.ok(Array.isArray(result.newEntityIds), "newEntityIds must be array");
  assert.ok(result.newEntityIds.length > 0, "Should have at least one new entity id");

  const entities = await prisma.graphEntity.findMany({ where: { userId: testUser.id } });
  assert.ok(entities.length >= 2, `DB should have >= 2 entities, got ${entities.length}`);

  const doc = await prisma.knowledgeDocument.findUnique({ where: { id: documentId } });
  assert.equal(doc?.graphIndexed, true, "doc.graphIndexed must be true");
  assert.equal(doc?.graphIndexing, false, "doc.graphIndexing must be false");
  assert.ok(doc?.graphIndexedAt, "doc.graphIndexedAt must be set");
  assert.equal(doc?.graphError, null, "doc.graphError must be null");
});

test("T1.2: relationships reference valid entities", async () => {
  const entities = await prisma.graphEntity.findMany({
    where: { userId: testUser.id },
    select: { id: true },
  });
  const entityIds = new Set(entities.map((e) => e.id));

  const rels = await prisma.graphRelationship.findMany({
    where: { userId: testUser.id },
  });
  assert.ok(rels.length >= 1, "Should have at least 1 relationship");
  for (const rel of rels) {
    assert.ok(entityIds.has(rel.sourceEntityId), `source ${rel.sourceEntityId} not in entities`);
    assert.ok(entityIds.has(rel.targetEntityId), `target ${rel.targetEntityId} not in entities`);
  }
});

test("T2.1: extractAndUpsertDocument throws for nonexistent docId", async () => {
  const fakeId = "00000000-0000-0000-0000-000000000000";
  await assert.rejects(
    () => extractAndUpsertDocument(fakeId, testUser.id),
    /not found|not COMPLETED/i
  );
});

test("T2.2: extractAndUpsertDocument throws for non-COMPLETED doc", async () => {
  const md5 = `pending-${Date.now()}`;
  const doc = await prisma.knowledgeDocument.create({
    data: {
      userId: testUser.id,
      filename: "pending.txt",
      mimeType: "text/plain",
      md5,
      status: "PROCESSING",
    },
  });

  await assert.rejects(
    () => extractAndUpsertDocument(doc.id, testUser.id),
    /not COMPLETED/i
  );

  await prisma.knowledgeDocument.delete({ where: { id: doc.id } });
});
