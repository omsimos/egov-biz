import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createFileStorage,
  resolveFileStorageConfig,
  type R2ClientLike,
} from "../src/files/index.js";

type StoredManifest = {
  garbage: string[];
  objectName: string;
};

const completeR2Environment = {
  R2_ACCESS_KEY: "access",
  R2_BASE_URL: `https://${"a".repeat(32)}.r2.cloudflarestorage.com/egov-artifacts`,
  R2_SECRET_KEY: "secret",
};

describe("file storage configuration", () => {
  test("uses filesystem storage when R2 is not configured", () => {
    expect(resolveFileStorageConfig({}, { workingDirectory: "/workspace" })).toEqual({
      backend: "filesystem",
      rootDirectory: "/workspace/data/artifacts",
    });
  });

  test("uses the Cloudflare R2 S3 endpoint when all credentials exist", () => {
    expect(resolveFileStorageConfig(completeR2Environment)).toEqual({
      accessKeyId: "access",
      backend: "r2",
      bucket: "egov-artifacts",
      endpoint: `https://${"a".repeat(32)}.r2.cloudflarestorage.com`,
      secretAccessKey: "secret",
    });
  });

  test("rejects a partial R2 configuration instead of silently falling back", () => {
    expect(() => resolveFileStorageConfig({ R2_ACCESS_KEY: "access" })).toThrow("R2_BASE_URL");
  });
});

describe("filesystem file storage", () => {
  test("puts, gets, and deletes an artifact with metadata", async () => {
    const rootDirectory = await mkdtemp(join(tmpdir(), "egov-files-"));
    try {
      const storage = createFileStorage({ environment: {}, filesystemRoot: rootDirectory });
      const bytes = new TextEncoder().encode("demo pdf");

      expect(storage.backend).toBe("filesystem");
      await storage.put({
        bytes,
        contentType: "application/pdf",
        key: "bir/citizen-1/form-1901.pdf",
        metadata: { "form-type": "1901" },
      });

      expect(await storage.get("bir/citizen-1/form-1901.pdf")).toEqual({
        bytes,
        contentType: "application/pdf",
        key: "bir/citizen-1/form-1901.pdf",
        metadata: { "form-type": "1901" },
        size: bytes.byteLength,
      });

      await storage.delete("bir/citizen-1/form-1901.pdf");
      expect(await storage.get("bir/citizen-1/form-1901.pdf")).toBeUndefined();
      expect(() => storage.get("../outside.pdf")).toThrow("file key");
    } finally {
      await rm(rootDirectory, { force: true, recursive: true });
    }
  });

  test("keeps bytes and metadata from the same write during concurrent puts", async () => {
    const rootDirectory = await mkdtemp(join(tmpdir(), "egov-files-"));
    try {
      const storage = createFileStorage({ environment: {}, filesystemRoot: rootDirectory });
      const versions = Array.from({ length: 24 }, (_, index) => `version-${index}`);

      await Promise.all(
        versions.map((version) =>
          storage.put({
            bytes: new TextEncoder().encode(version),
            contentType: "application/pdf",
            key: "bir/shared/form-1901.pdf",
            metadata: { version },
          }),
        ),
      );

      const stored = await storage.get("bir/shared/form-1901.pdf");
      expect(stored).toBeDefined();
      expect(new TextDecoder().decode(stored?.bytes)).toBe(stored?.metadata.version);
    } finally {
      await rm(rootDirectory, { force: true, recursive: true });
    }
  });

  test("rejects metadata that cannot be sent through the R2 backend", async () => {
    const rootDirectory = await mkdtemp(join(tmpdir(), "egov-files-"));
    try {
      const storage = createFileStorage({ environment: {}, filesystemRoot: rootDirectory });
      const input = {
        bytes: new Uint8Array(),
        contentType: "application/pdf",
        key: "bir/form-1901.pdf",
      };

      expect(() => storage.put({ ...input, metadata: { note: "first\nsecond" } })).toThrow(
        "metadata value",
      );
      expect(() => storage.put({ ...input, metadata: { note: "a".repeat(2_049) } })).toThrow(
        "metadata",
      );
      expect(() => storage.put({ ...input, contentType: "application/\u0001pdf" })).toThrow(
        "content type",
      );
      expect(() => storage.put({ ...input, contentType: "application/🗎" })).toThrow("content type");
    } finally {
      await rm(rootDirectory, { force: true, recursive: true });
    }
  });

  test("serializes reads and deletes with same-key writes", async () => {
    const rootDirectory = await mkdtemp(join(tmpdir(), "egov-files-"));
    try {
      const storage = createFileStorage({ environment: {}, filesystemRoot: rootDirectory });
      const key = "bir/shared/form-1901.pdf";
      const put = (version: string) =>
        storage.put({
          bytes: new TextEncoder().encode(version),
          contentType: "application/pdf",
          key,
          metadata: { version },
        });

      await put("initial");
      const replacement = put("replacement");
      const read = storage.get(key);
      const deletion = storage.delete(key);
      await replacement;
      expect(new TextDecoder().decode((await read)?.bytes)).toBe("replacement");
      await deletion;
      expect(await storage.get(key)).toBeUndefined();

      const deleteMissing = storage.delete(key);
      const finalPut = put("final");
      await deleteMissing;
      await finalPut;
      expect(new TextDecoder().decode((await storage.get(key))?.bytes)).toBe("final");
    } finally {
      await rm(rootDirectory, { force: true, recursive: true });
    }
  });

  test("retains superseded object names as retryable cleanup targets", async () => {
    const rootDirectory = await mkdtemp(join(tmpdir(), "egov-files-"));
    try {
      const storage = createFileStorage({ environment: {}, filesystemRoot: rootDirectory });
      const input = {
        contentType: "application/pdf",
        key: "bir/shared/form-1901.pdf",
      };
      await storage.put({ ...input, bytes: new TextEncoder().encode("first") });
      await storage.put({ ...input, bytes: new TextEncoder().encode("second") });
      await storage.put({ ...input, bytes: new TextEncoder().encode("third") });

      const manifest: StoredManifest = JSON.parse(
        await readFile(
          join(rootDirectory, "manifests", "bir", "shared", "form-1901.pdf.json"),
          "utf8",
        ),
      );
      expect(manifest.garbage).toHaveLength(1);
      expect(manifest.garbage).not.toContain(manifest.objectName);

      await storage.delete(input.key);
      expect(await storage.get(input.key)).toBeUndefined();
    } finally {
      await rm(rootDirectory, { force: true, recursive: true });
    }
  });
});

