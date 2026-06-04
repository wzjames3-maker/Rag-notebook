import { createOpenAI } from "@ai-sdk/openai";

export const dashscope = createOpenAI({
  baseURL: process.env.DASHSCOPE_BASE_URL!,
  apiKey: process.env.DASHSCOPE_API_KEY!,
});

export const chatModel = dashscope(
  process.env.DASHSCOPE_CHAT_MODEL || "qwen-plus"
);
