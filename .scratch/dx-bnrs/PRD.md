# BNRS DX

Status: resolved

## Objective

Add a typed `@repo/dx/bnrs` module that models the agreed sole-proprietorship business-name registration flow:

1. Terms and conditions
2. Owner information sourced from an authenticated eGov SSO profile
3. Dominant business name and curated BNRS descriptor
4. Territorial scope and fee quote
5. Hosted eGovPay checkout and provider-verified completion

The DTI/BNRS operations are simulated and persisted in PostgreSQL. Payment uses the existing eGovPay SDK through an injected adapter. Agent tool definitions and application-route wiring are outside this feature.

## Requirements

- Store applications by `applicationId` and `egovUserId`, allowing only one active application per user.
- Enforce the agreed state machine and support safe abandonment.
- Keep the service stateless; every user operation receives an explicit trusted actor.
- Store only normalized BNRS owner fields, never the raw SSO profile.
- Silently omit missing owner values. Defer civil status, email, mobile, refugee/stateless questions, and completeness checks.
- Return concise hardcoded terms and store only `termsAcceptedAt`.
- Ship a curated static catalog of 40 real BNRS descriptor labels.
- Check business-name availability only against `PAYMENT_PENDING` and `COMPLETED` database records.
- Support City/Municipality, Regional, and National scopes with the additional PHP 30 documentary stamp tax.
- Create/reuse hosted eGovPay transactions; verify provider state before completion or abandonment.
- Generate a readable `BNRS-YYYYMMDD-XXXXXXXX` reference after verified payment.
- Do not include `mock` or `demo` markers in domain responses.
- Document deferred behavior and source links in `packages/dx/README.md`.

## Acceptance

- `@repo/dx/bnrs` exposes the complete agreed service API and typed errors.
- Drizzle schema and generated migration enforce lifecycle and reservation invariants.
- Focused unit tests cover state transitions, validation, SSO mapping, payment behavior, idempotency, abandonment, and privacy.
- Repository formatting, lint, type checks, and tests pass.
