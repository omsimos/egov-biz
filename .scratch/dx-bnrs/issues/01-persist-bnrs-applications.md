# 01 — Persist BNRS applications

Type: task
Status: resolved

## Scope

Define Drizzle tables, enums, relations, and PostgreSQL constraints for applications, owner information, and payment attempts. Generate the migration and expose the schema from `@repo/db`.

## Acceptance criteria

- Application UUID and eGov user ownership are stored.
- One active application per user is enforced in PostgreSQL.
- Pending/completed business-name reservations are unique by normalized name.
- Owner PII is isolated in a one-to-one table.
- Payment attempts preserve provider references and history.
- One pending payment per application is enforced.

## Comments

## Answer

Added the BNRS application, owner-information, and payment-attempt schemas with PostgreSQL enums, relations, partial uniqueness constraints, schema tests, and the generated `0000_last_charles_xavier.sql` migration.
