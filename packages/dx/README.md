# DX BNRS

`@repo/dx/bnrs` models the sole-proprietorship business-name registration flow used by DX. BNRS operations are local and database-backed; hosted payment is delegated to the existing eGovPay SDK.

## Flow

```text
TERMS_PENDING
  -> OWNER_INFORMATION_PENDING
  -> BUSINESS_NAME_PENDING
  -> SCOPE_PENDING
  -> PAYMENT_READY
  -> PAYMENT_PENDING
  -> COMPLETED
```

An unfinished application can become `ABANDONED`. A failed, expired, or voided payment returns it to `PAYMENT_READY`. Name and scope can be edited at `PAYMENT_READY`, but are locked once payment begins.

Only one active application is allowed for each eGov user. Completed and abandoned applications remain in history. Business names are considered reserved only by database records in `PAYMENT_PENDING` or `COMPLETED`; there are no built-in reserved-name fixtures.

## Identity and owner data

The consuming server obtains the trusted eGov user ID from the authenticated SSO profile's `rawProfile.uniqid` and passes it to each user-scoped operation:

```ts
const actor = { egovUserId: session.rawProfile.uniqid };
```

Do not accept `egovUserId` from an agent or browser payload. DX itself stays stateless: it receives the trusted actor, then loads and authorizes the application through its repository.

`mapEgovSsoProfileToBnrsOwnerInformation` maps only citizenship, first/middle/last name, suffix, birth date, and gender. Missing values are silently omitted. Status responses report only whether owner information is stored and do not return owner PII.

## Setup and usage

```ts
import { createDatabase } from "@repo/db";
import { createEgovPayClient } from "@repo/egov/eGovPay";
import {
  createBnrsService,
  createDrizzleBnrsRepository,
  createEgovPayBnrsPaymentProvider,
} from "@repo/dx/bnrs";

const database = createDatabase(process.env.DATABASE_URL!);
const repository = createDrizzleBnrsRepository(database);
const paymentProvider = createEgovPayBnrsPaymentProvider(
  createEgovPayClient({
    apiKey: process.env.EGOVPAY_API_KEY!,
    baseUrl: process.env.EGOVPAY_BASE_URL!,
    settlementTemplateUuid: process.env.EGOVPAY_SETTLEMENT_TEMPLATE_UUID!,
  }),
);
const bnrs = createBnrsService({ repository, paymentProvider });

const application = await bnrs.startOrResumeApplication({ actor });
await bnrs.acceptTermsAndConditions({ actor, applicationId: application.applicationId });
await bnrs.setOwnerInformation({
  actor,
  applicationId: application.applicationId,
  owner,
});
await bnrs.setBusinessName({
  actor,
  applicationId: application.applicationId,
  dominantName: "Molar Bear",
  descriptorId: "DENTAL_CLINIC",
});
await bnrs.setBusinessScope({
  actor,
  applicationId: application.applicationId,
  scopeId: "NATIONAL",
});
const checkout = await bnrs.createPayment({
  actor,
  applicationId: application.applicationId,
  callbackUrl,
  redirectUrl,
});
```

Use `syncPaymentStatus({ transactionUuid })` from both callback and return handling. The callback payload does not decide the result: DX looks up the transaction through eGovPay and verifies its UUID, transaction ID, amount, and currency before changing application state. Repeated checkout creation reuses the current pending link.

If checkout creation is interrupted, retries keep the same provider transaction ID. An authoritative callback can attach the provider UUID to the creating attempt, and a later creation retry restores a missing checkout URL without opening a second logical payment attempt.

After verified payment, DX generates a `BNRS-YYYYMMDD-XXXXXXXX` reference and returns the business name, descriptor, scope, owner display name, issue time, and total paid.

## Catalog and fees

The package contains 40 stable descriptor IDs selected from the official BNRS descriptor list. It intentionally exposes descriptors only, not section/division/group/class/subclass classification. Sources: [BNRS descriptor file](https://dtibnrs.s3-ap-southeast-1.amazonaws.com/files/20260701/vl4wphmb3j0835.xlsx) and [DTI BNRS FAQ](https://bnrs.dti.gov.ph/faq).

| Scope             | Registration | DST    | Total     |
| ----------------- | ------------ | ------ | --------- |
| City/Municipality | PHP 500      | PHP 30 | PHP 530   |
| Regional          | PHP 1,000    | PHP 30 | PHP 1,030 |
| National          | PHP 2,000    | PHP 30 | PHP 2,030 |

Fee and descriptor values are snapshotted on each application so later catalog changes cannot alter an in-progress or completed record.

## Persistence

The Drizzle schema uses three tables:

- `bnrs_applications` for ownership, lifecycle, business name, scope, fee snapshot, and registration result
- `bnrs_owner_information` for the one-to-one owner PII record
- `bnrs_payments` for every hosted-payment attempt and provider reference

Run the generated migration through the `@repo/db` migration command before using the module.

## Deferred

- Civil status, email, and mobile are not mapped or stored.
- Refugee/stateless and related owner questions are skipped.
- Missing-field completeness checks are skipped; available owner values are stored silently.
- Barangay scope is not included yet.
- A fuller descriptor catalog and any database seeder will be added separately.
- Live DTI/BNRS API calls, agent tools, and application routes are outside this package.
- Certificate PDF generation is deferred; completion currently returns a structured registration result.
