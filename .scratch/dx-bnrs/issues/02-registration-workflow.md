# 02 — Implement the registration workflow

Type: task
Status: resolved
Blocked by: 01

## Scope

Create `@repo/dx/bnrs`, its public types, constants, typed errors, SSO mapper, repository abstraction, Drizzle repository, status projection, and non-payment state transitions.

## Acceptance criteria

- Start/resume, status, terms, owner, name, scope, and abandonment-before-payment work through public interfaces.
- Transitions are ordered and idempotent.
- Owner mapping stores only agreed optional fields.
- Descriptor and scope catalogs match the approved plan.
- Status responses exclude owner PII.
- Name and scope remain editable only before payment begins.

## Comments

## Answer

Added the typed BNRS package, public state machine, actor authorization, SSO owner mapper, curated catalogs, validations, status projection, repository abstraction, Drizzle repository, and idempotent non-payment transitions.
