import { eGovAiApi } from "@repo/egov/eGovAi";
import { EGOV_CHAIN_RPC_URL, eGovChainApi } from "@repo/egov/eGovChain";
import { eGovCompassApi } from "@repo/egov/eGovCompass";
import { eGovFaceLivenessApi } from "@repo/egov/eGovFaceLiveness";
import { eGovPayApi } from "@repo/egov/eGovPay";
import { eGovSsoApi } from "@repo/egov/eGovSso";
import { eMessageApi } from "@repo/egov/eMessage";
import { eReportApi } from "@repo/egov/eReport";
import { eVerifyApi } from "@repo/egov/eVerify";

type SmokeStatus = "failed" | "passed" | "skipped";

interface SmokeResult {
  detail: string;
  durationMs: number;
  service: string;
  status: SmokeStatus;
}

interface RuntimeProcess {
  argv: string[];
  env: Record<string, string | undefined>;
  exitCode?: number;
}

const runtimeProcess = (globalThis as typeof globalThis & { process: RuntimeProcess }).process;
const env = runtimeProcess.env;
const requestTimeoutMs = 15_000;
const verbose = runtimeProcess.argv.includes("--verbose") || env.EGOV_SMOKE_VERBOSE === "1";

function log(service: string, event: string, metadata?: Record<string, unknown>): void {
  if (!verbose) return;

  const details = metadata === undefined ? "" : ` ${JSON.stringify(metadata)}`;
  console.log(`${new Date().toISOString()} [${service}] ${event}${details}`);
}

function environment(name: string, fallback: string): string {
  return env[name]?.trim() || fallback;
}

function signal(): AbortSignal {
  return AbortSignal.timeout(requestTimeoutMs);
}

function errorDetail(error: unknown): string {
  if (!(error instanceof Error)) return "Unknown error";

  const status = (error as Error & { status?: unknown }).status;
  return typeof status === "number" ? `HTTP ${status}: ${error.message}` : error.message;
}

async function live(service: string, check: () => Promise<string>): Promise<SmokeResult> {
  const startedAt = Date.now();
  log(service, "starting live check", { timeoutMs: requestTimeoutMs });

  try {
    const detail = await check();
    const durationMs = Date.now() - startedAt;
    log(service, "live check passed", { detail, durationMs });

    return {
      detail,
      durationMs,
      service,
      status: "passed",
    };
  } catch (error) {
    const detail = errorDetail(error);
    const durationMs = Date.now() - startedAt;
    log(service, "live check failed", { detail, durationMs });

    return {
      detail,
      durationMs,
      service,
      status: "failed",
    };
  }
}

function skipped(service: string, detail: string): SmokeResult {
  log(service, "live check skipped", { reason: detail });
  return { detail, durationMs: 0, service, status: "skipped" };
}

const results: SmokeResult[] = [];

results.push(
  await live(eGovAiApi.catalog.name, async () => {
    const baseUrl = environment("EGOVAI_BASE_URL", "https://egov-ai-core-ws.oueg.info");
    log(eGovAiApi.catalog.name, "creating client", { baseUrl });
    const client = eGovAiApi.fromEnv({ baseUrl });
    log(eGovAiApi.catalog.name, "requesting access token");
    const token = await client.generateAccessToken({ signal: signal() });
    log(eGovAiApi.catalog.name, "access token issued", {
      creditsRemaining: token.credits_remaining,
      creditsTotal: token.credits_total,
      expiresInSeconds: token.expires_in_seconds,
    });
    log(eGovAiApi.catalog.name, "requesting token credits");
    const credits = await client.getTokenCredits(token.access_token, { signal: signal() });
    log(eGovAiApi.catalog.name, "token credits received", {
      creditsRemaining: credits.credits_remaining,
      creditsTotal: credits.credits_total,
      creditsUsed: credits.credits_used,
      expiresAt: credits.expires_at,
    });

    return `${credits.credits_remaining}/${credits.credits_total} credits remaining`;
  }),
);

