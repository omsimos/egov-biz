import type { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";

export type FileStorageMetadata = Readonly<Record<string, string>>;

export type PutFileInput = {
  bytes: Uint8Array;
  contentType: string;
  key: string;
  metadata?: FileStorageMetadata;
};

export type StoredFile = {
  bytes: Uint8Array;
  contentType: string;
  key: string;
  metadata: Record<string, string>;
  size: number;
};

export type StoredFileReference = {
  key: string;
  size: number;
};

export type FileTransferOptions = {
  signal?: AbortSignal;
};

export interface FileStorage {
  readonly backend: "filesystem" | "r2";
  delete(key: string, options?: FileTransferOptions): Promise<void>;
  get(key: string, options?: FileTransferOptions): Promise<StoredFile | undefined>;
  put(input: PutFileInput, options?: FileTransferOptions): Promise<StoredFileReference>;
}

export type R2Command = DeleteObjectCommand | GetObjectCommand | PutObjectCommand;

export interface R2ClientLike {
  send(command: R2Command, options?: { abortSignal?: AbortSignal }): Promise<unknown>;
}
