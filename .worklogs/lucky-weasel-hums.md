---
related:
  # - https://…  (full links to shared things: the ticket, the PR, related docs)
date: 2026-07-22
---

# Worklog: Add eGov SSO and verified form prefilling

<!-- A decision log, extracted from the session record (not written from memory). Capture the
     notable decisions behind this change: those that shaped what shipped AND could have gone
     another way (surprising, not the obvious approach, contested, or a real pick among options).
     Leave out how the work was run (which agent/model, the testing, ticket/PR mechanics) and the
     cosmetic, copy-level churn. Attach a reason only when one was actually stated ("no reason
     given" is valid — never invent one). Anchor every rationale to something any developer can
     open; where the only anchor is out of reach, put its substance here. -->

## Context

Add eGov SSO to `apps/egov-agentic-biz`, replacing its hardcoded citizen identity and image with authenticated staging data. The original brief asked for a dropdown of the portal's test users whose Login button would automatically generate and exchange a code; refresh persistence was then made explicit. The login surface was later asked to follow the supplied eGov MPIN-style reference while using one input instead of OTP boxes. The scope expanded to exercising the authenticated Business chat and adding a `user_info` tool so verified eGov data could prefill later forms.

## Decisions

- **Use the supported exchange-code flow instead of reproducing the requested test-user dropdown.** Capturing the portal request showed that Generate is an authenticated, deployment-specific Next.js Server Action, not a documented eGov SSO endpoint, and redirects to portal login outside that session. Proxying portal cookies or hardcoding its rotating action hash was rejected as brittle and unsupported. The shipped login therefore accepts the official widget callback or a fresh portal-generated one-time code, then exchanges it server-side through the eGov package ([login screen](../apps/egov-agentic-biz/src/components/login-screen.tsx), [exchange route](../apps/egov-agentic-biz/src/app/api/auth/egov/exchange/route.ts)).

- **Keep the authenticated identity behind an opaque server session.** Browser-side access-token or raw-profile persistence was set aside so exchange codes, access tokens, partner secrets, and the complete profile would not enter browser storage. An `HttpOnly`, `SameSite=Lax` cookie identifies a process-local session; the client receives only the mapped fields needed by the app, while profile media is served through an authenticated, no-store proxy ([session store](../apps/egov-agentic-biz/src/lib/auth/session.ts), [profile mapper](../apps/egov-agentic-biz/src/lib/auth/profile.ts), [avatar route](../apps/egov-agentic-biz/src/app/api/auth/avatar/route.ts)). A durable shared store was not added because this is a hackathon sample; the stated boundary is that refresh survives while the server process lives, but a restart does not.

- **Require a browser-bound login intent and consume exchange codes only through same-origin POST.** A direct GET callback and an exchange endpoint without browser binding were implemented during iteration but removed after they were identified as login-CSRF/session-replacement paths. The final flow issues a five-minute HMAC-signed intent cookie, rejects cross-origin initiation or exchange, consumes the intent after successful login, and restores the authenticated UI with a full navigation so the widget is not left mounted in an authenticated session ([intent implementation](../apps/egov-agentic-biz/src/lib/auth/intent.ts), [intent route](../apps/egov-agentic-biz/src/app/api/auth/egov/intent/route.ts), [exchange route](../apps/egov-agentic-biz/src/app/api/auth/egov/exchange/route.ts)).

- **Make `user_info` a capability manifest, not a raw-profile tool.** The first implementation returned the complete profile requested by the brief, and an intermediate version returned an allowlisted subset. Both were set aside: the raw record included document identifiers, signatures, and base64 media, while exposing even selected values to the model could leak them through prompts, tool history, or responses. The shipped tool reports only which non-empty verified fields are available and their `eGov SSO` source; actual values remain in the authenticated server session and are applied by form tools. Model-visible form input/output substitutes placeholders for identity and address while the authenticated UI receives the populated form ([tool contract](../apps/egov-agentic-biz/src/lib/business-chat.ts), [chat route](../apps/egov-agentic-biz/src/app/api/agent/chat/route.ts), [field resolver](../apps/egov-agentic-biz/src/lib/form-prefill.ts)).

- **Treat a residential address as an explicit business-location choice, not a default.** Automatically falling back to the profile address, treating silence as consent, and inferring consent from free-form language were each rejected because a verified home address does not establish where a business operates. The agent now asks a structured “registered eGov address” versus “different address” question; an explicitly supplied business address wins, and ordinary-chat corrections are accepted only when parsed directly from the user's text. This keeps automatic verified prefill for applicable fields without asserting an unconfirmed business fact or marking an incomplete draft ready ([prefill rules](../apps/egov-agentic-biz/src/lib/form-prefill.ts), [prefill tests](../apps/egov-agentic-biz/src/lib/form-prefill.test.ts), [location resolution](../apps/egov-agentic-biz/src/lib/government-data.ts)).

## Final state

`egov-agentic-biz` now has an eGov-styled login screen with a single masked exchange-code input and the official widget, server-side SSO exchange, refresh-restorable login/logout, live profile and avatar rendering, and authentication gates around profile, business, chat, and payment routes. The hardcoded citizen and business records are gone. Business chat can discover available verified profile fields and prefill DTI drafts server-side, with model redaction and explicit consent before reusing the registered address.

The delivered login diverges from the requested test-user dropdown because the portal's generator is not an integrator-facing API; users must use the official widget or provide a fresh code generated in the authenticated portal. Persistence is intentionally limited to the current server process. The requested raw-profile `user_info` JSON also did not ship to the model: it became metadata-only because the record and populated tool history could expose sensitive identity data.
