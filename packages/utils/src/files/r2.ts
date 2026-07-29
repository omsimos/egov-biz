import {
  DeleteObjectCommand,
  GetObjectCommand,
  type GetObjectCommandOutput,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from "@aws-sdk/client-s3";

import type { R2StorageConfig } from "./config.js";
import type {
  FileStorage,
  FileTransferOptions,
  PutFileInput,
  R2ClientLike,
  StoredFile,
  StoredFileReference,
} from "./types.js";
import { normalizeContentType, normalizeFileKey, normalizeMetadata } from "./validation.js";

const TRANSFER_TIMEOUT_MS = 60_000;

function boundedSignal(signal: AbortSignal | undefined) {
  const timeoutSignal = AbortSignal.timeout(TRANSFER_TIMEOUT_MS);
  return signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
}

function cancelBody(body: NonNullable<GetObjectCommandOutput["Body"]>, reason: unknown) {
  const abortable = body as unknown as {
    cancel?: (reason?: unknown) => Promise<unknown> | void;
    destroy?: (error?: Error) => void;
  };
  if (typeof abortable.destroy === "function") {
    abortable.destroy(reason instanceof Error ? reason : new Error("Artifact download aborted"));
    return;
  }
  if (typeof abortable.cancel === "function") {
    const cancellation = abortable.cancel(reason);
    if (cancellation instanceof Promise) void cancellation.catch(() => undefined);
  }
}

function readBody(
  body: NonNullable<GetObjectCommandOutput["Body"]>,
  signal: AbortSignal,
): Promise<Uint8Array> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const abort = () => {
      try {
        cancelBody(body, signal.reason);
      } catch {
        // The abort reason remains the primary failure even if stream cleanup fails.
      }
      reject(signal.reason ?? new Error("Artifact download aborted"));
    };
    signal.addEventListener("abort", abort, { once: true });
    void body
      .transformToByteArray()
      .then(resolve, reject)
      .finally(() => {
        signal.removeEventListener("abort", abort);
      });
  });
}

function isNotFound(error: unknown) {
  if (error instanceof S3ServiceException)
    return error.name === "NoSuchKey" || error.$metadata.httpStatusCode === 404;
  if (!error || typeof error !== "object") return false;
  const candidate = error as { $metadata?: { httpStatusCode?: number }; name?: string };
  return candidate.name === "NoSuchKey" || candidate.$metadata?.httpStatusCode === 404;
}

function createR2Client(config: R2StorageConfig): R2ClientLike {
  const client = new S3Client({
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    endpoint: config.endpoint,
    maxAttempts: 3,
    region: "auto",
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  return {
    send: (command, options) => client.send(command, options),
  };
}

export class R2FileStorage implements FileStorage {
  readonly backend = "r2" as const;
  private readonly client: R2ClientLike;

  constructor(
    private readonly config: R2StorageConfig,
    client?: R2ClientLike,
  ) {
    this.client = client ?? createR2Client(config);
  }

  put(input: PutFileInput, options: FileTransferOptions = {}): Promise<StoredFileReference> {
    const key = normalizeFileKey(input.key);
    const contentType = normalizeContentType(input.contentType);
    const metadata = normalizeMetadata(input.metadata);
    const bytes = Uint8Array.from(input.bytes);
    return this.upload(key, bytes, contentType, metadata, options.signal);
  }

  private async upload(
    key: string,
    bytes: Uint8Array,
    contentType: string,
    metadata: Record<string, string>,
    signal?: AbortSignal,
  ) {
    await this.client.send(
      new PutObjectCommand({
        Body: bytes,
        Bucket: this.config.bucket,
        CacheControl: "private, no-store",
        ContentLength: bytes.byteLength,
        ContentType: contentType,
        Key: key,
        Metadata: metadata,
      }),
      { abortSignal: boundedSignal(signal) },
    );
    return { key, size: bytes.byteLength };
  }

  get(keyInput: string, options: FileTransferOptions = {}): Promise<StoredFile | undefined> {
    const key = normalizeFileKey(keyInput);
    return this.download(key, options.signal);
  }

  private async download(key: string, signal?: AbortSignal): Promise<StoredFile | undefined> {
    let response: GetObjectCommandOutput;
    const transferSignal = boundedSignal(signal);
    try {
      response = (await this.client.send(
        new GetObjectCommand({ Bucket: this.config.bucket, Key: key }),
        { abortSignal: transferSignal },
      )) as GetObjectCommandOutput;
    } catch (error) {
      if (isNotFound(error)) return undefined;
      throw error;
    }
    if (!response.Body) return undefined;
    const bytes = await readBody(response.Body, transferSignal);
    return {
      bytes,
      contentType: response.ContentType ?? "application/octet-stream",
      key,
      metadata: normalizeMetadata(response.Metadata),
      size: bytes.byteLength,
    };
  }

  delete(keyInput: string, options: FileTransferOptions = {}): Promise<void> {
    const key = normalizeFileKey(keyInput);
    return this.remove(key, options.signal);
  }

  private async remove(key: string, signal?: AbortSignal) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.config.bucket, Key: key }), {
      abortSignal: boundedSignal(signal),
    });
  }
}
