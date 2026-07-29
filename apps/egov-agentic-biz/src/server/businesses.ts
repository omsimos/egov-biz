import type { BnrsActor, BnrsCertificate, BnrsRegisteredBusiness } from "@repo/dx/bnrs";
import type { LguIssuedDocuments } from "@repo/dx/lgu";
import { inferCategory } from "@/lib/business-rules";
import type {
  BusinessFile,
  BusinessRecord,
  RegisteredBusiness,
  RegisteredBusinessListItem,
} from "@/lib/registered-business";
import { findConversationByBnrsApplication } from "@/server/conversations";
import { listBirArtifacts } from "@/server/dx/bir-artifacts";
import { getBnrs } from "@/server/dx/bnrs";
import { getLgu } from "@/server/dx/lgu";

type BusinessOwner = {
  actor: BnrsActor;
};

function addressLabel(certificate: BnrsCertificate) {
  const address = certificate.businessAddress;
  return [
    address.addressLine1,
    address.addressLine2,
    address.barangay,
    address.cityMunicipality,
    address.province,
    address.region,
    address.postalCode,
  ]
    .filter(Boolean)
    .join(", ");
}

function maskedTin(tin?: string) {
  if (!tin) return "";
  return `${"•".repeat(Math.max(0, tin.length - 4))}${tin.slice(-4)}`;
}

function recordsFor(certificate: BnrsCertificate, documents: LguIssuedDocuments | null) {
  const records: BusinessRecord[] = [
    {
      id: `bnrs-${certificate.certificateNumber}`,
      kind: "registration",
      agency: certificate.issuingAgency,
      title: "Business Name Certificate",
      referenceNumber: certificate.certificateNumber,
      status: "Active",
      issuedAt: certificate.issuedAt,
      validUntil: certificate.validUntil,
      note: "Fetched from the DX BNRS service.",
      source: "DX",
    },
  ];
  if (!documents) return records;
  records.push(
    {
      id: `lgu-permit-${documents.applicationId}`,
      kind: "permit",
      agency: documents.businessPermit.issuingLgu,
      title: "Business Permit",
      referenceNumber: documents.businessPermit.permitNumber,
      status: "Active",
      issuedAt: documents.businessPermit.issuedAt,
      validUntil: documents.businessPermit.validUntil,
      note: "Issued by the combined DX LGU permit flow.",
      source: "DX",
    },
    {
      id: `lgu-clearance-${documents.applicationId}`,
      kind: "permit",
      agency: documents.barangayClearance.issuingLgu,
      title: "Barangay Business Clearance",
      referenceNumber: documents.barangayClearance.clearanceNumber,
      status: "Issued",
      issuedAt: documents.barangayClearance.issuedAt,
      validUntil: documents.barangayClearance.validUntil,
      note: "Issued with the business permit; its fee is included in the LGU assessment.",
      source: "DX",
    },
  );
  return records;
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
    note: "Stored by the DX BIR service. Form generation does not mean BIR registration is complete.",
    source: "DX",
  }));
}

async function dxBusiness(
  owner: BusinessOwner,
  registration: BnrsRegisteredBusiness,
): Promise<RegisteredBusiness> {
  const [certificate, linked, issuedDocuments] = await Promise.all([
    getBnrs().getCertificate({
      actor: owner.actor,
      certificateNumber: registration.certificateNumber,
    }),
    findConversationByBnrsApplication(registration.applicationId),
    getLgu().listIssuedDocuments({ actor: owner.actor }),
  ]);
  const conversationId =
    linked?.ownerEgovUserId === owner.actor.egovUserId ? linked.conversationId : null;
  const documents =
    issuedDocuments.find(
      ({ businessPermit }) =>
        businessPermit.bnrsCertificateNumber === certificate.certificateNumber,
    ) ?? null;
  const artifacts = conversationId
    ? await listBirArtifacts({
        conversationId,
        ownerEgovUserId: owner.actor.egovUserId,
      })
    : [];
  const { category } = inferCategory(certificate.descriptor);
  const tin = documents?.businessPermit.tin;
  return {
    id: registration.applicationId,
    conversationId: conversationId ?? registration.applicationId,
    name: certificate.businessName,
    type: "Sole proprietor",
    category,
    registrationNumber: certificate.certificateNumber,
    status: "Active",
    ownerName: certificate.ownerName,
    businessActivity: certificate.descriptor,
    businessAddress: addressLabel(certificate),
    city: certificate.businessAddress.cityMunicipality,
    rdo: "",
    tinMasked: maskedTin(tin),
    finalizedAt: documents?.businessPermit.issuedAt ?? certificate.issuedAt,
    records: recordsFor(certificate, documents),
    taxObligations: [],
    files: filesFor(artifacts),
  };
}

export async function listBusinesses(owner: BusinessOwner): Promise<RegisteredBusinessListItem[]> {
  const registrations = await getBnrs().listRegisteredBusinesses({ actor: owner.actor });
  return registrations
    .map((registration) => ({
      id: registration.applicationId,
      name: registration.businessName,
      type: "Sole proprietor",
      registrationNumber: registration.certificateNumber,
      status: "Active" as const,
      finalizedAt: registration.issuedAt,
      nextTaxDue: null,
    }))
    .sort((left, right) => right.finalizedAt.localeCompare(left.finalizedAt));
}

export async function getBusiness(owner: BusinessOwner, id: string) {
  const registration = (await getBnrs().listRegisteredBusinesses({ actor: owner.actor })).find(
    ({ applicationId }) => applicationId === id,
  );
  return registration ? dxBusiness(owner, registration) : null;
}
