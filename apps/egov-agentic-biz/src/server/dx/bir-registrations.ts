import { and, desc, eq } from "drizzle-orm";
import { createBirDemoTaxCalendar } from "@repo/dx/bir";
import { createBir2303FileMetadata } from "@/lib/form-generators/bir-2303";
import type { BusinessPlan } from "@/lib/questions";
import type {
  BusinessFile,
  BusinessRecord,
  RegisteredBusiness,
  RegisteredBusinessListItem,
  TaxObligation,
} from "@/lib/registered-business";
import { linkBusiness } from "@/server/conversations";
import { getDatabase, schema } from "@/server/db";
import { listBirArtifacts } from "@/server/dx/bir-artifacts";

type BirRegistrationRow = typeof schema.registeredBusinesses.$inferSelect;

export type FinalizeBirSelfEmployedRegistrationInput = {
  businessActivity: string;
  businessAddress: string;
  category: BusinessPlan["category"];
  city: string;
  conversationId: string;
  finalizedAt: string;
  name: string;
  ownerEgovUserId: string;
  rdo: string;
  tinMasked: string;
};

export type FinalizeBirSoleProprietorRegistrationInput = {
  business: RegisteredBusiness;
  finalizedAt: string;
  ownerEgovUserId: string;
};

function jsonArray<T>(value: string): T[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function filesFor(artifacts: Awaited<ReturnType<typeof listBirArtifacts>>): BusinessFile[] {
  return artifacts.map((artifact) => ({
    id: artifact.artifactId,
    title: `BIR Form ${artifact.formType}`,
    filename: `BIR-Form-${artifact.formType}.pdf`,
    documentType: "Prefilled registration form",
    status: "Generated",
    createdAt: artifact.createdAt,
    url: `/api/artifacts/bir-form/${encodeURIComponent(artifact.artifactId)}`,
    note: "Fetched from the owner-scoped DX BIR document store.",
    source: "DX",
  }));
}

function requireBir1901(artifacts: Awaited<ReturnType<typeof listBirArtifacts>>) {
  const form1901 = artifacts.find((artifact) => artifact.formType === "1901");
  if (!form1901) throw new Error("BIR Form 1901 was not found for this registration.");
  return form1901;
}

function filesWithCertificateOfRegistration(files: BusinessFile[], finalizedAt: string) {
  const byId = new Map(files.map((file) => [file.id, file]));
  const certificate = createBir2303FileMetadata(finalizedAt);
  byId.set(certificate.id, certificate);
  return [...byId.values()];
}

function birRegistrationRecord(
  registrationNumber: string,
  finalizedAt: string,
  title: string,
): BusinessRecord {
  return {
    id: `bir-registration-${registrationNumber}`,
    kind: "registration",
    agency: "Bureau of Internal Revenue",
    title,
    referenceNumber: registrationNumber,
    status: "Active",
    issuedAt: finalizedAt,
    validUntil: null,
    note: "Fetched from DX BIR after the required documentary stamp tax payment was verified.",
    source: "DX",
  };
}

function businessFromRow(row: BirRegistrationRow): RegisteredBusiness {
  return {
    id: row.id,
    conversationId: row.conversationId,
    name: row.name,
    type: row.type,
    category: row.category,
    registrationNumber: row.registrationNumber,
    status: row.status,
    ownerName: row.ownerName,
    businessActivity: row.businessActivity,
    businessAddress: row.businessAddress,
    city: row.city,
    rdo: row.rdo,
    tinMasked: row.tinMasked,
    finalizedAt: row.finalizedAt,
    records: jsonArray<BusinessRecord>(row.recordsJson),
    taxObligations: jsonArray<TaxObligation>(row.taxObligationsJson),
    files: jsonArray<BusinessFile>(row.filesJson),
  };
}

export function birRegistrationReference(artifactId: string) {
  return `BIR-1901-${artifactId.replaceAll("-", "").slice(0, 10).toUpperCase()}`;
}

export function createBirSelfEmployedBusinessRecord(
  input: FinalizeBirSelfEmployedRegistrationInput,
  artifacts: Awaited<ReturnType<typeof listBirArtifacts>>,
): RegisteredBusiness {
  const form1901 = requireBir1901(artifacts);
  const registrationNumber = birRegistrationReference(form1901.artifactId);
  return {
    id: `bir-${input.conversationId}`,
    conversationId: input.conversationId,
    name: input.name,
    type: "Self-employed",
    category: input.category,
    registrationNumber,
    status: "Active",
    ownerName: input.name,
    businessActivity: input.businessActivity,
    businessAddress: input.businessAddress,
    city: input.city,
    rdo: input.rdo,
    tinMasked: input.tinMasked,
    finalizedAt: input.finalizedAt,
    records: [
      birRegistrationRecord(
        registrationNumber,
        input.finalizedAt,
        "Self-Employed Taxpayer Registration",
      ),
    ],
    taxObligations: createBirDemoTaxCalendar({
      businessType: "Self-employed",
      asOf: new Date(input.finalizedAt),
    }),
    files: filesWithCertificateOfRegistration(filesFor(artifacts), input.finalizedAt),
  };
}

export function createBirSoleProprietorBusinessRecord(
  input: Pick<FinalizeBirSoleProprietorRegistrationInput, "business" | "finalizedAt">,
  artifacts: Awaited<ReturnType<typeof listBirArtifacts>>,
): RegisteredBusiness {
  if (input.business.type !== "Sole proprietor")
    throw new Error("A sole-proprietor business record is required.");
  const form1901 = requireBir1901(artifacts);
  const birReference = birRegistrationReference(form1901.artifactId);
  return {
    ...input.business,
    finalizedAt: input.finalizedAt,
    records: [
      ...input.business.records.filter(
        (record) =>
          !(record.kind === "registration" && record.agency === "Bureau of Internal Revenue"),
      ),
      birRegistrationRecord(birReference, input.finalizedAt, "Taxpayer Registration"),
    ],
    taxObligations: createBirDemoTaxCalendar({
      businessType: "Sole proprietor",
      asOf: new Date(input.finalizedAt),
    }),
    files: filesWithCertificateOfRegistration(
      [...input.business.files, ...filesFor(artifacts)],
      input.finalizedAt,
    ),
  };
}

async function saveBirRegisteredBusiness(ownerEgovUserId: string, business: RegisteredBusiness) {
  const database = await getDatabase();
  const [conversation] = await database
    .select({ id: schema.conversations.id })
    .from(schema.conversations)
    .where(
      and(
        eq(schema.conversations.id, business.conversationId),
        eq(schema.conversations.ownerEgovUserId, ownerEgovUserId),
      ),
    )
    .limit(1);
  if (!conversation) throw new Error("Conversation not found.");

  const now = new Date().toISOString();
  const values = {
    id: business.id,
    conversationId: business.conversationId,
    profileId: ownerEgovUserId,
    name: business.name,
    type: business.type,
    category: business.category,
    registrationNumber: business.registrationNumber,
    status: business.status,
    ownerName: business.ownerName,
    businessActivity: business.businessActivity,
    businessAddress: business.businessAddress,
    city: business.city,
    rdo: business.rdo,
    tinMasked: business.tinMasked,
    recordsJson: JSON.stringify(business.records),
    taxObligationsJson: JSON.stringify(business.taxObligations),
    filesJson: JSON.stringify(business.files),
    finalizedAt: business.finalizedAt,
    createdAt: now,
    updatedAt: now,
  };
  await database
    .insert(schema.registeredBusinesses)
    .values(values)
    .onConflictDoUpdate({
      target: schema.registeredBusinesses.conversationId,
      set: {
        name: values.name,
        type: values.type,
        category: values.category,
        registrationNumber: values.registrationNumber,
        status: values.status,
        ownerName: values.ownerName,
        businessActivity: values.businessActivity,
        businessAddress: values.businessAddress,
        city: values.city,
        rdo: values.rdo,
        tinMasked: values.tinMasked,
        recordsJson: values.recordsJson,
        taxObligationsJson: values.taxObligationsJson,
        filesJson: values.filesJson,
        finalizedAt: values.finalizedAt,
        updatedAt: values.updatedAt,
      },
    });
  await linkBusiness(ownerEgovUserId, business.conversationId, business.id);
  return getBirRegisteredBusiness(ownerEgovUserId, business.id);
}

export async function finalizeBirSelfEmployedRegistration(
  input: FinalizeBirSelfEmployedRegistrationInput,
) {
  const artifacts = await listBirArtifacts({
    conversationId: input.conversationId,
    ownerEgovUserId: input.ownerEgovUserId,
  });
  const business = createBirSelfEmployedBusinessRecord(input, artifacts);
  return saveBirRegisteredBusiness(input.ownerEgovUserId, business);
}

export async function finalizeBirSoleProprietorRegistration(
  input: FinalizeBirSoleProprietorRegistrationInput,
) {
  const artifacts = await listBirArtifacts({
    conversationId: input.business.conversationId,
    ownerEgovUserId: input.ownerEgovUserId,
  });
  return saveBirRegisteredBusiness(
    input.ownerEgovUserId,
    createBirSoleProprietorBusinessRecord(input, artifacts),
  );
}

export async function listBirRegisteredBusinesses(
  ownerEgovUserId: string,
): Promise<RegisteredBusinessListItem[]> {
  const database = await getDatabase();
  const rows = await database
    .select()
    .from(schema.registeredBusinesses)
    .where(eq(schema.registeredBusinesses.profileId, ownerEgovUserId))
    .orderBy(desc(schema.registeredBusinesses.finalizedAt));
  return rows.map((row) => {
    const business = businessFromRow(row);
    return {
      id: business.id,
      name: business.name,
      type: business.type,
      registrationNumber: business.registrationNumber,
      status: business.status,
      finalizedAt: business.finalizedAt,
      nextTaxDue: business.taxObligations[0]?.dueDate ?? null,
    };
  });
}

export async function getBirRegisteredBusiness(ownerEgovUserId: string, id: string) {
  const database = await getDatabase();
  const [row] = await database
    .select()
    .from(schema.registeredBusinesses)
    .where(
      and(
        eq(schema.registeredBusinesses.id, id),
        eq(schema.registeredBusinesses.profileId, ownerEgovUserId),
      ),
    )
    .limit(1);
  return row ? businessFromRow(row) : null;
}
