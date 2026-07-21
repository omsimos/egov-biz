import { EgovApiError } from "@repo/egov/core";
import { eGovAiApi } from "@repo/egov/eGovAi";
import type {
  EgovAiCreditsResponse,
  EgovAiDocumentResponse,
  EgovAiGeneratedTextResponse,
  EgovAiTranslationResponse,
} from "@repo/egov/eGovAi/types";

// Bun-only runtime globals (this app runs under `bun`, not typed by the DOM lib).
interface RuntimeProcess {
  argv: string[];
  env: Record<string, string | undefined>;
  exitCode?: number;
}

interface BunFile extends Blob {
  readonly name?: string;
}

interface BunRuntime {
  file(path: string): BunFile;
}

const runtimeProcess = (globalThis as typeof globalThis & { process: RuntimeProcess }).process;
const bun = (globalThis as typeof globalThis & { Bun?: BunRuntime }).Bun;
const env = runtimeProcess.env;

const tokenTimeoutMs = 15_000;
const generateTimeoutMs = 60_000;

type Command =
  | "all"
  | "assistant"
  | "credits"
  | "document"
  | "laws"
  | "speech"
  | "tourism"
  | "translate";

const commands: readonly Command[] = [
  "assistant",
  "speech",
  "tourism",
  "laws",
  "translate",
  "document",
  "credits",
  "all",
];

interface Flags {
  category: string;
  file: string | undefined;
  prompt: string;
  source: string;
  target: string;
}

function isCommand(value: string): value is Command {
  return (commands as readonly string[]).includes(value);
}

function parseArgs(argv: string[]): { command: Command; flags: Flags } {
  let command: Command = "assistant";
  const values = new Map<string, string>();

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === undefined) continue;

    if (arg.startsWith("--")) {
      const next = argv[index + 1];
      if (next !== undefined && !next.startsWith("--")) {
        values.set(arg.slice(2), next);
        index += 1;
      }
      continue;
    }

    if (isCommand(arg)) command = arg;
  }

  return {
    command,
    flags: {
      category: values.get("category") ?? "general",
      file: values.get("file"),
      prompt: values.get("prompt") ?? "What are the requirements to renew a Philippine passport?",
      source: values.get("source") ?? "en",
      target: values.get("target") ?? "fil",
    },
  };
}

function signal(timeoutMs: number): AbortSignal {
  return AbortSignal.timeout(timeoutMs);
}

function heading(title: string): void {
  console.log(`\n${"─".repeat(64)}\n${title}\n${"─".repeat(64)}`);
}

function show(label: string, response: unknown): void {
  console.log(`\n${label} — response shape:`);
  if (response !== null && typeof response === "object") {
    for (const [key, value] of Object.entries(response)) {
      const preview =
        typeof value === "string"
          ? `${JSON.stringify(value.slice(0, 80))}${value.length > 80 ? "…" : ""}`
          : JSON.stringify(value);
      console.log(`  • ${key}: ${typeof value} = ${preview}`);
    }
  }
  console.log(`\n${label} — raw JSON:`);
  console.log(JSON.stringify(response, null, 2));
}

type EnvClient = ReturnType<typeof eGovAiApi.fromEnv>;

async function runText(
  accessToken: string,
  flags: Flags,
  label: string,
  call: (
    token: string,
    request: { category: string; prompt: string },
    options: { signal: AbortSignal },
  ) => Promise<EgovAiGeneratedTextResponse>,
): Promise<void> {
  const request = { category: flags.category, prompt: flags.prompt };
  console.log(`\n${label} — request:`, JSON.stringify(request));
  const response = await call(accessToken, request, { signal: signal(generateTimeoutMs) });
  show(label, response);
}

async function runTranslate(client: EnvClient, accessToken: string, flags: Flags): Promise<void> {
  const request = {
    prompt: flags.prompt,
    sourceLanguage: flags.source,
    targetLanguage: flags.target,
  };
  console.log("\nTranslate — request:", JSON.stringify(request));
  const response: EgovAiTranslationResponse = await client.translate(accessToken, request, {
    signal: signal(generateTimeoutMs),
  });
  show("Translate", response);
}

async function runDocument(client: EnvClient, accessToken: string, flags: Flags): Promise<void> {
  if (flags.file === undefined) {
    console.log("\nDocument — skipped: pass --file <path> to extract a document.");
    return;
  }
  if (bun === undefined) {
    console.log("\nDocument — skipped: file reading requires the Bun runtime.");
    return;
  }

  const file = bun.file(flags.file);
  console.log("\nDocument — request:", JSON.stringify({ file: flags.file }));
  const response: EgovAiDocumentResponse = await client.extractDocument(
    accessToken,
    { file, fileName: file.name ?? flags.file },
    { signal: signal(generateTimeoutMs) },
  );
  show("Document", response);
}

async function runCredits(client: EnvClient, accessToken: string): Promise<void> {
  const response: EgovAiCreditsResponse = await client.getTokenCredits(accessToken, {
    signal: signal(tokenTimeoutMs),
  });
  show("Credits", response);
}

async function main(): Promise<void> {
  const { command, flags } = parseArgs(runtimeProcess.argv.slice(2));
  const baseUrl = env.EGOVAI_BASE_URL?.trim() || "https://egov-ai-core-ws.oueg.info";

  heading(`eGov AI sample — command: ${command}`);
  console.log(`base URL: ${baseUrl}`);
  console.log(`catalog:  ${eGovAiApi.catalog.name} — ${eGovAiApi.catalog.summary}`);

  if (!env.EGOVAI_ACCESS_CODE?.trim()) {
    console.error("\nMissing EGOVAI_ACCESS_CODE. Add it to .env, then re-run.");
    runtimeProcess.exitCode = 1;
    return;
  }

  const client = eGovAiApi.fromEnv({ baseUrl });

  // Every request needs a short-lived access token minted from EGOVAI_ACCESS_CODE.
  const token = await client.generateAccessToken({ signal: signal(tokenTimeoutMs) });
  show("Access token", {
    ...token,
    access_token: `${token.access_token.slice(0, 8)}… (${token.access_token.length} chars)`,
  });

  const runners: Record<Exclude<Command, "all">, () => Promise<void>> = {
    assistant: () => runText(token.access_token, flags, "AI Assistant", client.generateAssistant),
    credits: () => runCredits(client, token.access_token),
    document: () => runDocument(client, token.access_token, flags),
    laws: () =>
      runText(token.access_token, flags, "Laws & Regulations", client.generateLawsAndRegulations),
    speech: () => runText(token.access_token, flags, "Speech Maker", client.generateSpeech),
    tourism: () => runText(token.access_token, flags, "Tourism", client.generateTourism),
    translate: () => runTranslate(client, token.access_token, flags),
  };

  const selected: Exclude<Command, "all">[] =
    command === "all"
      ? ["assistant", "speech", "tourism", "laws", "translate", "credits"]
      : [command];

  for (const name of selected) {
    heading(name);
    try {
      await runners[name]();
    } catch (error) {
      if (error instanceof EgovApiError) {
        console.error(`\n${name} — HTTP ${error.status} ${error.statusText}`);
        console.error(JSON.stringify(error.body, null, 2));
      } else {
        console.error(`\n${name} — error:`, error instanceof Error ? error.message : error);
      }
      runtimeProcess.exitCode = 1;
    }
  }
}

await main();
