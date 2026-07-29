export {
  bir1901TemplatePath,
  DEFAULT_BIR_1901_TEMPLATE,
  generateBir1901Pdf,
  writeBir1901Pdf,
} from "./generator.js";
export {
  bir1905TemplatePath,
  DEFAULT_BIR_1905_TEMPLATE,
  generateBir1905Pdf,
} from "./generator-1905.js";
export {
  bir1901DataSchema,
  bir1901FormInputSchema,
  bir1905DataSchema,
  bir1905FormInputSchema,
  generateBirFormInputSchema,
} from "./schema.js";
export type {
  Bir1901Data,
  Bir1901FormInput,
  Bir1905Data,
  Bir1905FormInput,
  GenerateBirFormInput,
} from "./schema.js";
