import type { Database } from "@omsimos/db";
import {
  bnrsApplications,
  bnrsBusinessAddresses,
  bnrsOwnerInformation,
  bnrsPayments,
} from "@omsimos/db/schema";
import { and, desc, eq, inArray, ne, notInArray } from "drizzle-orm";

import { databaseErrorContains } from "../drizzle-errors.js";
import {
  BnrsRepositoryConflict,
  type BnrsApplicationRecord,
  type BnrsPaymentRecord,
  type BnrsRepository,
} from "./repository.js";
import type { BnrsBusinessAddressInput, BnrsOwnerInformationInput } from "./types.js";

function applicationRecord(row: typeof bnrsApplications.$inferSelect): BnrsApplicationRecord {
  return row;
}

function paymentRecord(row: typeof bnrsPayments.$inferSelect): BnrsPaymentRecord {
  return row;
}

function ownerRecord(row: typeof bnrsOwnerInformation.$inferSelect): BnrsOwnerInformationInput {
  return {
    ...(row.citizenship === null ? {} : { citizenship: row.citizenship }),
    ...(row.firstName === null ? {} : { firstName: row.firstName }),
    ...(row.middleName === null ? {} : { middleName: row.middleName }),
    ...(row.lastName === null ? {} : { lastName: row.lastName }),
    ...(row.suffix === null ? {} : { suffix: row.suffix }),
    ...(row.birthDate === null ? {} : { birthDate: row.birthDate }),
    ...(row.gender === null ? {} : { gender: row.gender }),
  };
}

function businessAddressRecord(
  row: typeof bnrsBusinessAddresses.$inferSelect,
): BnrsBusinessAddressInput {
  return {
    source: row.source,
    addressLine1: row.addressLine1,
    ...(row.addressLine2 === null ? {} : { addressLine2: row.addressLine2 }),
    barangay: row.barangay,
    cityMunicipality: row.cityMunicipality,
    province: row.province,
    region: row.region,
    postalCode: row.postalCode,
  };
}

class BnrsTransitionRollback extends Error {}

