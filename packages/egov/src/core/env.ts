export type EgovEnvironmentName =
  | "EGOVAI_ACCESS_CODE"
  | "EGOVCOMPASS_API_KEY"
  | "EGOVLIVENESS_API_KEY"
  | "EGOVPAY_API_KEY"
  | "EGOVPAY_SETTLEMENT_TEMPLATE_UUID"
  | "EGOVSSO_PARTNER_CODE"
  | "EGOVSSO_PARTNER_SECRET"
  | "EMESSAGE_ACCESS_TOKEN"
  | "EREPORT_ACCESS_TOKEN"
  | "EVERIFY_CLIENT_ID"
  | "EVERIFY_CLIENT_SECRET"
  | "EVERIFY_PUBKEY";

export type EgovEnvironment = Readonly<
  Partial<Record<EgovEnvironmentName, string>> & Record<string, string | undefined>
>;

interface EgovRuntimeGlobals {
  Bun?: { env?: EgovEnvironment };
  process?: { env?: EgovEnvironment };
}

export function resolveEgovEnvironment(environment?: EgovEnvironment): EgovEnvironment {
  if (environment) {
    return environment;
  }

  const globals = globalThis as typeof globalThis & EgovRuntimeGlobals;
  return globals.Bun?.env ?? globals.process?.env ?? {};
}

export function requireEgovEnvironment(
  name: EgovEnvironmentName,
  environment?: EgovEnvironment,
): string {
  const value = resolveEgovEnvironment(environment)[name]?.trim();
  if (!value) {
    throw new Error(`Missing required eGov environment variable: ${name}`);
  }

  return value;
}
