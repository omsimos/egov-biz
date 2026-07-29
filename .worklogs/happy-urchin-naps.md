---
related:
  - https://github.com/omsimos/egov-scripts/pull/17
date: 2026-07-29
---

# Worklog: Migrate business registration flows to DX

<!-- A decision log, extracted from the session record (not written from memory). Capture the
     notable decisions behind this change: those that shaped what shipped AND could have gone
     another way (surprising, not the obvious approach, contested, or a real pick among options).
     Leave out how the work was run (which agent/model, the testing, ticket/PR mechanics) and the
     cosmetic, copy-level churn. Attach a reason only when one was actually stated ("no reason
     given" is valid — never invent one). Anchor every rationale to something any developer can
     open; where the only anchor is out of reach, put its substance here. -->

## Context

PR #17 is a three-commit migration of the business app's BNRS, LGU, BIR document,
payment, and registered-business workflows to shared DX service boundaries. The
two migration commits were already on the branch when this recorded session
began. The brief given in this session was to add a dummy Tax Calendar under
DX/BIR whose contents depend on the business type, then exercise both the
sole-proprietor and self-employed registration paths and verify their calendars.

## Decisions

- **Make DX/BIR own a pure, typed calendar generator.** The shipped contract is
  `createBirDemoTaxCalendar` in `packages/dx/src/bir/tax-calendar.ts`, keyed by
  `Self-employed`, `Sole proprietor`, or `Company`, with the business app
  consuming its existing obligation-shaped output. Keeping the calendar as
  app-local static behavior or a single generic list was set aside: the brief
  explicitly placed it in DX/BIR and required business-type differences, and
  the session identified the existing obligation shape as a clean projection
  seam. No further reason was given for exposing the `Company` variant while
  the requested end-to-end flows covered the other two types.

- **Treat the calendar as an explicit simulation, not a tax determination.**
  Each type gets four reminders, every entry carries `simulated: true` and a
  confirmation note, and individual versus corporate income-tax form families
  differ by legal type. The alternative of presenting these as authoritative
  obligations was rejected because the session stated that real applicability
  also depends on VAT or percentage-tax status, withholding, elections, fiscal
  year, and other registration details that the demo does not collect. This
  limitation is part of both the exported type and `packages/dx/README.md`.

- **Resolve deadlines by UTC calendar day and keep a deadline due on the
  reference day.** The first implementation used strict future comparisons,
  which would roll a same-day deadline forward. It was changed to normalize
  `asOf` to a UTC date and use inclusive comparisons, so a reminder due that
  day remains the next item; `packages/dx/test/bir-tax-calendar.test.ts` locks in
  that behavior. The session described the original behavior as a timezone and
  date-comparison bug; no additional reason was given.

- **Finalize sole proprietors into the same persisted business-record path as
  self-employed registrations.** At the BIR completion checkpoint, the app now
  promotes the assembled BNRS/LGU business into `registeredBusinesses`, adds
  its sole-proprietor calendar, and uses the shared upsert/link helper in
  `apps/egov-agentic-biz/src/server/dx/bir-registrations.ts`. Continuing to
  serve that business only as a live BNRS/LGU projection was set aside after it
  produced an empty calendar in the completed flow. The existing
  `tax_obligations_json` field already fit the data, so a new schema was not
  needed.

## Final state

PR #17 ships the earlier BNRS and remaining-flow DX migrations together with a
DX/BIR Tax Calendar contract, persisted calendars for newly finalized
self-employed and sole-proprietor businesses, BIR documentary-stamp completion,
and immediate refresh of finalized business and registration-plan state. The
generator also exposes a company-specific calendar, although the application
flows exercised in this session were sole proprietor and self-employed.

Compared with the calendar brief, the final commit also closed two integration
gaps found while exercising those flows: sole-proprietor completion did not
retain its calendar, and the client could continue showing pre-finalization
business-list and plan state. Those findings led to the shared sole-proprietor
finalization path and an explicit client refresh when opening the completed
business. No database schema migration shipped because the existing
registered-business record already had storage for the calendar.
