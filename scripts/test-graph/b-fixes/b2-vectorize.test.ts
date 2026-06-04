import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const VECTORIZE_PATH = resolve("src/lib/rag/vectorize.ts");

test("B2 fix: vectorize.ts uses $transaction for createMany + executeRaw", () => {
  const source = readFileSync(VECTORIZE_PATH, "utf-8");

  const hasTransaction = /prisma\.\$transaction\s*\(\s*async\s*\(\s*tx\s*\)/.test(source);
  assert.ok(hasTransaction, "vectorize.ts must use prisma.$transaction with async tx callback");

  const createManyInside = /tx\.knowledgeChunk\.createMany/.test(source);
  const executeRawInside = /tx\.\$executeRaw/.test(source);
  assert.ok(createManyInside, "createMany must be inside transaction (tx.knowledgeChunk.createMany)");
  assert.ok(executeRawInside, "$executeRaw must be inside transaction (tx.$executeRaw)");
});
