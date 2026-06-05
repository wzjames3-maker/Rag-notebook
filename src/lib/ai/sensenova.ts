import { createOpenAI } from "@ai-sdk/openai";

/**
 * Custom fetch wrapper that replaces json_schema with json_object
 * for Sensenova compatibility. Also ensures "json" appears in messages
 * as required by the API when using json_object response format.
 */
function compatFetch(
  url: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  if (init?.body && typeof init.body === "string") {
    try {
      const body = JSON.parse(init.body);
      if (
        body.response_format?.type === "json_schema" &&
        body.response_format?.json_schema
      ) {
        // Replace json_schema with json_object
        body.response_format = { type: "json_object" };
        // Ensure "json" appears in messages as required by Sensenova
        const hasJson = body.messages?.some(
          (m: { content?: string; role?: string }) =>
            typeof m.content === "string" &&
            /json/i.test(m.content)
        );
        if (!hasJson && body.messages?.length > 0) {
          // Append JSON instruction to last message or system message
          const systemMsg = body.messages.find(
            (m: { role: string }) => m.role === "system"
          );
          if (systemMsg && typeof systemMsg.content === "string") {
            systemMsg.content += "\n\nOutput as JSON.";
          }
        }
        init.body = JSON.stringify(body);
      }
    } catch {
      // Not JSON body, pass through unchanged
    }
  }
  return fetch(url, init);
}

export const sensenova = createOpenAI({
  baseURL: process.env.SENSENOVA_BASE_URL!,
  apiKey: process.env.SENSENOVA_API_KEY!,
  fetch: compatFetch,
});

export const chatModel = sensenova.chat(
  process.env.SENSENOVA_CHAT_MODEL || "deepseek-v4-flash"
);
