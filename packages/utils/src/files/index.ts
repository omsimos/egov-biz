import { resolveFileStorageConfig, type FileStorageEnvironment } from "./config.js";
import { FilesystemFileStorage } from "./filesystem.js";
import { R2FileStorage } from "./r2.js";
import type { FileStorage, R2ClientLike } from "./types.js";

export type CreateFileStorageOptions = {
  environment?: FileStorageEnvironment | undefined;
  filesystemRoot?: string | undefined;
  r2Client?: R2ClientLike | undefined;
  workingDirectory?: string | undefined;
};

export function createFileStorage(options: CreateFileStorageOptions = {}): FileStorage {
  const config = resolveFileStorageConfig(options.environment, {
    filesystemRoot: options.filesystemRoot,
    workingDirectory: options.workingDirectory,
  });
  return config.backend === "r2"
    ? new R2FileStorage(config, options.r2Client)
    : new FilesystemFileStorage(config);
}

export {
  resolveFileStorageConfig,
  type FileStorageConfig,
  type FileStorageConfigOptions,
  type FileStorageEnvironment,
  type FilesystemStorageConfig,
  type R2StorageConfig,
} from "./config.js";
export { FilesystemFileStorage } from "./filesystem.js";
export { R2FileStorage } from "./r2.js";
export type {
  FileStorage,
  FileStorageMetadata,
  FileTransferOptions,
  PutFileInput,
  R2ClientLike,
  StoredFile,
  StoredFileReference,
} from "./types.js";
export { normalizeFileKey } from "./validation.js";
