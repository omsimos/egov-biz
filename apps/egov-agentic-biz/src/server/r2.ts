import { createHash } from "node:crypto";
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from "@aws-sdk/client-s3";

const PDF_MEDIA_TYPE = "application/pdf";
const R2_REGION = "auto";
const R2_TRANSFER_TIMEOUT_MS = 60_000;

type Environment = Record<string, string | undefined>;

export type BirFormType = "1901" | "1905";

export type R2Config = {
  accessKeyId: string;
  bucket: string;
  endpoint: string;
  secretAccessKey: string;
};

export type StoredBirForm = {
  bytes: Uint8Array;
  filename: "BIR-Form-1901.pdf" | "BIR-Form-1905.pdf";
  formType: BirFormType;
  mediaType: typeof PDF_MEDIA_TYPE;
};

type BirFormTransferOptions = {
  signal?: AbortSignal;
};

let cachedClient: S3Client | undefined;
let cachedClientKey = "";

function requiredSetting(value: string | undefined, name: string) {
  const normalized = value?.trim();
  if (!normalized) throw new Error(`${name} is required for Cloudflare R2 artifact storage`);
  return normalized;
}

function parseR2BaseUrl(value: string | undefined) {
  const configured = requiredSetting(value, "R2_BASE_URL");
  let url: URL;
  try {
    url = new URL(configured);
  } catch {
    throw new Error("R2_BASE_URL must be a valid Cloudflare R2 S3 URL");
  }

  const pathSegments = url.pathname.split("/").filter(Boolean);
  if (
    url.protocol !== "https:" ||
    !url.hostname.toLowerCase().endsWith(".r2.cloudflarestorage.com") ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    pathSegments.length !== 1
  ) {
    throw new Error(
      "R2_BASE_URL must be an HTTPS Cloudflare R2 S3 URL ending with the private bucket name",
    );
  }

  let bucket: string;
  try {
    bucket = decodeURIComponent(pathSegments[0] ?? "");
  } catch {
    throw new Error("R2_BASE_URL contains an invalid bucket name");
  }
  if (!bucket || bucket.includes("/")) {
    throw new Error("R2_BASE_URL contains an invalid bucket name");
  }

  return { bucket, endpoint: url.origin };
}

export function r2Config(environment: Environment = process.env): R2Config {
  return {
    accessKeyId: requiredSetting(environment.R2_ACCESS_KEY, "R2_ACCESS_KEY"),
    ...parseR2BaseUrl(environment.R2_BASE_URL),
    secretAccessKey: requiredSetting(environment.R2_SECRET_KEY, "R2_SECRET_KEY"),
  };
}

function r2Client(config: R2Config) {
  const clientKey = createHash("sha256")
    .update([config.endpoint, config.bucket, config.accessKeyId, config.secretAccessKey].join("\0"))
    .digest("hex");
  if (cachedClient && cachedClientKey === clientKey) return cachedClient;

  cachedClient?.destroy();
  cachedClient = new S3Client({
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    endpoint: config.endpoint,
    maxAttempts: 3,
    region: R2_REGION,
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  cachedClientKey = clientKey;
  return cachedClient;
}

function boundedSignal(signal: AbortSignal | undefined) {
  const timeoutSignal = AbortSignal.timeout(R2_TRANSFER_TIMEOUT_MS);
  return signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
}

function birFormObjectPrefix(ownerId: string) {
  const ownerHash = createHash("sha256").update(ownerId).digest("hex");
  return `bir-forms/${ownerHash}/`;
}

export function birFormObjectKey(ownerId: string, artifactId: string) {
  return `${birFormObjectPrefix(ownerId)}${artifactId}.pdf`;
}

function isNotFound(error: unknown) {
  if (error instanceof S3ServiceException) {
    return error.name === "NoSuchKey" || error.$metadata.httpStatusCode === 404;
  }
  if (!error || typeof error !== "object") return false;
  const candidate = error as {
    $metadata?: { httpStatusCode?: number };
    name?: string;
  };
  return candidate.name === "NoSuchKey" || candidate.$metadata?.httpStatusCode === 404;
}

export async function uploadBirForm(
  ownerId: string,
  artifactId: string,
  formType: BirFormType,
  bytes: Uint8Array,
  options: BirFormTransferOptions = {},
) {
  const config = r2Config();
  const client = r2Client(config);
  const key = birFormObjectKey(ownerId, artifactId);
  await client.send(
    new PutObjectCommand({
      Body: bytes,
      Bucket: config.bucket,
      CacheControl: "private, no-store",
      ContentLength: bytes.byteLength,
      ContentType: PDF_MEDIA_TYPE,
      Key: key,
      Metadata: { "form-type": formType },
    }),
    { abortSignal: boundedSignal(options.signal) },
  );
}

export async function downloadBirForm(
  ownerId: string,
  artifactId: string,
  options: BirFormTransferOptions = {},
): Promise<StoredBirForm | undefined> {
  const config = r2Config();
  try {
    const response = await r2Client(config).send(
      new GetObjectCommand({
        Bucket: config.bucket,
        Key: birFormObjectKey(ownerId, artifactId),
      }),
      { abortSignal: boundedSignal(options.signal) },
    );
    if (!response.Body) return undefined;

    const formType = response.Metadata?.["form-type"] === "1905" ? "1905" : "1901";
    return {
      bytes: await response.Body.transformToByteArray(),
      filename: formType === "1905" ? "BIR-Form-1905.pdf" : "BIR-Form-1901.pdf",
      formType,
      mediaType: PDF_MEDIA_TYPE,
    };
  } catch (error) {
    if (isNotFound(error)) return undefined;
    throw error;
  }
}
