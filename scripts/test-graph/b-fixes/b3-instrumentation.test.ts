import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const INSTR_PATH = resolve("src/instrumentation.ts");

test("B3 fix: instrumentation.ts has try/catch around recoverOrphanIndexing", () => {
  const source = readFileSync(INSTR_PATH, "utf-8");

  const hasRecoverCall = /recoverOrphanIndexing\s*\(/.test(source);
  assert.ok(hasRecoverCall, "instrumentation.ts must call recoverOrphanIndexing()");

  const tryPattern = /try\s*\{[\s\S]*?recoverOrphanIndexing[\s\S]*?\}\s*catch/;
  assert.ok(
    tryPattern.test(source),
    "recoverOrphanIndexing must be wrapped in try/catch to isolate startup errors"
  );

  const hasConsoleError = /catch\s*\([^)]*\)\s*\{[\s\S]*?console\.error/.test(source);
  assert.ok(hasConsoleError, "catch block must log error via console.error");
});
