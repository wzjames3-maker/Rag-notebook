import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentUserId, unauthorized } from "@/lib/api-helpers";
import { extractAndUpsertDocument, recomputeCommunities } from "@/lib/graph/indexer";
import { createJob, getActiveJob, getLatestJob, advanceJob, finishJob } from "@/lib/graph/job-tracker";

const buildSchema = z.object({
  scope: z.enum(["incremental", "rebuild"]),
  documentIds: z.array(z.string().uuid()).optional(),
});

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return unauthorized();

  const active = await getActiveJob(userId);
  if (active) {
    return NextResponse.json({ job: active, status: "running" });
  }

  const latest = await getLatestJob(userId);
  if (!latest) {
    return NextResponse.json({ status: "no_job" });
  }
  return NextResponse.json({ job: latest, status: latest.status });
}

export async function POST(req: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return unauthorized();

  try {
    const raw = await req.json();
    const parsed = buildSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", message: parsed.error.message },
        { status: 400 }
      );
    }

    const { scope, documentIds } = parsed.data;

    const active = await getActiveJob(userId);
    if (active) {
      return NextResponse.json(
        { error: "IN_PROGRESS", message: "已有构建任务正在运行", job: active },
        { status: 409 }
      );
    }

    let docs;
    if (scope === "incremental") {
      if (!documentIds || documentIds.length === 0) {
        return NextResponse.json(
          { error: "VALIDATION_ERROR", message: "incremental 模式需要 documentIds" },
          { status: 400 }
        );
      }
      docs = await prisma.knowledgeDocument.findMany({
        where: {
          id: { in: documentIds },
          userId,
          status: "COMPLETED",
          graphIndexed: false,
          graphIndexing: false,
        },
        select: { id: true, filename: true },
      });
    } else {
      docs = await prisma.knowledgeDocument.findMany({
        where: { userId, status: "COMPLETED" },
        select: { id: true, filename: true },
      });
    }

    if (docs.length === 0) {
      return NextResponse.json(
        { status: "no_docs", message: "没有可构建图谱的文档" },
        { status: 200 }
      );
    }

    const job = await createJob({
      userId,
      scope,
      total: docs.length,
    });

    void (async () => {
      let affectedEntityIds: string[] = [];

      try {
        if (scope === "rebuild") {
          await prisma.$transaction([
            prisma.graphCommunityReport.deleteMany({ where: { userId } }),
            prisma.graphCommunity.deleteMany({ where: { userId } }),
            prisma.graphRelationship.deleteMany({ where: { userId } }),
            prisma.graphEntity.deleteMany({ where: { userId } }),
            prisma.knowledgeDocument.updateMany({
              where: { userId },
              data: {
                graphIndexed: false,
                graphIndexing: false,
                graphError: null,
                graphIndexedAt: null,
              },
            }),
          ]);
        }

        for (const doc of docs) {
          try {
            const result = await extractAndUpsertDocument(doc.id, userId);
            affectedEntityIds.push(...result.newEntityIds);
            await advanceJob(job.id, doc.filename, false);
          } catch (err) {
            console.error(`[Graph Build] Failed to index ${doc.id}:`, err);
            await advanceJob(job.id, doc.filename, true);
          }
        }

        if (affectedEntityIds.length > 0 || scope === "rebuild") {
          await recomputeCommunities(userId, {
            onlyAffectedEntityIds: scope === "incremental" ? affectedEntityIds : undefined,
          });
        }

        await finishJob(job.id, "completed");
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        console.error(`[Graph Build] Job ${job.id} failed:`, err);
        await finishJob(job.id, "failed", errorMsg);
      }
    })();

    return NextResponse.json({
      status: "processing",
      job,
      message: `已启动 ${docs.length} 个文档的图谱${scope === "rebuild" ? "重建" : "构建"}`,
    });
  } catch (err) {
    console.error("[Graph Build API] Error:", err);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "构建启动失败" },
      { status: 500 }
    );
  }
}
