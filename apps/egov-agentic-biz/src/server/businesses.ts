import type { BnrsActor, BnrsCertificate, BnrsRegisteredBusiness } from "@repo/dx/bnrs";
import type { RegisteredBusiness, RegisteredBusinessListItem } from "@/lib/registered-business";
import { findConversationByBnrsApplication } from "@/server/conversations";
import { getBnrs } from "@/server/dx/bnrs";
import {
  getRegisteredBusiness as getLegacyBusiness,
  listRegisteredBusinesses as listLegacyBusinesses,
} from "@/server/registered-businesses";

type BusinessOwner = {
  actor: BnrsActor;
  legacyProfileId: string;
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

async function dxBusiness(
  owner: BusinessOwner,
  registration: BnrsRegisteredBusiness,
): Promise<RegisteredBusiness> {
  const certificate = await getBnrs().getCertificate({
    actor: owner.actor,
    certificateNumber: registration.certificateNumber,
  });
  const linked = await findConversationByBnrsApplication(registration.applicationId);
  return {
    id: registration.applicationId,
    conversationId:
      linked?.ownerEgovUserId === owner.actor.egovUserId
        ? linked.conversationId
        : registration.applicationId,
    name: certificate.businessName,
    type: "Sole proprietor",
    category: "general-services",
    registrationNumber: certificate.certificateNumber,
    status: "Active",
    ownerName: certificate.ownerName,
    businessActivity: certificate.descriptor,
    businessAddress: addressLabel(certificate),
    city: certificate.businessAddress.cityMunicipality,
    rdo: "",
    tinMasked: "",
    finalizedAt: certificate.issuedAt,
    records: [
      {
        id: `bnrs-${certificate.certificateNumber}`,
        kind: "registration",
        agency: certificate.issuingAgency,
        title: "Business Name Certificate",
        referenceNumber: certificate.certificateNumber,
        status: "Active",
        issuedAt: certificate.issuedAt,
        validUntil: certificate.validUntil,
        note: "Fetched directly from the DX BNRS service.",
        demo: true,
      },
    ],
    taxObligations: [],
    files: [],
  };
}

function isNonBnrsLegacyBusiness(business: { type: string }) {
  return business.type !== "Sole proprietor";
}

export async function listBusinesses(owner: BusinessOwner): Promise<RegisteredBusinessListItem[]> {
  const [registrations, legacyBusinesses] = await Promise.all([
    getBnrs().listRegisteredBusinesses({ actor: owner.actor }),
    listLegacyBusinesses(owner.legacyProfileId),
  ]);
  return [
    ...registrations.map((registration) => ({
      id: registration.applicationId,
      name: registration.businessName,
      type: "Sole proprietor",
      registrationNumber: registration.certificateNumber,
      status: "Active" as const,
      finalizedAt: registration.issuedAt,
      nextTaxDue: null,
    })),
    ...legacyBusinesses.filter(isNonBnrsLegacyBusiness),
  ].sort((left, right) => right.finalizedAt.localeCompare(left.finalizedAt));
}

export async function getBusiness(owner: BusinessOwner, id: string) {
  const registration = (await getBnrs().listRegisteredBusinesses({ actor: owner.actor })).find(
    ({ applicationId }) => applicationId === id,
  );
  if (registration) return dxBusiness(owner, registration);

  const legacy = await getLegacyBusiness(owner.legacyProfileId, id);
  return legacy && isNonBnrsLegacyBusiness(legacy) ? legacy : null;
}
