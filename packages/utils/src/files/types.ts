import type {
  DeleteObjectCommand,
  DeleteObjectCommandOutput,
  GetObjectCommand,
  GetObjectCommandOutput,
  PutObjectCommand,
  PutObjectCommandOutput,
} from "@aws-sdk/client-s3";

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

/** The S3 response for each command in `R2Command`; only the get response carries a body. */
export type R2CommandOutput =
  | DeleteObjectCommandOutput
  | GetObjectCommandOutput
  | PutObjectCommandOutput;

export interface R2ClientLike {
  send(command: R2Command, options?: { abortSignal?: AbortSignal }): Promise<R2CommandOutput>;
}
