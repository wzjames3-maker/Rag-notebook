import { createOpenAI } from "@ai-sdk/openai";

export const siliconflow = createOpenAI({
  baseURL: process.env.SILICONFLOW_BASE_URL!,
  apiKey: process.env.SILICONFLOW_API_KEY!,
});
