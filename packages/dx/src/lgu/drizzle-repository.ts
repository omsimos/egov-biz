import type { Database } from "@repo/db";
import { lguApplicantInformation, lguApplications, lguPayments } from "@repo/db/schema";
import { and, desc, eq, inArray, ne } from "drizzle-orm";

import { databaseErrorContains } from "../drizzle-errors.js";
import {
  LguRepositoryConflict,
  type LguApplicationAggregate,
  type LguApplicationRecord,
  type LguApplicantInformationRecord,
  type LguRepository,
} from "./repository.js";

function applicationRecord(row: typeof lguApplications.$inferSelect): LguApplicationRecord {
  return {
    ...row,
    certificateIssuingAgency: "DTI-BNRS",
    certificateStatus: "REGISTERED",
  };
}

function applicantRecord(
  row: typeof lguApplicantInformation.$inferSelect,
): LguApplicantInformationRecord {
  return {
    ownerName: row.ownerName,
    normalizedOwnerName: row.normalizedOwnerName,
    ...(row.tin === null ? {} : { tin: row.tin }),
  };
}

class LguTransitionRollback extends Error {}

export function createDrizzleLguRepository(database: Database): LguRepository {
  async function findMatchingApplication(input: {
    egovUserId: string;
    certificateNumber: string;
    normalizedCity: string;
  }): Promise<LguApplicationAggregate | null> {
    const [application] = await database
      .select()
      .from(lguApplications)
      .where(
        and(
          eq(lguApplications.egovUserId, input.egovUserId),
          eq(lguApplications.certificateNumber, input.certificateNumber),
          eq(lguApplications.normalizedCity, input.normalizedCity),
          ne(lguApplications.state, "ABANDONED"),
        ),
      )
      .orderBy(desc(lguApplications.createdAt))
      .limit(1);
    if (!application) return null;
    const [applicant] = await database
      .select()
      .from(lguApplicantInformation)
      .where(eq(lguApplicantInformation.applicationId, application.id))
      .limit(1);
    if (!applicant) throw new Error("LGU application has no applicant-information row.");
    return {
      application: applicationRecord(application),
      applicant: applicantRecord(applicant),
    };
  }

  async function findLatestPayment(applicationId: string) {
    const [application] = await database
      .select({ latestPaymentId: lguApplications.latestPaymentId })
      .from(lguApplications)
      .where(eq(lguApplications.id, applicationId))
      .limit(1);
    if (!application?.latestPaymentId) return null;
    const [payment] = await database
      .select()
      .from(lguPayments)
      .where(eq(lguPayments.id, application.latestPaymentId))
      .limit(1);
    return payment ?? null;
  }

  return {
    async startOrResumeApplication(input) {
      const lookup = {
        egovUserId: input.egovUserId,
        certificateNumber: input.certificate.certificateNumber,
        normalizedCity: input.normalizedCity,
      };
      const existing = await findMatchingApplication(lookup);
      if (existing) return existing;

      try {
        return await database.transaction(async (transaction) => {
          const [application] = await transaction
            .insert(lguApplications)
            .values({
              egovUserId: input.egovUserId,
              city: input.city,
              normalizedCity: input.normalizedCity,
              businessAddressLine1: input.certificate.businessAddress.addressLine1,
              businessAddressLine2: input.certificate.businessAddress.addressLine2,
              businessBarangay: input.certificate.businessAddress.barangay,
              businessProvince: input.certificate.businessAddress.province,
              businessRegion: input.certificate.businessAddress.region,
              businessPostalCode: input.certificate.businessAddress.postalCode,
              certificateNumber: input.certificate.certificateNumber,
              certificateIssuingAgency: input.certificate.issuingAgency,
              certificateStatus: input.certificate.status,
              certificateBusinessName: input.certificate.businessName,
              certificateOwnerName: input.certificate.ownerName,
              certificateDescriptor: input.certificate.descriptor,
              certificateTerritorialScope: input.certificate.territorialScope,
              certificateIssuedAt: input.certificate.issuedAt,
              certificateValidUntil: input.certificate.validUntil,
              createdAt: input.now,
              updatedAt: input.now,
            })
            .returning();
          if (!application) throw new Error("LGU application insert returned no row.");
          const [applicant] = await transaction
            .insert(lguApplicantInformation)
            .values({
              applicationId: application.id,
              ownerName: input.applicant.ownerName,
              normalizedOwnerName: input.applicant.normalizedOwnerName,
              tin: input.applicant.tin,
              createdAt: input.now,
              updatedAt: input.now,
            })
            .returning();
          if (!applicant) throw new Error("LGU applicant insert returned no row.");
          return {
            application: applicationRecord(application),
            applicant: applicantRecord(applicant),
          };
        });
      } catch (error) {
        const raced = await findMatchingApplication(lookup);
        if (raced) return raced;
        throw error;
      }
    },
    async getApplication(applicationId) {
      const [application] = await database
        .select()
        .from(lguApplications)
        .where(eq(lguApplications.id, applicationId))
        .limit(1);
      return application ? applicationRecord(application) : null;
    },
    async getApplicantInformation(applicationId) {
      const [applicant] = await database
        .select()
        .from(lguApplicantInformation)
        .where(eq(lguApplicantInformation.applicationId, applicationId))
        .limit(1);
      return applicant ? applicantRecord(applicant) : null;
    },
    async listCompletedApplications(egovUserId) {
      const applications = await database
        .select()
        .from(lguApplications)
        .where(
          and(eq(lguApplications.egovUserId, egovUserId), eq(lguApplications.state, "COMPLETED")),
        )
        .orderBy(desc(lguApplications.documentsIssuedAt), desc(lguApplications.createdAt));
      return applications.map(applicationRecord);
    },
    async updateApplication(input) {
      const [updated] = await database
        .update(lguApplications)
        .set({ ...input.patch, updatedAt: input.now })
        .where(
          and(
            eq(lguApplications.id, input.applicationId),
            eq(lguApplications.egovUserId, input.egovUserId),
            inArray(lguApplications.state, [...input.expectedStates]),
          ),
        )
        .returning();
      return updated ? applicationRecord(updated) : null;
    },
    async getLatestPayment(applicationId) {
      return findLatestPayment(applicationId);
    },
    async getCurrentPayment(applicationId) {
      const payment = await findLatestPayment(applicationId);
      return payment && (payment.status === "CREATING" || payment.status === "PENDING")
        ? payment
        : null;
    },
    async getPaymentByTransactionUuid(transactionUuid) {
      const [payment] = await database
        .select()
        .from(lguPayments)
        .where(eq(lguPayments.transactionUuid, transactionUuid))
        .limit(1);
      return payment ?? null;
    },
    async getPaymentByTransactionId(transactionId) {
      const [payment] = await database
        .select()
        .from(lguPayments)
        .where(eq(lguPayments.transactionId, transactionId))
        .limit(1);
      return payment ?? null;
    },
    async beginPayment(input) {
      try {
        return await database.transaction(async (transaction) => {
          const [reservedApplication] = await transaction
            .update(lguApplications)
            .set({ state: "PAYMENT_PENDING", updatedAt: input.now })
            .where(
              and(
                eq(lguApplications.id, input.applicationId),
                eq(lguApplications.egovUserId, input.egovUserId),
                eq(lguApplications.state, "PAYMENT_READY"),
              ),
            )
            .returning();
          if (!reservedApplication) return null;

          const [payment] = await transaction
            .insert(lguPayments)
            .values({
              applicationId: input.applicationId,
              status: "CREATING",
              transactionId: input.transactionId,
              amount: input.amount,
              currency: input.currency,
              providerCallbackUrl: input.providerCallbackUrl,
              providerRedirectUrl: input.providerRedirectUrl,
              createdAt: input.now,
              updatedAt: input.now,
            })
            .returning();
          if (!payment) throw new Error("LGU payment insert returned no row.");
          const [application] = await transaction
            .update(lguApplications)
            .set({ latestPaymentId: payment.id, updatedAt: input.now })
            .where(
              and(
                eq(lguApplications.id, input.applicationId),
                eq(lguApplications.state, "PAYMENT_PENDING"),
              ),
            )
            .returning();
          if (!application) throw new LguTransitionRollback();
          return {
            application: applicationRecord(application),
            payment,
          };
        });
      } catch (error) {
        if (databaseErrorContains(error, "lgu_payments.application_id"))
          throw new LguRepositoryConflict("PAYMENT_IN_PROGRESS");
        throw error;
      }
    },
    activatePayment(input) {
      return database.transaction(async (transaction) => {
        const [application] = await transaction
          .select({ id: lguApplications.id })
          .from(lguApplications)
          .where(
            and(
              eq(lguApplications.latestPaymentId, input.paymentId),
              eq(lguApplications.state, "PAYMENT_PENDING"),
            ),
          )
          .limit(1);
        if (!application) return null;
        const [payment] = await transaction
          .update(lguPayments)
          .set({
            status: "PENDING",
            transactionUuid: input.transactionUuid,
            checkoutUrl: input.checkoutUrl,
            providerStatus: input.providerStatus,
            expiresAt: input.expiresAt,
            updatedAt: input.now,
          })
          .where(
            and(
              eq(lguPayments.id, input.paymentId),
              inArray(lguPayments.status, ["CREATING", "PENDING"]),
            ),
          )
          .returning();
        return payment ?? null;
      });
    },
    recordPendingPayment(input) {
      return database.transaction(async (transaction) => {
        const [application] = await transaction
          .select({ id: lguApplications.id })
          .from(lguApplications)
          .where(
            and(
              eq(lguApplications.latestPaymentId, input.paymentId),
              eq(lguApplications.state, "PAYMENT_PENDING"),
            ),
          )
          .limit(1);
        if (!application) return null;
        const [payment] = await transaction
          .update(lguPayments)
          .set({
            status: "PENDING",
            providerStatus: input.providerStatus,
            expiresAt: input.expiresAt,
            updatedAt: input.now,
          })
          .where(
            and(
              eq(lguPayments.id, input.paymentId),
              inArray(lguPayments.status, ["CREATING", "PENDING"]),
            ),
          )
          .returning();
        return payment ?? null;
      });
    },
    releasePayment(input) {
      return database
        .transaction(async (transaction) => {
          let [application] = await transaction
            .update(lguApplications)
            .set({ state: "PAYMENT_READY", updatedAt: input.now })
            .where(
              and(
                eq(lguApplications.id, input.applicationId),
                eq(lguApplications.latestPaymentId, input.paymentId),
                eq(lguApplications.state, "PAYMENT_PENDING"),
              ),
            )
            .returning();
          if (!application) {
            [application] = await transaction
              .select()
              .from(lguApplications)
              .where(
                and(
                  eq(lguApplications.id, input.applicationId),
                  eq(lguApplications.latestPaymentId, input.paymentId),
                  eq(lguApplications.state, "PAYMENT_READY"),
                ),
              )
              .limit(1);
          }
          if (!application) return null;
          const [payment] = await transaction
            .update(lguPayments)
            .set({
              status: input.status,
              providerStatus: input.providerStatus,
              expiresAt: input.expiresAt,
              updatedAt: input.now,
            })
            .where(
              and(
                eq(lguPayments.id, input.paymentId),
                eq(lguPayments.applicationId, input.applicationId),
                ne(lguPayments.status, "PAID"),
              ),
            )
            .returning();
          if (!payment) throw new LguTransitionRollback();
          return {
            application: applicationRecord(application),
            payment,
          };
        })
        .catch((error: unknown) => {
          if (error instanceof LguTransitionRollback) return null;
          throw error;
        });
    },
    completePayment(input) {
      return database
        .transaction(async (transaction) => {
          let [application] = await transaction
            .update(lguApplications)
            .set({
              state: "COMPLETED",
              permitNumber: input.permitNumber,
              barangayClearanceNumber: input.barangayClearanceNumber,
              documentsIssuedAt: input.issuedAt,
              documentsValidUntil: input.validUntil,
              updatedAt: input.now,
            })
            .where(
              and(
                eq(lguApplications.id, input.applicationId),
                eq(lguApplications.latestPaymentId, input.paymentId),
                eq(lguApplications.state, "PAYMENT_PENDING"),
              ),
            )
            .returning();
          if (!application) {
            [application] = await transaction
              .select()
              .from(lguApplications)
              .where(
                and(
                  eq(lguApplications.id, input.applicationId),
                  eq(lguApplications.latestPaymentId, input.paymentId),
                  eq(lguApplications.state, "COMPLETED"),
                ),
              )
              .limit(1);
          }
          if (!application) return null;
          const [payment] = await transaction
            .update(lguPayments)
            .set({
              status: "PAID",
              providerStatus: input.providerStatus,
              paidAt: input.paidAt,
              updatedAt: input.now,
            })
            .where(
              and(
                eq(lguPayments.id, input.paymentId),
                eq(lguPayments.applicationId, input.applicationId),
                inArray(lguPayments.status, ["CREATING", "PENDING", "PAID"]),
              ),
            )
            .returning();
          if (!payment) throw new LguTransitionRollback();
          return {
            application: applicationRecord(application),
            payment,
          };
        })
        .catch((error: unknown) => {
          if (error instanceof LguTransitionRollback) return null;
          throw error;
        });
    },
  };
}

export const lguDatabaseTables = Object.freeze({
  applications: lguApplications,
  applicantInformation: lguApplicantInformation,
  payments: lguPayments,
});
