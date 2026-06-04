import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const CLEANUP_PATH = resolve("src/lib/graph/cleanup.ts");

test("T13: B1 fix - cleanup uses single updateMany for orphans", () => {
  const source = readFileSync(CLEANUP_PATH, "utf-8");

  const hasUpdateMany = /updateMany\s*\(\s*\{[\s\S]*?id:\s*\{\s*in:\s*orphanIds\s*\}/.test(
    source
  );
  assert.ok(hasUpdateMany, "cleanup.ts must use updateMany({id: {in: orphanIds}})");

  const loopPattern = /for\s*\([^)]*of\s+orphanDocs\)\s*\{[^}]*knowledgeDocument\.update\s*\(/;
  assert.ok(
    !loopPattern.test(source),
    "cleanup.ts must NOT have for-loop with individual .update() calls"
  );
});
