import type { EgovSsoCitizenProfile } from "egov.js";
import {
  BnrsError,
  mapEgovSsoProfileToBnrsOwnerInformation,
  type BnrsActor,
  type BnrsBusinessAddressInput,
  type BnrsBusinessScopeId,
} from "@repo/dx/bnrs";
import {
  findConversationByBnrsApplication,
  getBnrsConversationLink,
  linkBnrsApplication,
  linkBnrsCertificateByApplication,
  linkBnrsPayment,
} from "@/server/conversations";
import { getBnrs } from "@/server/dx/bnrs";

export async function prepareBnrsApplication(input: {
  actor: BnrsActor;
  address: BnrsBusinessAddressInput;
  conversationId: string;
  descriptorId: string;
  dominantName: string;
  ownerProfile: EgovSsoCitizenProfile;
  scopeId: BnrsBusinessScopeId;
  termsAccepted: boolean;
}) {
  if (!input.termsAccepted) throw new Error("Accept the BNRS terms before continuing.");
  const bnrs = getBnrs();
  const linked = await getBnrsConversationLink(input.actor.egovUserId, input.conversationId);
  if (!linked) throw new Error("Conversation not found.");

  let status = linked.applicationId
    ? await bnrs.getStatus({ actor: input.actor, applicationId: linked.applicationId })
    : await bnrs.startOrResumeApplication({ actor: input.actor });

  if (!linked.applicationId) {
    const existingConversation = await findConversationByBnrsApplication(status.applicationId);
    if (existingConversation && existingConversation.conversationId !== input.conversationId)
      throw new Error("Continue the existing conversation for this active BNRS application.");
    await linkBnrsApplication(input.actor.egovUserId, input.conversationId, status.applicationId);
  }

  if (!status.completedSteps.includes("TERMS_AND_CONDITIONS"))
    status = await bnrs.acceptTermsAndConditions({
      actor: input.actor,
      applicationId: status.applicationId,
    });
  if (!status.completedSteps.includes("OWNER_INFORMATION"))
    status = await bnrs.setOwnerInformation({
      actor: input.actor,
      applicationId: status.applicationId,
      owner: mapEgovSsoProfileToBnrsOwnerInformation(input.ownerProfile),
    });

  status = await bnrs.setBusinessName({
    actor: input.actor,
    applicationId: status.applicationId,
    descriptorId: input.descriptorId,
    dominantName: input.dominantName,
  });
  status = await bnrs.setBusinessScope({
    actor: input.actor,
    applicationId: status.applicationId,
    scopeId: input.scopeId,
  });
  return bnrs.setBusinessAddress({
    actor: input.actor,
    address: input.address,
    applicationId: status.applicationId,
  });
}

export async function createBnrsCheckout(input: {
  actor: BnrsActor;
  callbackUrl: string;
  conversationId: string;
  redirectUrl: string;
}) {
  const linked = await getBnrsConversationLink(input.actor.egovUserId, input.conversationId);
  if (!linked?.applicationId)
    throw new BnrsError("PAYMENT_NOT_READY", "The BNRS application is not ready for payment.");
  const checkout = await getBnrs().createPayment({
    actor: input.actor,
    applicationId: linked.applicationId,
    callbackUrl: input.callbackUrl,
    redirectUrl: input.redirectUrl,
  });
  await linkBnrsPayment(input.actor.egovUserId, input.conversationId, checkout.transactionUuid);
  return checkout;
}

export async function syncBnrsPaymentForConversation(input: {
  actor: BnrsActor;
  conversationId: string;
}) {
  const linked = await getBnrsConversationLink(input.actor.egovUserId, input.conversationId);
  if (!linked?.transactionUuid)
    throw new BnrsError("PAYMENT_NOT_FOUND", "The BNRS payment was not found.");
  const result = await getBnrs().syncPaymentStatus({ transactionUuid: linked.transactionUuid });
  if (result.status.applicationId !== linked.applicationId)
    throw new Error("The BNRS payment does not belong to this conversation.");
  if (result.registration)
    await linkBnrsCertificateByApplication(
      result.status.applicationId,
      result.registration.certificateNumber,
    );
  return result;
}

export async function getBnrsCertificateForConversation(input: {
  actor: BnrsActor;
  conversationId: string;
}) {
  const linked = await getBnrsConversationLink(input.actor.egovUserId, input.conversationId);
  if (!linked?.applicationId) return null;
  let certificateNumber = linked.certificateNumber;
  if (!certificateNumber) {
    const registration = (await getBnrs().listRegisteredBusinesses({ actor: input.actor })).find(
      ({ applicationId }) => applicationId === linked.applicationId,
    );
    certificateNumber = registration?.certificateNumber ?? null;
    if (certificateNumber)
      await linkBnrsCertificateByApplication(linked.applicationId, certificateNumber);
  }
  return certificateNumber
    ? getBnrs().getCertificate({ actor: input.actor, certificateNumber })
    : null;
}
