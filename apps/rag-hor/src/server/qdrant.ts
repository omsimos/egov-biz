import { QdrantClient } from "@qdrant/js-client-rest";
import { embed, embedMany } from "ai";
import { env } from "@/lib/env";
import { formatTimestamp, youtubeWatchUrl } from "@/lib/time";
import type { HearingChunk, HearingCitation } from "@/lib/types";
import { getEmbeddingModel } from "@/server/models";

declare global {
  var __ragHorQdrant: QdrantClient | undefined;
}

function getClient() {
  if (globalThis.__ragHorQdrant) return globalThis.__ragHorQdrant;
  globalThis.__ragHorQdrant = new QdrantClient({
    url: env.qdrantUrl,
    ...(env.qdrantApiKey ? { apiKey: env.qdrantApiKey } : {}),
  });
  return globalThis.__ragHorQdrant;
}

async function ensureCollection() {
  const client = getClient();
  const collections = await client.getCollections();
  if (collections.collections.some((collection) => collection.name === env.qdrantCollection)) return;
  await client.createCollection(env.qdrantCollection, {
    vectors: { size: env.embeddingDimensions, distance: "Cosine" },
  });
  await client.createPayloadIndex(env.qdrantCollection, {
    field_name: "hearingId",
    field_schema: "keyword",
    wait: true,
  });
}

function batches<T>(values: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
  return result;
}

export async function replaceHearingChunks(hearingId: string, chunks: HearingChunk[]) {
  await ensureCollection();
  const client = getClient();
  await client.delete(env.qdrantCollection, {
    filter: { must: [{ key: "hearingId", match: { value: hearingId } }] },
    wait: true,
  });

  for (const batch of batches(chunks, 64)) {
    const result = await embedMany({
      model: getEmbeddingModel(),
      values: batch.map((chunk) => `${chunk.title}\n\n${chunk.text}`),
      maxParallelCalls: 3,
    });
    await client.upsert(env.qdrantCollection, {
      wait: true,
      points: batch.map((chunk, index) => ({
        id: chunk.id,
        vector: [...result.embeddings[index]!],
        payload: { ...chunk },
      })),
    });
  }
}

export async function searchHearing(
  hearingId: string,
  query: string,
  limit = 6,
): Promise<HearingCitation[]> {
  await ensureCollection();
  const { embedding } = await embed({ model: getEmbeddingModel(), value: query });
  const results = await getClient().search(env.qdrantCollection, {
    vector: embedding,
    limit,
    with_payload: true,
    filter: { must: [{ key: "hearingId", match: { value: hearingId } }] },
  });

  return results.flatMap((result) => {
    const payload = result.payload as unknown as HearingChunk | null | undefined;
    if (!payload?.videoId) return [];
    return [
      {
        ...payload,
        score: result.score,
        timestamp: formatTimestamp(payload.startSeconds),
        watchUrl: youtubeWatchUrl(payload.videoId, payload.startSeconds),
      },
    ];
  });
}
