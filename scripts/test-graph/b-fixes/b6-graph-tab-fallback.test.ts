import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const GRAPH_TAB_PATH = resolve("src/components/knowledge/graph-tab.tsx");

test("B6 fix: GraphTab has loading skeleton + error + empty state branches", () => {
  const source = readFileSync(GRAPH_TAB_PATH, "utf-8");

  const hasSkeleton = /import\s*\{[^}]*Skeleton[^}]*\}\s*from/.test(source);
  assert.ok(hasSkeleton, "GraphTab must import Skeleton from ui");

  const hasLoadingBranch = /if\s*\(\s*loading\s*&&\s*!graphData\s*\)\s*\{[\s\S]*?Skeleton/.test(
    source
  );
  assert.ok(hasLoadingBranch, "Loading branch must render Skeleton components");

  const hasErrorBranch = /if\s*\(\s*error\s*\)\s*\{/.test(source);
  assert.ok(hasErrorBranch, "Error branch must exist with retry button");

  const hasEmptyBranch = /entityCount\s*===\s*0/.test(source);
  assert.ok(
    hasEmptyBranch,
    "Empty state branch must exist (check entityCount === 0) for the no-graph case"
  );

  const hasNetworkIcon = /NetworkIcon/.test(source);
  assert.ok(
    hasNetworkIcon,
    "Empty state should use NetworkIcon to clearly indicate 'no graph data' state"
  );
});
