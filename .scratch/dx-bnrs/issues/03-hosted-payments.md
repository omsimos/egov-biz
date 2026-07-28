# 03 — Integrate hosted payments

Type: task
Status: resolved
Blocked by: 02

## Scope

Add the payment-provider abstraction, eGovPay adapter, quotes, transaction creation/reuse, authoritative status synchronization, payment-state recovery, verified completion, reference generation, and payment-aware abandonment.

## Acceptance criteria

- Checkout requests contain scope registration fee and DST items.
- Concurrent/repeated requests do not create multiple current payments.
- Callback claims are never accepted without provider lookup.
- Amount, currency, and transaction ID are verified before completion.
- Failed/expired/voided transactions return the application to payment-ready.
- Pending transactions are verified and voided before abandonment.

## Comments

## Answer

Added the injected payment-provider interface and eGovPay adapter, itemized hosted checkouts, pending-link reuse, provider-authoritative synchronization, transaction verification, recovery to payment-ready, verified registration completion, and safe pending-payment abandonment.
