import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const INDEXER_PATH = resolve("src/lib/graph/indexer.ts");

test("B4 fix: indexer logs warning for skipped relationships with missing entity refs", () => {
  const source = readFileSync(INDEXER_PATH, "utf-8");

  const hasSkippedCounter = /skippedRels\s*\+\+/.test(source);
  assert.ok(
    hasSkippedCounter,
    "indexer.ts must increment a skippedRels counter when entity refs are missing"
  );

  const hasWarn = /console\.warn\s*\(\s*[`'"][\s\S]*?Skip[\s\S]*?relations[\s\S]*?missing entity/i.test(
    source
  );
  assert.ok(
    hasWarn,
    "indexer.ts must call console.warn with a message about skipped relations and missing entities"
  );
});
