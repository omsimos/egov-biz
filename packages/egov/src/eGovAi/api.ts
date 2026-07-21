import { defineEgovCatalog } from "../core/catalog.js";
import { createEgovTransport } from "../core/client.js";
import { requireEgovEnvironment, type EgovEnvironment } from "../core/env.js";
import type { EgovCallOptions, EgovTransport, EgovTransportOptions } from "../core/types.js";

export const EGOV_AI_SOURCE_URL =
  "https://platforms.e.gov.ph/dashboard/api-catalogs/egov-ai" as const;

export interface EgovAiAccessTokenResponse {
  access_token: string;
  credits_remaining: number;
  credits_total: number;
  expires_in_seconds: number;
}

export interface EgovAiPromptRequest {
  category: string;
  prompt: string;
}

export interface EgovAiGeneratedTextResponse {
  data: string;
  session_id: string;
}

export interface EgovAiTranslationRequest {
  prompt: string;
  sourceLanguage: string;
  targetLanguage: string;
}

export interface EgovAiTranslationResponse {
  original_prompt: string;
  source_lang: string;
  target_lang: string;
  translate_from: { code: string; label: string };
  translated_prompt: string;
  transliterated_prompt: string;
}

export interface EgovAiDocumentRequest {
  file: Blob;
  fileName?: string;
}

export interface EgovAiDocumentResponse {
  data: string;
}

export interface EgovAiCreditsResponse {
  credits_remaining: number;
  credits_total: number;
  credits_used: number;
  expires_at: string;
}

export interface EgovAiClient {
  extractDocument(
    accessToken: string,
    request: EgovAiDocumentRequest,
    options?: EgovCallOptions,
  ): Promise<EgovAiDocumentResponse>;
  generateAccessToken(
    accessCode: string,
    options?: EgovCallOptions,
  ): Promise<EgovAiAccessTokenResponse>;
  generateAssistant(
    accessToken: string,
    request: EgovAiPromptRequest,
    options?: EgovCallOptions,
  ): Promise<EgovAiGeneratedTextResponse>;
  generateLawsAndRegulations(
    accessToken: string,
    request: EgovAiPromptRequest,
    options?: EgovCallOptions,
  ): Promise<EgovAiGeneratedTextResponse>;
  generateSpeech(
    accessToken: string,
    request: EgovAiPromptRequest,
    options?: EgovCallOptions,
  ): Promise<EgovAiGeneratedTextResponse>;
  generateTourism(
    accessToken: string,
    request: EgovAiPromptRequest,
    options?: EgovCallOptions,
  ): Promise<EgovAiGeneratedTextResponse>;
  getTokenCredits(accessToken: string, options?: EgovCallOptions): Promise<EgovAiCreditsResponse>;
  translate(
    accessToken: string,
    request: EgovAiTranslationRequest,
    options?: EgovCallOptions,
  ): Promise<EgovAiTranslationResponse>;
}

export interface EgovAiEnvironmentClient extends Omit<EgovAiClient, "generateAccessToken"> {
  generateAccessToken(options?: EgovCallOptions): Promise<EgovAiAccessTokenResponse>;
}

export interface EgovAiEnvironmentClientOptions extends EgovTransportOptions {
  env?: EgovEnvironment;
}

function withSignal(options: EgovCallOptions | undefined): Pick<EgovCallOptions, "signal"> {
  return options?.signal === undefined ? {} : { signal: options.signal };
}

function bearerHeaders(accessToken: string, options?: EgovCallOptions): Headers {
  const headers = new Headers(options?.headers);
  headers.set("authorization", `Bearer ${accessToken}`);
  return headers;
}

function generateText(
  transport: EgovTransport,
  path: string,
  accessToken: string,
  request: EgovAiPromptRequest,
  options?: EgovCallOptions,
): Promise<EgovAiGeneratedTextResponse> {
  return transport.request<EgovAiGeneratedTextResponse>({
    body: request,
    headers: bearerHeaders(accessToken, options),
    method: "POST",
    path,
    ...withSignal(options),
  });
}

export function createEgovAiClient(options: EgovTransportOptions): EgovAiClient {
  const transport = createEgovTransport(options);

  return {
    extractDocument(accessToken, request, callOptions) {
      const form = new FormData();
      if (request.fileName === undefined) {
        form.append("file", request.file);
      } else {
        form.append("file", request.file, request.fileName);
      }

      return transport.request<EgovAiDocumentResponse>({
        body: form,
        bodyType: "raw",
        headers: bearerHeaders(accessToken, callOptions),
        method: "POST",
        path: "/api/v1/egov/integration/document_extractor/generate",
        ...withSignal(callOptions),
      });
    },
    generateAccessToken(accessCode, callOptions) {
      return transport.request<EgovAiAccessTokenResponse>({
        body: { access_code: accessCode },
        headers: new Headers(callOptions?.headers),
        method: "POST",
        path: "/api/v1/egov/integration/token",
        ...withSignal(callOptions),
      });
    },
    generateAssistant(accessToken, request, callOptions) {
      return generateText(
        transport,
        "/api/v1/egov/integration/ai_assistant/generate",
        accessToken,
        request,
        callOptions,
      );
    },
    generateLawsAndRegulations(accessToken, request, callOptions) {
      return generateText(
        transport,
        "/api/v1/egov/integration/laws_and_regulations/generate",
        accessToken,
        request,
        callOptions,
      );
    },
    generateSpeech(accessToken, request, callOptions) {
      return generateText(
        transport,
        "/api/v1/egov/integration/speech_maker/generate",
        accessToken,
        request,
        callOptions,
      );
    },
    generateTourism(accessToken, request, callOptions) {
      return generateText(
        transport,
        "/api/v1/egov/integration/tourism/generate",
        accessToken,
        request,
        callOptions,
      );
    },
    getTokenCredits(accessToken, callOptions) {
      return transport.request<EgovAiCreditsResponse>({
        headers: bearerHeaders(accessToken, callOptions),
        method: "GET",
        path: "/api/v1/egov/integration/credits",
        ...withSignal(callOptions),
      });
    },
    translate(accessToken, request, callOptions) {
      return transport.request<EgovAiTranslationResponse>({
        body: {
          prompt: request.prompt,
          source_lang: request.sourceLanguage,
          target_lang: request.targetLanguage,
        },
        headers: bearerHeaders(accessToken, callOptions),
        method: "POST",
        path: "/api/v1/egov/integration/translator/generate",
        ...withSignal(callOptions),
      });
    },
  };
}

