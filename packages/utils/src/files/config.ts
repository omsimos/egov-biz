import { resolve } from "node:path";

export type FileStorageEnvironment = Record<string, string | undefined>;

export type FilesystemStorageConfig = {
  backend: "filesystem";
  rootDirectory: string;
};

export type R2StorageConfig = {
  accessKeyId: string;
  backend: "r2";
  bucket: string;
  endpoint: string;
  secretAccessKey: string;
};

export type FileStorageConfig = FilesystemStorageConfig | R2StorageConfig;

export type FileStorageConfigOptions = {
  filesystemRoot?: string | undefined;
  workingDirectory?: string | undefined;
};

const r2EnvironmentNames = ["R2_BASE_URL", "R2_ACCESS_KEY", "R2_SECRET_KEY"] as const;

function configuredValue(value: string | undefined) {
  return value?.trim() || undefined;
}

function parseR2BaseUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
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
  if (!bucket || bucket.includes("/"))
    throw new Error("R2_BASE_URL contains an invalid bucket name");
  return { bucket, endpoint: url.origin };
}

export function resolveFileStorageConfig(
  environment: FileStorageEnvironment = process.env,
  options: FileStorageConfigOptions = {},
): FileStorageConfig {
  const values = new Map(
    r2EnvironmentNames.map((name) => [name, configuredValue(environment[name])] as const),
  );
  const configuredCount = r2EnvironmentNames.filter((name) => values.get(name)).length;

  if (configuredCount === 0) {
    const workingDirectory = options.workingDirectory ?? process.cwd();
    const configuredRoot =
      options.filesystemRoot ??
      configuredValue(environment.FILE_STORAGE_DIRECTORY) ??
      "data/artifacts";
    return {
      backend: "filesystem",
      rootDirectory: resolve(workingDirectory, configuredRoot),
    };
  }

  if (configuredCount !== r2EnvironmentNames.length) {
    const missing = r2EnvironmentNames.filter((name) => !values.get(name));
    throw new Error(`Incomplete Cloudflare R2 configuration; missing ${missing.join(", ")}`);
  }

  const baseUrl = values.get("R2_BASE_URL");
  const accessKeyId = values.get("R2_ACCESS_KEY");
  const secretAccessKey = values.get("R2_SECRET_KEY");
  if (!baseUrl || !accessKeyId || !secretAccessKey)
    throw new Error("Incomplete Cloudflare R2 configuration");

  return {
    accessKeyId,
    backend: "r2",
    ...parseR2BaseUrl(baseUrl),
    secretAccessKey,
  };
}