export function createDrizzleBnrsRepository(database: Database): BnrsRepository {
  async function findActiveApplication(egovUserId: string) {
    const [application] = await database
      .select()
      .from(bnrsApplications)
      .where(
        and(
          eq(bnrsApplications.egovUserId, egovUserId),
          notInArray(bnrsApplications.state, ["COMPLETED", "ABANDONED"]),
        ),
      )
      .orderBy(desc(bnrsApplications.createdAt))
      .limit(1);
    return application ? applicationRecord(application) : null;
  }

  async function findLatestPayment(applicationId: string) {
    const [application] = await database
      .select({ latestPaymentId: bnrsApplications.latestPaymentId })
      .from(bnrsApplications)
      .where(eq(bnrsApplications.id, applicationId))
      .limit(1);
    if (!application?.latestPaymentId) return null;
    const [payment] = await database
      .select()
      .from(bnrsPayments)
      .where(eq(bnrsPayments.id, application.latestPaymentId))
      .limit(1);
    return payment ? paymentRecord(payment) : null;
  }

  return {
    async startOrResumeApplication(egovUserId, now) {
      const active = await findActiveApplication(egovUserId);
      if (active) return active;

      try {
        const [created] = await database
          .insert(bnrsApplications)
          .values({ egovUserId, createdAt: now, updatedAt: now })
          .returning();
        if (!created) throw new Error("BNRS application insert returned no row.");
        return applicationRecord(created);
      } catch (error) {
        const raced = await findActiveApplication(egovUserId);
        if (raced) return raced;
        throw error;
      }
    },
    async getApplication(applicationId) {
      const [application] = await database
        .select()
        .from(bnrsApplications)
        .where(eq(bnrsApplications.id, applicationId))
        .limit(1);
      return application ? applicationRecord(application) : null;
    },
    async getCompletedApplicationByCertificateNumber(input) {
      const [application] = await database
        .select()
        .from(bnrsApplications)
        .where(
          and(
            eq(bnrsApplications.egovUserId, input.egovUserId),
            eq(bnrsApplications.certificateNumber, input.certificateNumber),
            eq(bnrsApplications.state, "COMPLETED"),
          ),
        )
        .limit(1);
      return application ? applicationRecord(application) : null;
    },
    async listCompletedApplications(egovUserId) {
      const applications = await database
        .select()
        .from(bnrsApplications)
        .where(
          and(eq(bnrsApplications.egovUserId, egovUserId), eq(bnrsApplications.state, "COMPLETED")),
        )
        .orderBy(desc(bnrsApplications.issuedAt), desc(bnrsApplications.createdAt));
      return applications.map(applicationRecord);
    },
    async hasOwnerInformation(applicationId) {
      const [owner] = await database
        .select({ applicationId: bnrsOwnerInformation.applicationId })
        .from(bnrsOwnerInformation)
        .where(eq(bnrsOwnerInformation.applicationId, applicationId))
        .limit(1);
      return owner !== undefined;
    },
    async getOwnerInformation(applicationId) {
      const [owner] = await database
        .select()
        .from(bnrsOwnerInformation)
        .where(eq(bnrsOwnerInformation.applicationId, applicationId))
        .limit(1);
      return owner ? ownerRecord(owner) : null;
    },
    async getBusinessAddress(applicationId) {
      const [address] = await database
        .select()
        .from(bnrsBusinessAddresses)
        .where(eq(bnrsBusinessAddresses.applicationId, applicationId))
        .limit(1);
      return address ? businessAddressRecord(address) : null;
    },
    async updateApplication(input) {
      const [updated] = await database
        .update(bnrsApplications)
        .set({ ...input.patch, updatedAt: input.now })
        .where(
          and(
            eq(bnrsApplications.id, input.applicationId),
            eq(bnrsApplications.egovUserId, input.egovUserId),
            inArray(bnrsApplications.state, [...input.expectedStates]),
          ),
        )
        .returning();
      return updated ? applicationRecord(updated) : null;
    },
    saveOwnerInformationAndAdvance(input) {
      return database.transaction(async (transaction) => {
        const [updated] = await transaction
          .update(bnrsApplications)
          .set({ state: "BUSINESS_NAME_PENDING", updatedAt: input.now })
          .where(
            and(
              eq(bnrsApplications.id, input.applicationId),
              eq(bnrsApplications.egovUserId, input.egovUserId),
              eq(bnrsApplications.state, input.expectedState),
            ),
          )
          .returning();
        if (!updated) return null;

        await transaction
          .insert(bnrsOwnerInformation)
          .values({
            applicationId: input.applicationId,
            ...input.owner,
            createdAt: input.now,
            updatedAt: input.now,
          })
          .onConflictDoUpdate({
            target: bnrsOwnerInformation.applicationId,
            set: { ...input.owner, updatedAt: input.now },
          });
        return applicationRecord(updated);
      });
    },
    saveBusinessAddressAndAdvance(input) {
      return database.transaction(async (transaction) => {
        const [updated] = await transaction
          .update(bnrsApplications)
          .set({ state: "PAYMENT_READY", updatedAt: input.now })
          .where(
            and(
              eq(bnrsApplications.id, input.applicationId),
              eq(bnrsApplications.egovUserId, input.egovUserId),
              inArray(bnrsApplications.state, [...input.expectedStates]),
            ),
          )
          .returning();
        if (!updated) return null;

        const address = {
          source: input.address.source,
          addressLine1: input.address.addressLine1,
          addressLine2: input.address.addressLine2 ?? null,
          barangay: input.address.barangay,
          cityMunicipality: input.address.cityMunicipality,
          province: input.address.province,
          region: input.address.region,
          postalCode: input.address.postalCode,
        };
        await transaction
          .insert(bnrsBusinessAddresses)
          .values({
            applicationId: input.applicationId,
            ...address,
            createdAt: input.now,
            updatedAt: input.now,
          })
          .onConflictDoUpdate({
            target: bnrsBusinessAddresses.applicationId,
            set: { ...address, updatedAt: input.now },
          });
        return applicationRecord(updated);
      });
    },
    async isBusinessNameReserved(input) {
      const [reserved] = await database
        .select({ id: bnrsApplications.id })
        .from(bnrsApplications)
        .where(
          and(
            eq(bnrsApplications.normalizedBusinessName, input.normalizedBusinessName),
            ne(bnrsApplications.id, input.excludeApplicationId),
            inArray(bnrsApplications.state, ["PAYMENT_PENDING", "COMPLETED"]),
          ),
        )
        .limit(1);
      return reserved !== undefined;
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
        .from(bnrsPayments)
        .where(eq(bnrsPayments.transactionUuid, transactionUuid))
        .limit(1);
      return payment ? paymentRecord(payment) : null;
    },
    async getPaymentByTransactionId(transactionId) {
      const [payment] = await database
        .select()
        .from(bnrsPayments)
        .where(eq(bnrsPayments.transactionId, transactionId))
        .limit(1);
      return payment ? paymentRecord(payment) : null;
    },
    async beginPayment(input) {
      try {
        return await database.transaction(async (transaction) => {
          const [businessAddress] = await transaction
            .select({ applicationId: bnrsBusinessAddresses.applicationId })
            .from(bnrsBusinessAddresses)
            .where(eq(bnrsBusinessAddresses.applicationId, input.applicationId))
            .limit(1);
          if (!businessAddress) return null;

          const [reservedApplication] = await transaction
            .update(bnrsApplications)
            .set({ state: "PAYMENT_PENDING", updatedAt: input.now })
            .where(
              and(
                eq(bnrsApplications.id, input.applicationId),
                eq(bnrsApplications.egovUserId, input.egovUserId),
                eq(bnrsApplications.state, "PAYMENT_READY"),
              ),
            )
            .returning();
          if (!reservedApplication) return null;

          const [payment] = await transaction
            .insert(bnrsPayments)
            .values({
              applicationId: input.applicationId,
              status: "CREATING",
              transactionId: input.transactionId,
              amount: input.amount,
              currency: input.currency,
              createdAt: input.now,
              updatedAt: input.now,
            })
            .returning();
          if (!payment) throw new Error("BNRS payment insert returned no row.");
          const [application] = await transaction
            .update(bnrsApplications)
            .set({ latestPaymentId: payment.id, updatedAt: input.now })
            .where(
              and(
                eq(bnrsApplications.id, input.applicationId),
                eq(bnrsApplications.state, "PAYMENT_PENDING"),
              ),
            )
            .returning();
          if (!application) throw new BnrsTransitionRollback();
          return {
            application: applicationRecord(application),
            payment: paymentRecord(payment),
          };
        });
      } catch (error) {
        if (databaseErrorContains(error, "bnrs_applications.normalized_business_name"))
          throw new BnrsRepositoryConflict("BUSINESS_NAME_RESERVED");
        if (databaseErrorContains(error, "bnrs_payments.application_id"))
          throw new BnrsRepositoryConflict("PAYMENT_IN_PROGRESS");
        throw error;
      }
    },
    activatePayment(input) {
      return database.transaction(async (transaction) => {
        const [application] = await transaction
          .select({ id: bnrsApplications.id })
          .from(bnrsApplications)
          .where(
            and(
              eq(bnrsApplications.latestPaymentId, input.paymentId),
              eq(bnrsApplications.state, "PAYMENT_PENDING"),
            ),
          )
          .limit(1);
        if (!application) return null;
        const [payment] = await transaction
          .update(bnrsPayments)
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
              eq(bnrsPayments.id, input.paymentId),
              inArray(bnrsPayments.status, ["CREATING", "PENDING"]),
            ),
          )
          .returning();
        return payment ? paymentRecord(payment) : null;
      });
    },
    failPaymentCreation(input) {
      return database
        .transaction(async (transaction) => {
          const [application] = await transaction
            .update(bnrsApplications)
            .set({ state: "PAYMENT_READY", updatedAt: input.now })
            .where(
              and(
                eq(bnrsApplications.id, input.applicationId),
                eq(bnrsApplications.latestPaymentId, input.paymentId),
                eq(bnrsApplications.state, "PAYMENT_PENDING"),
              ),
            )
            .returning();
          if (!application) return null;
          const [payment] = await transaction
            .update(bnrsPayments)
            .set({
              status: "FAILED",
              providerStatus: input.providerStatus,
              updatedAt: input.now,
            })
            .where(
              and(
                eq(bnrsPayments.id, input.paymentId),
                eq(bnrsPayments.applicationId, input.applicationId),
                eq(bnrsPayments.status, "CREATING"),
              ),
            )
            .returning();
          if (!payment) throw new BnrsTransitionRollback();
          return {
            application: applicationRecord(application),
            payment: paymentRecord(payment),
          };
        })
        .catch((error: unknown) => {
          if (error instanceof BnrsTransitionRollback) return null;
          throw error;
        });
    },
    recordPendingPayment(input) {
      return database.transaction(async (transaction) => {
        const [application] = await transaction
          .select({ id: bnrsApplications.id })
          .from(bnrsApplications)
          .where(
            and(
              eq(bnrsApplications.latestPaymentId, input.paymentId),
              eq(bnrsApplications.state, "PAYMENT_PENDING"),
            ),
          )
          .limit(1);
        if (!application) return null;
        const [payment] = await transaction
          .update(bnrsPayments)
          .set({
            status: "PENDING",
            providerStatus: input.providerStatus,
            expiresAt: input.expiresAt,
            updatedAt: input.now,
          })
          .where(
            and(
              eq(bnrsPayments.id, input.paymentId),
              inArray(bnrsPayments.status, ["CREATING", "PENDING"]),
            ),
          )
          .returning();
        return payment ? paymentRecord(payment) : null;
      });
    },
    releasePayment(input) {
      return database
        .transaction(async (transaction) => {
          let [application] = await transaction
            .update(bnrsApplications)
            .set({ state: "PAYMENT_READY", updatedAt: input.now })
            .where(
              and(
                eq(bnrsApplications.id, input.applicationId),
                eq(bnrsApplications.latestPaymentId, input.paymentId),
                eq(bnrsApplications.state, "PAYMENT_PENDING"),
              ),
            )
            .returning();
          if (!application) {
            [application] = await transaction
              .select()
              .from(bnrsApplications)
              .where(
                and(
                  eq(bnrsApplications.id, input.applicationId),
                  eq(bnrsApplications.latestPaymentId, input.paymentId),
                  eq(bnrsApplications.state, "PAYMENT_READY"),
                ),
              )
              .limit(1);
          }
          if (!application) return null;
          const [payment] = await transaction
            .update(bnrsPayments)
            .set({
              status: input.status,
              providerStatus: input.providerStatus,
              expiresAt: input.expiresAt,
              updatedAt: input.now,
            })
            .where(
              and(
                eq(bnrsPayments.id, input.paymentId),
                eq(bnrsPayments.applicationId, input.applicationId),
                ne(bnrsPayments.status, "PAID"),
              ),
            )
            .returning();
          if (!payment) throw new BnrsTransitionRollback();
          return {
            application: applicationRecord(application),
            payment: paymentRecord(payment),
          };
        })
        .catch((error: unknown) => {
          if (error instanceof BnrsTransitionRollback) return null;
          throw error;
        });
    },
    completePayment(input) {
      return database
        .transaction(async (transaction) => {
          let [application] = await transaction
            .update(bnrsApplications)
            .set({
              state: "COMPLETED",
              referenceCode: input.referenceCode,
              certificateNumber: input.certificateNumber,
              issuedAt: input.issuedAt,
              validUntil: input.validUntil,
              updatedAt: input.now,
            })
            .where(
              and(
                eq(bnrsApplications.id, input.applicationId),
                eq(bnrsApplications.latestPaymentId, input.paymentId),
                eq(bnrsApplications.state, "PAYMENT_PENDING"),
              ),
            )
            .returning();
          if (!application) {
            [application] = await transaction
              .select()
              .from(bnrsApplications)
              .where(
                and(
                  eq(bnrsApplications.id, input.applicationId),
                  eq(bnrsApplications.latestPaymentId, input.paymentId),
                  eq(bnrsApplications.state, "COMPLETED"),
                ),
              )
              .limit(1);
          }
          if (!application) return null;
          const [payment] = await transaction
            .update(bnrsPayments)
            .set({
              status: "PAID",
              providerStatus: input.providerStatus,
              paidAt: input.paidAt,
              updatedAt: input.now,
            })
            .where(
              and(
                eq(bnrsPayments.id, input.paymentId),
                eq(bnrsPayments.applicationId, input.applicationId),
                inArray(bnrsPayments.status, ["CREATING", "PENDING", "PAID"]),
              ),
            )
            .returning();
          if (!payment) throw new BnrsTransitionRollback();
          return {
            application: applicationRecord(application),
            payment: paymentRecord(payment),
          };
        })
        .catch((error: unknown) => {
          if (error instanceof BnrsTransitionRollback) return null;
          throw error;
        });
    },
  };
}

export const bnrsDatabaseTables = Object.freeze({
  applications: bnrsApplications,
  ownerInformation: bnrsOwnerInformation,
  businessAddresses: bnrsBusinessAddresses,
  payments: bnrsPayments,
});
