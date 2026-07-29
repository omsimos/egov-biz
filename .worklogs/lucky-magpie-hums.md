---
related:
  - https://github.com/omsimos/egov-scripts/pull/16
date: 2026-07-29
---

# Worklog: Migrate monorepo to published egov.js SDK

## Context

The initial brief was to link the separately extracted `egov.js` SDK into this monorepo,
migrate consumers away from `packages/egov`, deprecate that in-repo package, and use the
existing Stagehand workflows as the integration check. The brief was expanded in-session
to delete `packages/egov` completely, publish the standalone SDK to npm and consume that
release instead of a sibling checkout, and include the reported SSO state mismatch where
remembered account details could outlive the authenticated session.

## Decisions

- **Keep the standalone SDK’s generated public API unchanged and put compatibility at the monorepo’s consumer boundaries.** Updating `egov.js` was explicitly allowed, but inspection showed that its root exports and generated SSO, eGovPay, and eMessage operations already covered the required capabilities, so changing the SDK was set aside unless validation exposed a real API gap. The app now configures generated clients directly, while DX retains its existing application-facing payment interface through a local adapter that maps camel-case inputs to the generated request shape and computes the required digest. The eMessage integration similarly keeps its retry classification through an app-local error wrapper rather than restoring the deleted SDK facade. No additional reason was given for locating those compatibility adapters in DX and the app instead of adding convenience facades to `egov.js` ([SSO exchange](../apps/egov-agentic-biz/src/lib/auth/exchange.ts), [app payment boundary](../apps/egov-agentic-biz/src/lib/egov-pay-sdk.ts), [DX payment adapter](../packages/dx/src/egov-pay.ts), [eMessage boundary](../apps/egov-agentic-biz/src/lib/emessage.ts)).

- **Delete `packages/egov` rather than retain it as deprecated reference code.** The first implementation marked the package deprecated, removed active imports, and excluded it from the workspace. That transitional option was reversed when the brief was clarified to “totally delete” it; the final workspace, CI, Docker build, scripts, and documentation therefore have no `@repo/egov` or `packages/egov` dependency ([root workspace](../package.json), [app manifest](../apps/egov-agentic-biz/package.json), [DX manifest](../packages/dx/package.json), [Dockerfile](../apps/egov-agentic-biz/Dockerfile)).

- **Consume an exact published `egov.js@0.1.0` release instead of requiring a sibling checkout.** A path-qualified Bun `link:` dependency was tried first, then Bun’s registered-link form, but the former was rejected by Bun and the latter left Next/Turbopack unable to follow the two-hop global symlink. A `file:` dependency installed locally and worked, but it required CI and Docker to clone/build the sibling repository. After the user requested npm publication, the SDK was published and all consumers were pinned to `0.1.0`, removing those extra checkout and build-context requirements ([root manifest](../package.json), [app manifest](../apps/egov-agentic-biz/package.json), [DX manifest](../packages/dx/package.json), [CI workflow](../.github/workflows/egov-agentic-biz.yml)).

- **Treat remembered account metadata as display-only, keep the server session authoritative, and extend the default session lifetime to seven days.** Keeping the one-hour session while indefinitely showing “Welcome back,” or reconstructing authentication from the remembered name, was rejected: the observed browser had only non-sensitive display metadata and all stored sessions were expired, so there was no credential that could be recovered safely. New sessions now default to seven days, and an expired or absent session is presented explicitly as signed out even when a previous account name is remembered ([session policy](../apps/egov-agentic-biz/src/lib/auth/session.ts), [environment example](../apps/egov-agentic-biz/.env.example), [signed-out UI](../apps/egov-agentic-biz/src/components/login-screen.tsx)).

## Final state

The monorepo now installs `egov.js@0.1.0` from npm and uses its generated clients and
types for SSO, eGovPay, eMessage, shared profiles, DX integrations, and scripts.
`packages/egov` was removed completely, with the workspace, lockfile, CI, Docker, and
documentation updated around the published package. The SSO session default is seven
days, remembered-account copy no longer implies an active login, and the Stagehand
harness asserts that authentication survives a reload.

This diverged from the original brief in two requested ways: the old package was deleted
instead of merely deprecated, and the temporary local link was replaced by the published
npm release. The standalone `egov.js` repository required no code changes because its
existing generated surface covered the migration; the unchanged package was published as
version `0.1.0`.
