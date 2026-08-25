import type { GenerateBirFormInput } from "@omsimos/utils/bir-form";

export type BirActor = {
  egovUserId: string;
};

export type BirFormType = GenerateBirFormInput["type"];

export type BirFormTemplatePaths = Readonly<Record<BirFormType, string>>;

export type BirFormArtifact = {
  artifactId: string;
  filename: "BIR-Form-1901.pdf" | "BIR-Form-1905.pdf";
  formType: BirFormType;
  mediaType: "application/pdf";
  pageCount: number;
  size: number;
};

export type SavedBirForm = BirFormArtifact & {
  bytes: Uint8Array;
};

export type FillOutAndSaveBirFormInput = {
  actor: BirActor;
  form: GenerateBirFormInput;
  signal?: AbortSignal;
};

export type GetSavedBirFormInput = {
  actor: BirActor;
  artifactId: string;
  signal?: AbortSignal;
};
