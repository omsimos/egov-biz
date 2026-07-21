import { createGateway } from "ai";
import { env, requireModelConfiguration } from "@/lib/env";

let provider: ReturnType<typeof createGateway> | null = null;

function getProvider() {
  requireModelConfiguration();
  if (!provider) {
    provider = createGateway({
      apiKey: env.aiGatewayApiKey,
      ...(env.aiGatewayBaseUrl ? { baseURL: env.aiGatewayBaseUrl } : {}),
    });
  }
  return provider;
}

export function getChatModel() {
  return getProvider().chat(env.chatModel);
}

export function getEmbeddingModel() {
  return getProvider().embeddingModel(env.embeddingModel);
}
