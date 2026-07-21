import { resolve } from "node:path";
import { bir1901TemplatePath, writeBir1901Pdf } from "@/lib/bir-form/generator";
import {
  completeEgovSsoTestProfile,
  mapEgovProfileToBir1901,
  type Bir1901ProfileInput,
} from "@/lib/bir-form/profile";

const appDirectory = resolve(import.meta.dir, "..");
const repositoryDirectory = resolve(appDirectory, "../..");
const defaultOutput = resolve(repositoryDirectory, "output/pdf/bir-form-1901-simple-test-user.pdf");
const completeFixtureOutput = resolve(
  repositoryDirectory,
  "output/pdf/bir-form-1901-complete-test-user.pdf",
);

function argumentValue(name: string, fallback: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1]! : fallback;
}

const simpleFixture: Bir1901ProfileInput = {
  address: "1 Example Street, Sample Barangay, Quezon City, Metro Manila, 1100",
  addressLine2: "",
  barangay: "Sample Barangay",
  birthDate: "1990-01-23",
  birthPlace: "",
  city: "Quezon City",
  civilStatus: "",
  email: "juan@example.test",
  fatherName: "",
  firstName: "Juan",
  foreignAddress: "",
  fullName: "Juan Santos Dela Cruz",
  gender: "Male",
  lastName: "Dela Cruz",
  middleName: "Santos",
  mobile: "+639000000000",
  motherMaidenName: "",
  nationalIdPcn: "",
  nationality: "Filipino",
  passportExpiryDate: "",
  passportIssuedDate: "",
  passportNumber: "",
  passportPlaceIssued: "",
  postal: "1100",
  province: "Metro Manila",
  signatureSource: "",
  street: "1 Example Street",
  suffix: "",
  tin: "",
};

const complete = process.argv.includes("--complete-fixture");
const fixture = process.argv.includes("--fixture");
if (!complete && !fixture)
  throw new Error("Choose --fixture or --complete-fixture when running the generator script");

const outputPath = argumentValue("--output", complete ? completeFixtureOutput : defaultOutput);
const profile = complete ? mapEgovProfileToBir1901(completeEgovSsoTestProfile) : simpleFixture;
const result = await writeBir1901Pdf(
  profile,
  argumentValue("--template", bir1901TemplatePath()),
  outputPath,
);
console.info(`Generated ${result.pageCount}-page fixture at ${result.outputPath}`);
