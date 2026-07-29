import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import type { FilesystemStorageConfig } from "./config.js";
import type {
  FileStorage,
  FileTransferOptions,
  PutFileInput,
  StoredFile,
  StoredFileReference,
} from "./types.js";
import { normalizeContentType, normalizeFileKey, normalizeMetadata } from "./validation.js";

type FilesystemManifest = {
  contentType: string;
  garbage: string[];
  metadata: Record<string, string>;
  objectName: string;
};

const objectNamePattern = /^[0-9a-f-]{36}\.blob$/;

function isMissingFile(error: unknown) {
  if (!error || typeof error !== "object") return false;
  return "code" in error && error.code === "ENOENT";
}

export class FilesystemFileStorage implements FileStorage {
  readonly backend = "filesystem" as const;
  private readonly pendingOperations = new Map<string, Promise<void>>();

  constructor(private readonly config: FilesystemStorageConfig) {}

  private paths(key: string) {
    const segments = key.split("/");
    return {
      manifest: `${join(this.config.rootDirectory, "manifests", ...segments)}.json`,
      objectDirectory: join(this.config.rootDirectory, "objects", ...segments),
    };
  }

  put(input: PutFileInput, options: FileTransferOptions = {}): Promise<StoredFileReference> {
    const key = normalizeFileKey(input.key);
    const contentType = normalizeContentType(input.contentType);
    const metadata = normalizeMetadata(input.metadata);
    const bytes = Uint8Array.from(input.bytes);
    return this.withKeyLock(key, () =>
      this.write(key, bytes, { contentType, metadata }, options.signal),
    );
  }

  private async withKeyLock<T>(key: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.pendingOperations.get(key) ?? Promise.resolve();
    let release: (() => void) | undefined;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.pendingOperations.set(key, current);
    await previous;
    try {
      return await operation();
    } finally {
      release?.();
      if (this.pendingOperations.get(key) === current) this.pendingOperations.delete(key);
    }
  }

  private async write(
    key: string,
    bytes: Uint8Array,
    metadata: Omit<FilesystemManifest, "garbage" | "objectName">,
    signal?: AbortSignal,
  ) {
    signal?.throwIfAborted();
    const paths = this.paths(key);
    await Promise.all([
      mkdir(paths.objectDirectory, { recursive: true }),
      mkdir(dirname(paths.manifest), { recursive: true }),
    ]);
    const token = randomUUID();
    const objectName = `${token}.blob`;
    const object = join(paths.objectDirectory, objectName);
    const temporaryObject = join(paths.objectDirectory, `.${token}.tmp`);
    const temporaryManifest = `${paths.manifest}.${token}.tmp`;
    const previousManifest = await this.readManifest(paths.manifest, signal);
    const previousGarbage = previousManifest?.garbage ?? [];
    const cleanupResults = await Promise.allSettled(
      previousGarbage.map((name) => rm(join(paths.objectDirectory, name), { force: true })),
    );
    const failedGarbage = previousGarbage.filter(
      (_, index) => cleanupResults[index]?.status === "rejected",
    );
    const garbage = previousManifest
      ? [...new Set([previousManifest.objectName, ...failedGarbage])]
      : [];
    try {
      const writes = await Promise.allSettled([
        writeFile(temporaryObject, bytes, { signal }),
        writeFile(temporaryManifest, JSON.stringify({ ...metadata, garbage, objectName }), {
          encoding: "utf8",
          signal,
        }),
      ]);
      const rejectedWrite = writes.find(
        (result): result is PromiseRejectedResult => result.status === "rejected",
      );
      if (rejectedWrite) throw rejectedWrite.reason;

      await rename(temporaryObject, object);
      try {
        await rename(temporaryManifest, paths.manifest);
      } catch (error) {
        await rm(object, { force: true }).catch(() => undefined);
        throw error;
      }

      return { key, size: bytes.byteLength };
    } finally {
      await Promise.allSettled([
        rm(temporaryObject, { force: true }),
        rm(temporaryManifest, { force: true }),
      ]);
    }
  }

  get(keyInput: string, options: FileTransferOptions = {}): Promise<StoredFile | undefined> {
    const key = normalizeFileKey(keyInput);
    return this.withKeyLock(key, () => this.read(key, options.signal));
  }

  private async read(key: string, signal?: AbortSignal): Promise<StoredFile | undefined> {
    signal?.throwIfAborted();
    const paths = this.paths(key);
    const manifest = await this.readManifest(paths.manifest, signal);
    if (!manifest) return undefined;

    let bytes: Uint8Array;
    try {
      bytes = Uint8Array.from(
        await readFile(join(paths.objectDirectory, manifest.objectName), { signal }),
      );
    } catch (error) {
      if (isMissingFile(error)) throw new Error(`Artifact object is missing for key "${key}"`);
      throw error;
    }
    return {
      bytes,
      contentType: manifest.contentType,
      key,
      metadata: manifest.metadata,
      size: bytes.byteLength,
    };
  }

  private async readManifest(
    manifestPath: string,
    signal?: AbortSignal,
  ): Promise<FilesystemManifest | undefined> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(await readFile(manifestPath, { encoding: "utf8", signal })) as unknown;
    } catch (error) {
      if (isMissingFile(error)) return undefined;
      throw error;
    }
    if (!parsed || typeof parsed !== "object") throw new Error("Artifact manifest is invalid");
    const candidate = parsed as Partial<FilesystemManifest>;
    if (
      typeof candidate.contentType !== "string" ||
      !Array.isArray(candidate.garbage) ||
      candidate.garbage.some(
        (objectName) => typeof objectName !== "string" || !objectNamePattern.test(objectName),
      ) ||
      !candidate.metadata ||
      typeof candidate.metadata !== "object" ||
      Array.isArray(candidate.metadata) ||
      Object.values(candidate.metadata).some((value) => typeof value !== "string") ||
      typeof candidate.objectName !== "string" ||
      !objectNamePattern.test(candidate.objectName)
    ) {
      throw new Error("Artifact manifest is invalid");
    }
    return {
      contentType: normalizeContentType(candidate.contentType),
      garbage: candidate.garbage,
      metadata: normalizeMetadata(candidate.metadata),
      objectName: candidate.objectName,
    };
  }

  delete(keyInput: string, options: FileTransferOptions = {}): Promise<void> {
    const key = normalizeFileKey(keyInput);
    return this.withKeyLock(key, () => this.remove(key, options.signal));
  }

  private async remove(key: string, signal?: AbortSignal) {
    signal?.throwIfAborted();
    const paths = this.paths(key);
    const manifest = await this.readManifest(paths.manifest, signal);
    if (manifest) {
      const removals = await Promise.allSettled(
        [...new Set([manifest.objectName, ...manifest.garbage])].map((objectName) =>
          rm(join(paths.objectDirectory, objectName), { force: true }),
        ),
      );
      const rejectedRemoval = removals.find(
        (result): result is PromiseRejectedResult => result.status === "rejected",
      );
      if (rejectedRemoval) throw rejectedRemoval.reason;
    }
    await rm(paths.manifest, { force: true });
  }
}
