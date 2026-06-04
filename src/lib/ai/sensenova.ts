import { createOpenAI } from "@ai-sdk/openai";

export const sensenova = createOpenAI({
  baseURL: process.env.SENSENOVA_BASE_URL!,
  apiKey: process.env.SENSENOVA_API_KEY!,
});

export const chatModel = sensenova.chat(
  process.env.SENSENOVA_CHAT_MODEL || "deepseek-v4-flash"
);
