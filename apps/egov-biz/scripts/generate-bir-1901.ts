import { resolve } from "node:path";
import { bir1901TemplatePath, writeBir1901Pdf, type Bir1901Data } from "@omsimos/utils/bir-form";
import { completeEgovSsoTestProfile, mapEgovProfileToBir1901 } from "@/lib/bir-form/profile";

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

const simpleFixture: Bir1901Data = {
  taxpayerInformation: {
    taxpayerName: {
      firstName: "Juan",
      middleName: "Santos",
      lastName: "Dela Cruz",
    },
    birthOrOrganizationDate: "1990-01-23",
    citizenship: "Filipino",
    localResidenceAddress: {
      lotBlockPhaseHouseNo: "1",
      streetName: "Example Street",
      barangay: "Sample Barangay",
      municipalityCity: "Quezon City",
      province: "Metro Manila",
      zipCode: "1100",
    },
    contact: {
      preferredTypes: ["mobile"],
      mobile: "+639000000000",
      email: "juan@example.test",
    },
  },
  paymentOrder: {
    taxpayerName: "Juan Santos Dela Cruz",
  },
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
