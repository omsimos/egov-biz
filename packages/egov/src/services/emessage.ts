import { defineEgovCatalog } from "../catalog.js";
import { createEgovTransport } from "../client.js";
import { requireEgovEnvironment, type EgovEnvironment } from "../env.js";
import type { EgovCallOptions, EgovTransportOptions } from "../types.js";

export const EMESSAGE_SOURCE_URL =
  "https://platforms.e.gov.ph/dashboard/api-catalogs/emessage" as const;

export interface EMessageSmsRequest {
  message: string;
  number: string;
}

export interface EMessageSmsResponse {
  data: { message: string };
}

export interface EMessageClient {
  sendSms(request: EMessageSmsRequest, options?: EgovCallOptions): Promise<EMessageSmsResponse>;
}

export interface EMessageClientOptions extends EgovTransportOptions {
  accessToken: string;
}

export interface EMessageEnvironmentClientOptions extends EgovTransportOptions {
  env?: EgovEnvironment;
}

function withSignal(options: EgovCallOptions | undefined): Pick<EgovCallOptions, "signal"> {
  return options?.signal === undefined ? {} : { signal: options.signal };
}

export function createEMessageClient(options: EMessageClientOptions): EMessageClient {
  const transport = createEgovTransport(options);

  return {
    sendSms(request, callOptions) {
      const headers = new Headers(callOptions?.headers);
      headers.set("x-emessage-auth", options.accessToken);

      return transport.request<EMessageSmsResponse>({
        body: request,
        headers,
        method: "POST",
        path: "/messaging/v1/sms/push",
        ...withSignal(callOptions),
      });
    },
  };
}

export function createEMessageClientFromEnv(
  options: EMessageEnvironmentClientOptions,
): EMessageClient {
  return createEMessageClient({
    accessToken: requireEgovEnvironment("EMESSAGE_ACCESS_TOKEN", options.env),
    baseUrl: options.baseUrl,
    ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
    ...(options.headers === undefined ? {} : { headers: options.headers }),
  });
}

export const emessageCatalog = defineEgovCatalog({
  endpoints: [
    {
      body: {
        fields: [
          {
            description: "Recipient mobile number in E.164 format.",
            name: "number",
            required: true,
            type: "string",
          },
          {
            description: "SMS message body.",
            name: "message",
            required: true,
            type: "string",
          },
        ],
      },
      description: "Send an SMS message to a recipient number.",
      id: "push-sms",
      method: "POST",
      name: "Push SMS",
      parameters: [
        {
          description: "eMessage API authentication token.",
          location: "header",
          name: "X-EMESSAGE-Auth",
          required: true,
          type: "string",
        },
      ],
      path: "/messaging/v1/sms/push",
      responses: [
        { description: "SMS created successfully.", status: 201 },
        { description: "Invalid request.", status: 400 },
        { description: "Request validation failed.", status: 422 },
      ],
    },
  ],
  id: "emessage",
  name: "eMessage",
  slug: "emessage",
  sourceUrl: EMESSAGE_SOURCE_URL,
  summary: "Deliver SMS, email, and in-app notices through one messaging API.",
});

export const eMessageApi = Object.freeze({
  catalog: emessageCatalog,
  create: createEMessageClient,
  fromEnv: createEMessageClientFromEnv,
});