results.push(
  await live(eVerifyApi.catalog.name, async () => {
    const baseUrl = environment("EVERIFY_BASE_URL", "https://hackathon-everify-api.e.gov.ph");
    log(eVerifyApi.catalog.name, "creating client", { baseUrl });
    const client = eVerifyApi.fromEnv({ baseUrl });
    log(eVerifyApi.catalog.name, "requesting access token");
    const response = await client.authenticate({ signal: signal() });
    log(eVerifyApi.catalog.name, "access token issued", {
      expiresAt: response.data.expires_at,
      tokenType: response.data.token_type,
    });

    return `${response.data.token_type} token issued; expires at ${response.data.expires_at}`;
  }),
);

results.push(
  await live(eReportApi.catalog.name, async () => {
    const baseUrl = environment("EREPORT_BASE_URL", "https://stg-ereport-ws.oueg.info");
    log(eReportApi.catalog.name, "creating client", { baseUrl });
    const envClient = eReportApi.fromEnv({ baseUrl });
    log(eReportApi.catalog.name, "requesting integration token");
    const token = await envClient.generateToken({ signal: signal() });
    log(eReportApi.catalog.name, "integration token issued", {
      expiresAt: token.expires_at,
    });
    const client = eReportApi.create({ baseUrl });
    log(eReportApi.catalog.name, "requesting report types");
    const reportTypes = await client.listReportTypes(token.access_token, { signal: signal() });
    log(eReportApi.catalog.name, "report types received", {
      count: reportTypes.data.length,
      total: reportTypes.meta?.pagination.total,
    });

    return `${reportTypes.data.length} report types returned`;
  }),
);

results.push(
  await live(eGovCompassApi.catalog.name, async () => {
    const baseUrl = environment("EGOVCOMPASS_BASE_URL", "https://dbm-ws.oueg.info");
    const query = {
      limit: 1,
      page: 1,
      period: "FY" as const,
      reportYear: new Date().getFullYear(),
    };
    log(eGovCompassApi.catalog.name, "creating client", { baseUrl });
    const client = eGovCompassApi.fromEnv({ baseUrl });
    log(eGovCompassApi.catalog.name, "requesting SAAODB records", query);
    const page = await client.getSaaodbRecords(query, { signal: signal() });
    log(eGovCompassApi.catalog.name, "SAAODB records received", {
      items: page.items.length,
      limit: page.limit,
      page: page.page,
      total: page.total,
    });

    return `${page.items.length} item(s) returned; ${page.total} total`;
  }),
);

results.push(
  await live(eGovChainApi.catalog.name, async () => {
    log(eGovChainApi.catalog.name, "creating client", { baseUrl: EGOV_CHAIN_RPC_URL });
    const client = eGovChainApi.create();
    log(eGovChainApi.catalog.name, "requesting chain ID and block number");
    const [chainIdHex, blockNumberHex] = await Promise.all([
      client.chainId({ signal: signal() }),
      client.blockNumber({ signal: signal() }),
    ]);
    const chainId = Number.parseInt(chainIdHex, 16);
    const blockNumber = Number.parseInt(blockNumberHex, 16);
    log(eGovChainApi.catalog.name, "chain metadata received", { blockNumber, chainId });

    return `chain ${chainId}, block ${blockNumber}`;
  }),
);

results.push(
  skipped(eGovSsoApi.catalog.name, "a short-lived, single-use OAuth exchange code is required"),
  skipped(eMessageApi.catalog.name, "the only operation sends a real SMS"),
  skipped(
    eGovPayApi.catalog.name,
    "a transaction UUID is required for a read-only check; other operations create or mutate payments",
  ),
  skipped(
    eGovFaceLivenessApi.catalog.name,
    "the first operation creates a real liveness session and requires a user verification flow",
  ),
);

console.table(results);

const passed = results.filter(({ status }) => status === "passed").length;
const failed = results.filter(({ status }) => status === "failed").length;
const skippedCount = results.filter(({ status }) => status === "skipped").length;

log("summary", "smoke run completed", { failed, passed, skipped: skippedCount });
console.log(`\n${passed} passed, ${failed} failed, ${skippedCount} skipped`);

if (failed > 0) runtimeProcess.exitCode = 1;
