export interface TextChunk {
  content: string;
  chunkIndex: number;
  metadata: { startChar: number; endChar: number };
}

export function chunkText(
  text: string,
  chunkSize = 500,
  overlap = 50
): TextChunk[] {
  if (chunkSize < 1) chunkSize = 1;
  if (overlap >= chunkSize) overlap = chunkSize - 1;
  const charChunkSize = chunkSize * 4;
  const charOverlap = overlap * 4;
  const chunks: TextChunk[] = [];

  let start = 0;
  let index = 0;

  while (start < text.length) {
    const end = Math.min(start + charChunkSize, text.length);
    const content = text.substring(start, end).trim();

    if (content.length > 0) {
      chunks.push({
        content,
        chunkIndex: index,
        metadata: { startChar: start, endChar: end },
      });
      index++;
    }

    if (end >= text.length) break;
    start = end - charOverlap;
  }

  return chunks;
}
