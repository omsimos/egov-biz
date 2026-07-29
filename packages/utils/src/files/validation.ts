import type { FileStorageMetadata } from "./types.js";

const keySegment = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const metadataName = /^[a-z0-9][a-z0-9-]*$/;
const printableAscii = /^[\x20-\x7e]*$/;
const mediaType =
  /^[A-Za-z0-9!#$%&'*+.^_`|~-]+\/[A-Za-z0-9!#$%&'*+.^_`|~-]+(?:\s*;\s*[\x20-\x7e]+)?$/;
const MAX_METADATA_BYTES = 2_048;

export function normalizeFileKey(value: string) {
  const key = value.normalize("NFKC").trim();
  const segments = key.split("/");
  if (!key || key.startsWith("/") || segments.some((segment) => !keySegment.test(segment)))
    throw new Error("Artifact file key must be a safe relative path");
  return segments.join("/");
}

export function normalizeContentType(value: string) {
  const contentType = value.normalize("NFKC").trim();
  if (!mediaType.test(contentType))
    throw new Error("Artifact content type must be a header-safe MIME type");
  return contentType;
}

export function normalizeMetadata(value: FileStorageMetadata | undefined) {
  const metadata: Record<string, string> = {};
  let byteLength = 0;
  for (const [rawName, rawValue] of Object.entries(value ?? {})) {
    const name = rawName.normalize("NFKC").trim().toLowerCase();
    if (!metadataName.test(name)) throw new Error(`Artifact metadata key "${rawName}" is invalid`);
    const normalizedValue = rawValue.normalize("NFKC").trim();
    if (!printableAscii.test(normalizedValue))
      throw new Error(`Artifact metadata value for "${name}" must use printable ASCII`);
    byteLength += Buffer.byteLength(name) + Buffer.byteLength(normalizedValue);
    if (byteLength > MAX_METADATA_BYTES)
      throw new Error(`Artifact metadata must not exceed ${MAX_METADATA_BYTES} bytes`);
    metadata[name] = normalizedValue;
  }
  return metadata;
}
