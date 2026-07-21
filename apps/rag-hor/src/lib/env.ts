import path from "node:path";

const asNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const env = {
  aiGatewayApiKey: process.env.AI_GATEWAY_API_KEY,
  aiGatewayBaseUrl: process.env.AI_GATEWAY_BASE_URL,
  chatModel: process.env.CHAT_MODEL ?? "google/gemini-2.5-flash-lite",
  databasePath: process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "rag-hor.sqlite"),
  embeddingDimensions: asNumber(process.env.EMBEDDING_DIMENSIONS, 1536),
  embeddingModel: process.env.EMBEDDING_MODEL ?? "openai/text-embedding-3-small",
  exaApiKey: process.env.EXA_API_KEY,
  qdrantApiKey: process.env.QDRANT_API_KEY,
  qdrantCollection: process.env.QDRANT_COLLECTION ?? "hearing-transcripts",
  qdrantUrl: process.env.QDRANT_URL ?? "http://localhost:6333",
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
  youtubeChannelUrl:
    process.env.YOUTUBE_CHANNEL_URL ?? "https://www.youtube.com/@HouseofRepresentativesPH/videos",
};

export function requireModelConfiguration() {
  if (!env.aiGatewayApiKey) {
    throw new Error("AI_GATEWAY_API_KEY is required to chat and create embeddings. Copy .env.example to .env.local.");
  }
}
