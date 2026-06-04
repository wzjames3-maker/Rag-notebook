export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { recoverOrphanIndexing } = await import("./lib/graph/cleanup");
    try {
      const result = await recoverOrphanIndexing();
      if (result.orphanDocs > 0 || result.staleJobs > 0) {
        console.log(
          `[Instrumentation] Recovered ${result.orphanDocs} orphan docs, ${result.staleJobs} stale jobs`,
        );
      }
    } catch (err) {
      console.error("[Instrumentation] recoverOrphanIndexing failed:", err);
    }
  }
}
