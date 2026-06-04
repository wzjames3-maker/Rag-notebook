import { NextResponse } from "next/server";
import { z } from "zod";
import { streamText, createUIMessageStream, createUIMessageStreamResponse, stepCountIs } from "ai";
import type { Prisma } from "@/generated/prisma/client";
import { chatModel } from "@/lib/ai/sensenova";
import { prisma } from "@/lib/db";
import { getCurrentUserId, unauthorized } from "@/lib/api-helpers";
import { createAgentTools } from "@/lib/agent/tools";

export const maxDuration = 60;

const bodySchema = z.object({
  message: z.string().min(1).max(4000),
  sessionId: z.string().uuid().optional(),
});

const HISTORY_LIMIT = 20;

export async function POST(req: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return unauthorized();

  let body: z.infer<typeof bodySchema>;
  try {
    const raw = await req.json();
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", message: parsed.error.message },
        { status: 400 }
      );
    }
    body = parsed.data;
  } catch {
    return NextResponse.json(
      { error: "INVALID_JSON", message: "请求体格式错误" },
      { status: 400 }
    );
  }

  let sessionId = body.sessionId;
  if (sessionId) {
    const existing = await prisma.chatSession.findFirst({
      where: { id: sessionId, userId },
      select: { id: true },
    });
    if (!existing) sessionId = undefined;
  }
  if (!sessionId) {
    const created = await prisma.chatSession.create({
      data: { userId, title: body.message.substring(0, 50) },
    });
    sessionId = created.id;
  }

  const history = await prisma.chatMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
    take: HISTORY_LIMIT,
  });

  await prisma.chatMessage.create({
    data: { sessionId, role: "USER", content: body.message },
  });

  const graphEntityCount = await prisma.graphEntity.count({ where: { userId } });
  const hasGraph = graphEntityCount > 0;

  const tools = createAgentTools(userId);

  const result = streamText({
    model: chatModel,
    stopWhen: stepCountIs(5),
    system: buildSystemPrompt(hasGraph),
    messages: [
      ...history.map((m) => ({
        role: m.role.toLowerCase() as "user" | "assistant" | "system",
        content: m.content,
      })),
      { role: "user" as const, content: body.message },
    ],
    tools,
    onFinish: async ({ text, steps }) => {
      const toolCallRecords = steps.flatMap((step) =>
        (step.toolCalls ?? []).map((tc) => ({
          toolName: tc.toolName,
          args: tc.input,
        }))
      );

      await prisma.chatMessage.create({
        data: {
          sessionId,
          role: "ASSISTANT",
          content: text,
          toolCalls:
            toolCallRecords.length > 0
              ? (toolCallRecords as unknown as Prisma.InputJsonValue)
              : undefined,
        },
      });

      await prisma.chatSession.update({
        where: { id: sessionId },
        data: { updatedAt: new Date() },
      });
    },
  });

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      writer.merge(result.toUIMessageStream());
    },
  });

  const response = createUIMessageStreamResponse({ stream });
  const headers = new Headers(response.headers);
  headers.set("X-Session-Id", sessionId);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function buildSystemPrompt(hasGraph: boolean): string {
  const graphNote = hasGraph ? "" : "（注意：当前用户尚未构建知识图谱，graph 相关工具可能返回空结果）";

  return `你是一个智能知识助手，拥有多种检索和分析工具。请遵循以下工作原则：

## 工作流程（ReAct 模式）

1. **思考**：分析用户的问题，判断需要什么信息
2. **行动**：调用合适的工具获取信息
3. **观察**：评估工具返回的结果是否充分
4. **迭代**：如果信息不够，继续调用其他工具或调整查询
5. **回答**：综合所有获取到的信息，生成完整、准确的回答

## 工具使用策略

### 检索知识库文档时：
- 先使用 vector_search 进行语义搜索（这是最常用的检索方式）
- 如果涉及精确术语/名称/代码，同时使用 keyword_search
- 两个工具的结果互补，同时使用通常能获得更好的覆盖率

### 使用知识图谱时${graphNote}：
- 当问题涉及"XX和YY有什么关系"、"XX涉及哪些方面"时 → 使用 graph_explore
- 当需要确认某个概念/实体是否存在 → 使用 graph_search
- 当问题是全局性的（"主要讲了什么"、"有哪些主题"）→ 使用 community_summary
- 图谱工具可以揭示文档片段中看不到的隐含关系

### 搜索笔记时：
- 用户提到"我之前记过"、"我的笔记" → 使用 search_notes
- 用户要求记录信息 → 使用 create_note

## 回答规范

- 始终标注信息来源（来自哪个文档/哪个实体关系/哪个社区摘要）
- 如果所有工具都没有找到相关信息，诚实说明"知识库中没有找到相关信息"
- 回答要有条理，重要信息优先展示
- 使用 Markdown 格式组织回答`;
}
