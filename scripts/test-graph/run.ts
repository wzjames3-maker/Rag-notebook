import { run } from "node:test";
import { spec } from "node:test/reporters";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { verifyDatabaseConnection, verifyGraphBuildJobTable } from "./_setup";
import { cleanupAllTestData } from "./_teardown";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TEST_DIR = __dirname;

const TEST_FILES = [
  "b-fixes/b1-cleanup.test.ts",
  "b-fixes/b2-vectorize.test.ts",
  "b-fixes/b3-instrumentation.test.ts",
  "b-fixes/b4-indexer-warn.test.ts",
  "b-fixes/b5-banner-toast.test.ts",
  "b-fixes/b6-graph-tab-fallback.test.ts",
  "lib/01-extract-and-upsert.test.ts",
  "lib/02-recompute.test.ts",
  "lib/03-recover-cleanup.test.ts",
  "lib/04-job-tracker.test.ts",
  "api/05-graph-route.test.ts",
  "api/06-stats-route.test.ts",
  "api/07-build-route.test.ts",
];

async function main() {
  console.log("\n" + "=".repeat(60));
  console.log("  LangChain-RAG Graph Module Test Suite");
  console.log("=".repeat(60) + "\n");

  console.log("[1/3] Pre-flight checks...");
  await verifyDatabaseConnection();
  await verifyGraphBuildJobTable();
  console.log("");

  const startTime = Date.now();
  const testPaths = TEST_FILES.map((f) => resolve(TEST_DIR, f));

  console.log(`[2/3] Running ${TEST_FILES.length} test files...\n`);

  const stream = run({
    files: testPaths,
    concurrency: 1,
    timeout: 180_000,
  });

  await new Promise<void>((resolveDone, reject) => {
    stream.compose(new spec()).pipe(process.stdout);
    stream.on("end", () => resolveDone());
    stream.on("error", reject);
  });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n[3/3] Cleanup (elapsed: ${elapsed}s)...`);
  await cleanupAllTestData();

  console.log("\n" + "=".repeat(60));
  console.log(`  Done. Total: ${elapsed}s`);
  console.log("=".repeat(60) + "\n");
}

main().catch(async (err) => {
  console.error("\nFATAL:", err);
  try {
    await cleanupAllTestData();
  } catch {}
  process.exit(1);
});