export function createEgovAiClientFromEnv(
  options: EgovAiEnvironmentClientOptions,
): EgovAiEnvironmentClient {
  const accessCode = requireEgovEnvironment("EGOVAI_ACCESS_CODE", options.env);
  const client = createEgovAiClient({
    baseUrl: options.baseUrl,
    ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
    ...(options.headers === undefined ? {} : { headers: options.headers }),
  });

  return {
    extractDocument: client.extractDocument,
    generateAccessToken(callOptions) {
      return client.generateAccessToken(accessCode, callOptions);
    },
    generateAssistant: client.generateAssistant,
    generateLawsAndRegulations: client.generateLawsAndRegulations,
    generateSpeech: client.generateSpeech,
    generateTourism: client.generateTourism,
    getTokenCredits: client.getTokenCredits,
    translate: client.translate,
  };
}

const bearerParameter = {
  location: "header",
  name: "Authorization",
  required: true,
  type: "Bearer token",
} as const;

const promptFields = [
  { name: "prompt", required: true, type: "string" },
  { name: "category", required: true, type: "string" },
] as const;

export const egovAiCatalog = defineEgovCatalog({
  endpoints: [
    {
      body: { fields: [{ name: "access_code", required: true, type: "string" }] },
      description: "Generate a short-lived access token and initial credit balance.",
      id: "generate-access-token",
      method: "POST",
      name: "Generate Access Token",
      parameters: [],
      path: "/api/v1/egov/integration/token",
      responses: [
        { description: "Access token generated.", status: 200 },
        { description: "Invalid access code.", status: 401 },
      ],
    },
    ...[
      ["ai-assistant", "AI Assistant", "ai_assistant"],
      ["speech-maker", "Speech Maker", "speech_maker"],
      ["tourism", "Tourism", "tourism"],
      ["laws-and-regulations", "Laws & Regulations", "laws_and_regulations"],
    ].map(([id, name, path]) => ({
      body: { fields: promptFields },
      description: `Generate ${name} content from a prompt and category.`,
      id: id!,
      method: "POST" as const,
      name: name!,
      parameters: [bearerParameter],
      path: `/api/v1/egov/integration/${path}/generate`,
      responses: [
        { description: "Generated content.", status: 200 },
        { description: "Invalid or expired access token.", status: 401 },
      ],
    })),
    {
      body: {
        fields: [
          { name: "prompt", required: true, type: "string" },
          { name: "source_lang", required: true, type: "ISO 639 language code" },
          { name: "target_lang", required: true, type: "ISO 639 language code" },
        ],
      },
      description: "Translate text between supported languages.",
      id: "translator",
      method: "POST",
      name: "Translator",
      parameters: [bearerParameter],
      path: "/api/v1/egov/integration/translator/generate",
      responses: [
        { description: "Translated and transliterated text.", status: 200 },
        { description: "Invalid or expired access token.", status: 401 },
      ],
    },
    {
      body: { fields: [{ name: "file", required: true, type: "File" }] },
      description: "Extract structured information from a document image or PDF.",
      id: "document-extractor",
      method: "POST",
      name: "Document Extractor",
      parameters: [bearerParameter],
      path: "/api/v1/egov/integration/document_extractor/generate",
      responses: [
        { description: "Extracted document content.", status: 200 },
        { description: "Invalid or expired access token.", status: 401 },
      ],
    },
    {
      description: "Retrieve the authenticated team's token credit balance.",
      id: "token-credits",
      method: "GET",
      name: "Token Credits",
      parameters: [bearerParameter],
      path: "/api/v1/egov/integration/credits",
      responses: [
        { description: "Credit usage and remaining balance.", status: 200 },
        { description: "Invalid or expired access token.", status: 401 },
      ],
    },
  ],
  id: "egov-ai",
  name: "eGov AI",
  slug: "egov-ai",
  sourceUrl: EGOV_AI_SOURCE_URL,
  summary: "Document intelligence, translation, and conversational AI services.",
});

export const eGovAiApi = Object.freeze({
  catalog: egovAiCatalog,
  create: createEgovAiClient,
  fromEnv: createEgovAiClientFromEnv,
});
