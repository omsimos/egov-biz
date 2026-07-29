import type { EgovSsoCitizenProfile } from "@repo/egov/eGovSso";
import type { BnrsCertificate } from "@repo/dx/bnrs";
import { LguError, mapEgovSsoProfileToLguApplicantInformation, type LguActor } from "@repo/dx/lgu";
import {
  findConversationByLguApplication,
  getLguConversationLink,
  linkLguApplication,
  linkLguPayment,
} from "@/server/conversations";
import { getLgu } from "@/server/dx/lgu";

export async function prepareLguApplication(input: {
  actor: LguActor;
  certificate: BnrsCertificate;
  conversationId: string;
  ownerProfile: EgovSsoCitizenProfile;
}) {
  const lgu = getLgu();
  const linked = await getLguConversationLink(input.actor.egovUserId, input.conversationId);
  if (!linked) throw new Error("Conversation not found.");
  if (linked.applicationId)
    return lgu.getStatus({ actor: input.actor, applicationId: linked.applicationId });

  const status = await lgu.startOrResumeApplication({
    actor: input.actor,
    applicant: mapEgovSsoProfileToLguApplicantInformation(input.ownerProfile),
    certificate: input.certificate,
  });
  const existingConversation = await findConversationByLguApplication(status.applicationId);
  if (existingConversation && existingConversation.conversationId !== input.conversationId)
    throw new Error("Continue the existing conversation for this active LGU application.");
  await linkLguApplication(input.actor.egovUserId, input.conversationId, status.applicationId);
  return status;
}

export async function createLguCheckout(input: {
  actor: LguActor;
  callbackUrl: string;
  conversationId: string;
  redirectUrl: string;
}) {
  const linked = await getLguConversationLink(input.actor.egovUserId, input.conversationId);
  if (!linked?.applicationId)
    throw new LguError("PAYMENT_NOT_READY", "The LGU application is not ready for payment.");
  const checkout = await getLgu().createPayment({
    actor: input.actor,
    applicationId: linked.applicationId,
    callbackUrl: input.callbackUrl,
    redirectUrl: input.redirectUrl,
  });
  await linkLguPayment(input.actor.egovUserId, input.conversationId, checkout.transactionUuid);
  return checkout;
}

export async function syncLguPaymentForConversation(input: {
  actor: LguActor;
  conversationId: string;
}) {
  const linked = await getLguConversationLink(input.actor.egovUserId, input.conversationId);
  if (!linked?.transactionUuid || !linked.applicationId)
    throw new LguError("PAYMENT_NOT_FOUND", "The LGU payment was not found.");
  const result = await getLgu().syncPaymentStatus({ transactionUuid: linked.transactionUuid });
  if (result.status.applicationId !== linked.applicationId)
    throw new Error("The LGU payment does not belong to this conversation.");
  return result;
}

export async function getLguStatusForConversation(input: {
  actor: LguActor;
  conversationId: string;
}) {
  const linked = await getLguConversationLink(input.actor.egovUserId, input.conversationId);
  return linked?.applicationId
    ? getLgu().getStatus({ actor: input.actor, applicationId: linked.applicationId })
    : null;
}

export async function getLguDocumentsForConversation(input: {
  actor: LguActor;
  conversationId: string;
}) {
  const linked = await getLguConversationLink(input.actor.egovUserId, input.conversationId);
  if (!linked?.applicationId) return null;
  try {
    return await getLgu().getIssuedDocuments({
      actor: input.actor,
      applicationId: linked.applicationId,
    });
  } catch (error) {
    if (error instanceof LguError && error.code === "ISSUED_DOCUMENTS_NOT_FOUND") return null;
    throw error;
  }
}
