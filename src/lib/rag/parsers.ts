import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";

export const SUPPORTED_MIME_TYPES = [
  "text/plain",
  "text/markdown",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

export type SupportedMimeType = (typeof SUPPORTED_MIME_TYPES)[number];

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("解析超时")), ms)
    ),
  ]);
}

export async function parseDocument(
  file: File | Blob,
  mimeType: string
): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());

  switch (mimeType) {
    case "text/plain":
    case "text/markdown":
      return buffer.toString("utf-8");

    case "application/pdf": {
      const parser = new PDFParse({ data: buffer });
      try {
        const result = await withTimeout(parser.getText(), 30_000);
        return result.text;
      } finally {
        await parser.destroy();
      }
    }

    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
      const result = await withTimeout(mammoth.extractRawText({ buffer }), 30_000);
      return result.value;
    }

    default:
      throw new Error(`Unsupported file type: ${mimeType}`);
  }
}