describe("R2 file storage", () => {
  test("uses S3-compatible put, get, and delete commands", async () => {
    const objects = new Map<
      string,
      { bytes: Uint8Array; contentType: string; metadata: Record<string, string> }
    >();
    const client: R2ClientLike = {
      async send(command) {
        const key = String(command.input.Key);
        if (command instanceof PutObjectCommand) {
          // SAFETY: R2FileStorage.put is the only caller, and it always sends the
          // `Uint8Array.from(input.bytes)` copy it just built as the command body.
          const body = command.input.Body as Uint8Array;
          objects.set(key, {
            bytes: body,
            contentType: String(command.input.ContentType),
            metadata: command.input.Metadata ?? {},
          });
          return {};
        }
        if (command instanceof DeleteObjectCommand) {
          objects.delete(key);
          return {};
        }
        const stored = objects.get(key);
        if (!stored) {
          throw Object.assign(new Error("missing"), {
            $metadata: { httpStatusCode: 404 },
            name: "NoSuchKey",
          });
        }
        return {
          Body: { transformToByteArray: async () => stored.bytes },
          ContentType: stored.contentType,
          Metadata: stored.metadata,
        };
      },
    };
    const storage = createFileStorage({
      environment: completeR2Environment,
      r2Client: client,
    });
    const bytes = new TextEncoder().encode("r2 artifact");

    expect(storage.backend).toBe("r2");
    await storage.put({
      bytes,
      contentType: "application/pdf",
      key: "bir/citizen-2/form-2303.pdf",
      metadata: { "form-type": "2303" },
    });
    expect(await storage.get("bir/citizen-2/form-2303.pdf")).toEqual({
      bytes,
      contentType: "application/pdf",
      key: "bir/citizen-2/form-2303.pdf",
      metadata: { "form-type": "2303" },
      size: bytes.byteLength,
    });

    await storage.delete("bir/citizen-2/form-2303.pdf");
    expect(await storage.get("bir/citizen-2/form-2303.pdf")).toBeUndefined();
  });

  test("aborts while an R2 response body is still being consumed", async () => {
    let markBodyStarted: (() => void) | undefined;
    const bodyStarted = new Promise<void>((resolve) => {
      markBodyStarted = resolve;
    });
    const client: R2ClientLike = {
      async send() {
        return {
          Body: {
            transformToByteArray() {
              markBodyStarted?.();
              return new Promise<Uint8Array>(() => undefined);
            },
          },
          ContentType: "application/pdf",
        };
      },
    };
    const storage = createFileStorage({
      environment: completeR2Environment,
      r2Client: client,
    });
    const controller = new AbortController();
    const pendingRead = storage.get("bir/citizen-2/form-2303.pdf", {
      signal: controller.signal,
    });

    await bodyStarted;
    controller.abort(new Error("read stopped"));

    await expect(pendingRead).rejects.toThrow("read stopped");
  });
});
