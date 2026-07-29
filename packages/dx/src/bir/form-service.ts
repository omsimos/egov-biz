import { createHash, randomUUID } from "node:crypto";

import type { FileStorage, FileTransferOptions, StoredFile } from "@repo/utils/files";
import {
  generateBir1901Pdf,
  generateBir1905Pdf,
  generateBirFormInputSchema,
} from "@repo/utils/bir-form";

import { BirError } from "./errors.js";
import type {
  BirActor,
  BirFormArtifact,
  BirFormTemplatePaths,
  BirFormType,
  FillOutAndSaveBirFormInput,
  GetSavedBirFormInput,
  SavedBirForm,
} from "./types.js";

const PDF_MEDIA_TYPE = "application/pdf" as const;
const artifactIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type BirFormServiceOptions = {
  generateId?: (() => string) | undefined;
  storage: FileStorage;
  templatePaths: BirFormTemplatePaths;
};

function validateActor(actor: BirActor) {
  const egovUserId = actor.egovUserId.normalize("NFKC").trim();
  if (!egovUserId) throw new BirError("INVALID_ACTOR", "An authenticated eGov user is required.");
  return egovUserId;
}

function ownerHash(egovUserId: string) {
  return createHash("sha256").update(egovUserId).digest("hex");
}

function artifactKey(egovUserId: string, artifactId: string) {
  return `bir/${ownerHash(egovUserId)}/${artifactId}.pdf`;
}

function filename(formType: BirFormType): BirFormArtifact["filename"] {
  return formType === "1905" ? "BIR-Form-1905.pdf" : "BIR-Form-1901.pdf";
}

function fileTransferOptions(signal: AbortSignal | undefined): FileTransferOptions {
  return signal ? { signal } : {};
}

function validateTemplatePath(value: string, formType: BirFormType) {
  const path = value.trim();
  if (!path)
    throw new BirError(
      "INVALID_CONFIGURATION",
      `A BIR Form ${formType} PDF template path is required.`,
    );
  return path;
}

function validateGeneratedArtifactId(value: string) {
  if (!artifactIdPattern.test(value))
    throw new BirError(
      "INVALID_CONFIGURATION",
      "The BIR artifact ID generator must return a UUID.",
    );
  return value;
}

function storedFormType(stored: StoredFile): BirFormType {
  const formType = stored.metadata["form-type"];
  if (formType !== "1901" && formType !== "1905")
    throw new BirError("INVALID_STORED_FORM", "The saved BIR form type is invalid.");
  return formType;
}

function storedPageCount(stored: StoredFile) {
  const pageCount = Number(stored.metadata["page-count"]);
  if (!Number.isSafeInteger(pageCount) || pageCount < 1)
    throw new BirError("INVALID_STORED_FORM", "The saved BIR form page count is invalid.");
  return pageCount;
}

function savedForm(artifactId: string, stored: StoredFile): SavedBirForm {
  if (stored.contentType !== PDF_MEDIA_TYPE)
    throw new BirError("INVALID_STORED_FORM", "The saved BIR form media type is invalid.");
  const formType = storedFormType(stored);
  return {
    artifactId,
    bytes: stored.bytes,
    filename: filename(formType),
    formType,
    mediaType: PDF_MEDIA_TYPE,
    pageCount: storedPageCount(stored),
    size: stored.size,
  };
}

export function createBirFormService(options: BirFormServiceOptions) {
  const generateId = options.generateId ?? randomUUID;
  const templatePaths = {
    "1901": validateTemplatePath(options.templatePaths["1901"], "1901"),
    "1905": validateTemplatePath(options.templatePaths["1905"], "1905"),
  } satisfies BirFormTemplatePaths;

  async function fillOutAndSaveForm(input: FillOutAndSaveBirFormInput): Promise<BirFormArtifact> {
    const egovUserId = validateActor(input.actor);
    input.signal?.throwIfAborted();
    const parsed = generateBirFormInputSchema.safeParse(input.form);
    if (!parsed.success)
      throw new BirError("INVALID_FORM_DATA", "The BIR form data is invalid.", {
        issues: parsed.error.issues.map(({ code, message, path }) => ({ code, message, path })),
      });

    const artifactId = validateGeneratedArtifactId(generateId());
    const generated =
      parsed.data.type === "1901"
        ? await generateBir1901Pdf(parsed.data.data, templatePaths["1901"])
        : await generateBir1905Pdf(parsed.data.data, templatePaths["1905"]);
    input.signal?.throwIfAborted();
    const reference = await options.storage.put(
      {
        bytes: generated.bytes,
        contentType: PDF_MEDIA_TYPE,
        key: artifactKey(egovUserId, artifactId),
        metadata: {
          "form-type": parsed.data.type,
          "page-count": String(generated.pageCount),
        },
      },
      fileTransferOptions(input.signal),
    );

    return {
      artifactId,
      filename: filename(parsed.data.type),
      formType: parsed.data.type,
      mediaType: PDF_MEDIA_TYPE,
      pageCount: generated.pageCount,
      size: reference.size,
    };
  }

  async function getSavedForm(input: GetSavedBirFormInput): Promise<SavedBirForm> {
    const egovUserId = validateActor(input.actor);
    if (!artifactIdPattern.test(input.artifactId))
      throw new BirError("FORM_NOT_FOUND", "The BIR form was not found.");
    const stored = await options.storage.get(
      artifactKey(egovUserId, input.artifactId),
      fileTransferOptions(input.signal),
    );
    if (!stored) throw new BirError("FORM_NOT_FOUND", "The BIR form was not found.");
    return savedForm(input.artifactId, stored);
  }

  return { fillOutAndSaveForm, getSavedForm };
}

export type BirFormService = ReturnType<typeof createBirFormService>;
