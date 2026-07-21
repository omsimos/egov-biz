import { randomUUID } from "node:crypto";
import type {
  BusinessFinalizationInput,
  RegisteredBusiness,
  RegisteredBusinessListItem,
} from "@/lib/registered-business";
import { getDatabase } from "@/server/db";

type BusinessRow = {
  id: string;
  conversation_id: string;
  name: string;
  type: string;
  category: RegisteredBusiness["category"];
  registration_number: string;
  status: RegisteredBusiness["status"];
  owner_name: string;
  business_activity: string;
  business_address: string;
  city: string;
  rdo: string;
  tin_masked: string;
  records_json: string;
  tax_obligations_json: string;
  finalized_at: string;
};

function mapBusiness(row: BusinessRow): RegisteredBusiness {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    name: row.name,
    type: row.type,
    category: row.category,
    registrationNumber: row.registration_number,
    status: row.status,
    ownerName: row.owner_name,
    businessActivity: row.business_activity,
    businessAddress: row.business_address,
    city: row.city,
    rdo: row.rdo,
    tinMasked: row.tin_masked,
    records: JSON.parse(row.records_json) as RegisteredBusiness["records"],
    taxObligations: JSON.parse(row.tax_obligations_json) as RegisteredBusiness["taxObligations"],
    finalizedAt: row.finalized_at,
  };
}

export function upsertRegisteredBusiness(profileId: string, input: BusinessFinalizationInput) {
  const database = getDatabase();
  const existing = database
    .prepare("SELECT id FROM registered_businesses WHERE conversation_id = ?")
    .get(input.conversationId) as { id: string } | undefined;
  const id = existing?.id ?? randomUUID();
  const now = new Date().toISOString();
  const finalizedAt = input.finalizedAt ?? now;
  database
    .prepare(`
      INSERT INTO registered_businesses (
        id, conversation_id, profile_id, name, type, category, registration_number, status,
        owner_name, business_activity, business_address, city, rdo, tin_masked, records_json,
        tax_obligations_json, finalized_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(conversation_id) DO UPDATE SET
        profile_id = excluded.profile_id,
        name = excluded.name,
        type = excluded.type,
        category = excluded.category,
        registration_number = excluded.registration_number,
        status = excluded.status,
        owner_name = excluded.owner_name,
        business_activity = excluded.business_activity,
        business_address = excluded.business_address,
        city = excluded.city,
        rdo = excluded.rdo,
        tin_masked = excluded.tin_masked,
        records_json = excluded.records_json,
        tax_obligations_json = excluded.tax_obligations_json,
        finalized_at = excluded.finalized_at,
        updated_at = excluded.updated_at
    `)
    .run(
      id,
      input.conversationId,
      profileId,
      input.name,
      input.type,
      input.category,
      input.registrationNumber,
      input.status,
      input.ownerName,
      input.businessActivity,
      input.businessAddress,
      input.city,
      input.rdo,
      input.tinMasked,
      JSON.stringify(input.records),
      JSON.stringify(input.taxObligations),
      finalizedAt,
      now,
      now,
    );
  return getRegisteredBusiness(profileId, id)!;
}

export function listRegisteredBusinesses(profileId: string): RegisteredBusinessListItem[] {
  const rows = getDatabase()
    .prepare("SELECT * FROM registered_businesses WHERE profile_id = ? ORDER BY updated_at DESC")
    .all(profileId) as BusinessRow[];
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

export function getRegisteredBusiness(profileId: string, id: string) {
  const row = getDatabase()
    .prepare("SELECT * FROM registered_businesses WHERE id = ? AND profile_id = ?")
    .get(id, profileId) as BusinessRow | undefined;
  return row ? mapBusiness(row) : null;
}
