import { randomUUID } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import type {
  BusinessFinalizationInput,
  RegisteredBusiness,
  RegisteredBusinessListItem,
} from "@/lib/registered-business";
import { getDatabase, schema } from "@/server/db";

type BusinessRow = typeof schema.registeredBusinesses.$inferSelect;

function mapBusiness(row: BusinessRow): RegisteredBusiness {
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
    records: JSON.parse(row.recordsJson) as RegisteredBusiness["records"],
    taxObligations: JSON.parse(row.taxObligationsJson) as RegisteredBusiness["taxObligations"],
    files: JSON.parse(row.filesJson || "[]") as RegisteredBusiness["files"],
    finalizedAt: row.finalizedAt,
  };
}

export async function upsertRegisteredBusiness(
  profileId: string,
  input: BusinessFinalizationInput,
) {
  const database = await getDatabase();
  const now = new Date().toISOString();
  const finalizedAt = input.finalizedAt ?? now;

  // conversation_id is unique, so the conflict target keeps one business per
  // conversation and the existing row's id survives an update.
  const [row] = await database
    .insert(schema.registeredBusinesses)
    .values({
      businessActivity: input.businessActivity,
      businessAddress: input.businessAddress,
      category: input.category,
      city: input.city,
      conversationId: input.conversationId,
      createdAt: now,
      filesJson: JSON.stringify(input.files),
      finalizedAt,
      id: randomUUID(),
      name: input.name,
      ownerName: input.ownerName,
      profileId,
      rdo: input.rdo,
      recordsJson: JSON.stringify(input.records),
      registrationNumber: input.registrationNumber,
      status: input.status,
      taxObligationsJson: JSON.stringify(input.taxObligations),
      tinMasked: input.tinMasked,
      type: input.type,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      set: {
        businessActivity: sql`excluded.business_activity`,
        businessAddress: sql`excluded.business_address`,
        category: sql`excluded.category`,
        city: sql`excluded.city`,
        filesJson: sql`excluded.files_json`,
        finalizedAt: sql`excluded.finalized_at`,
        name: sql`excluded.name`,
        ownerName: sql`excluded.owner_name`,
        profileId: sql`excluded.profile_id`,
        rdo: sql`excluded.rdo`,
        recordsJson: sql`excluded.records_json`,
        registrationNumber: sql`excluded.registration_number`,
        status: sql`excluded.status`,
        taxObligationsJson: sql`excluded.tax_obligations_json`,
        tinMasked: sql`excluded.tin_masked`,
        type: sql`excluded.type`,
        updatedAt: sql`excluded.updated_at`,
      },
      target: schema.registeredBusinesses.conversationId,
    })
    .returning();
  return mapBusiness(row!);
}

export async function listRegisteredBusinesses(
  profileId: string,
): Promise<RegisteredBusinessListItem[]> {
  const database = await getDatabase();
  const rows = await database
    .select()
    .from(schema.registeredBusinesses)
    .where(eq(schema.registeredBusinesses.profileId, profileId))
    .orderBy(desc(schema.registeredBusinesses.updatedAt));
  return rows.map((row) => {
    const business = mapBusiness(row);
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

export async function getRegisteredBusiness(profileId: string, id: string) {
  const database = await getDatabase();
  const [row] = await database
    .select()
    .from(schema.registeredBusinesses)
    .where(
      and(
        eq(schema.registeredBusinesses.id, id),
        eq(schema.registeredBusinesses.profileId, profileId),
      ),
    )
    .limit(1);
  return row ? mapBusiness(row) : null;
}
