# DX BNRS

`@repo/dx/bnrs` models the sole-proprietorship business-name registration flow used by DX. BNRS operations are local and database-backed; hosted payment is delegated to the existing eGovPay SDK.

## Flow

```text
TERMS_PENDING
  -> OWNER_INFORMATION_PENDING
  -> BUSINESS_NAME_PENDING
  -> SCOPE_PENDING
  -> BUSINESS_ADDRESS_PENDING
  -> PAYMENT_READY
  -> PAYMENT_PENDING
  -> COMPLETED
```

An unfinished application can become `ABANDONED`. A failed, expired, or voided payment returns it to `PAYMENT_READY`. Name, scope, and business address can be edited at `PAYMENT_READY`, but are locked once payment begins. Payment cannot start while the required business address is missing.

Only one active application is allowed for each eGov user. Completed and abandoned applications remain in history. Business names are considered reserved only by database records in `PAYMENT_PENDING` or `COMPLETED`; there are no built-in reserved-name fixtures.

## Identity and owner data

The consuming server obtains the trusted eGov user ID from the authenticated SSO profile's `rawProfile.uniqid` and passes it to each user-scoped operation:

```ts
const actor = { egovUserId: session.rawProfile.uniqid };
```

Do not accept `egovUserId` from an agent or browser payload. DX itself stays stateless: it receives the trusted actor, then loads and authorizes the application through its repository.

`mapEgovSsoProfileToBnrsOwnerInformation` maps only citizenship, first/middle/last name, suffix, birth date, and gender. Missing values are silently omitted. Status responses report only whether owner information is stored and do not return owner PII.

## Business address

The business address is a separate required step after territorial scope. The agent, app, or tool-call layer chooses one of two inputs:

- Reuse the complete residential address returned by `mapEgovSsoProfileToBnrsResidentialAddress`, which carries source `EGOV_RESIDENTIAL`.
- Collect a complete, different address and submit it with source `USER_PROVIDED`.

The SSO mapper returns `null` unless address line 1, barangay, city/municipality, province, region, and a four-digit postal code are all available. `setBusinessAddress` applies the same completeness checks to either source. DX only validates and stores the address it receives; deciding whether to reuse the residential address or collect a different business address stays outside this package.

Business addresses are stored separately as PII. Status responses expose only `{ stored, source }`, never the address fields.

## Setup and usage

```ts
import { createDatabaseFromEnv } from "@repo/db";
import { createEgovPayClient } from "@repo/egov/eGovPay";
import {
  createBnrsService,
  createDrizzleBnrsRepository,
  createEgovPayBnrsPaymentProvider,
  mapEgovSsoProfileToBnrsResidentialAddress,
} from "@repo/dx/bnrs";

const database = createDatabaseFromEnv();
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
const residentialAddress = mapEgovSsoProfileToBnrsResidentialAddress(session.rawProfile);

// The caller decides whether to reuse this or collect a USER_PROVIDED address.
if (!residentialAddress) throw new Error("Collect a complete business address from the user.");
await bnrs.setBusinessAddress({
  actor,
  applicationId: application.applicationId,
  address: residentialAddress,
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

After verified payment, DX generates a `BNRS-YYYYMMDD-XXXXXXXX` transaction reference and a separate mock DTI Certificate No./Business Name Number in `BNN-YYYYMMDD-XXXXXXXX` form. Payment sync returns only the transaction reference, certificate number, and issue time; it never exposes the owner or business address because the transaction UUID is not actor authorization. Fetch the structured JSON certificate afterward with actor-scoped `getCertificate`. Certificate issuance is part of the same idempotent database transition as payment completion, so payment retries and callback races preserve the first certificate identity.

The JSON certificate contains its certificate number, `DTI-BNRS` issuing agency, business and owner names, descriptor, territorial scope, structured business address, issue time, five-year validity, and `REGISTERED` status. The address source is not included in the certificate. The database stores only the certificate number and validity timestamp; all other fields are projected from authoritative normalized application, owner, and business-address records.

Use `listRegisteredBusinesses({ actor })` to retrieve the authenticated user's completed BNRS registrations, newest first. Each result includes the application ID, transaction reference, certificate number, business name, descriptor, scope, and issue time. Incomplete and abandoned applications are not returned. The list intentionally includes only the certificate number rather than duplicating the full certificate; pass that value to `getCertificate({ actor, certificateNumber })` to retrieve the current authoritative JSON certificate. Both operations are scoped to the authenticated eGov user.

## Catalog and fees

The package contains 40 stable descriptor IDs selected from the official BNRS descriptor list. It intentionally exposes descriptors only, not section/division/group/class/subclass classification. Sources: [BNRS descriptor file](https://dtibnrs.s3-ap-southeast-1.amazonaws.com/files/20260701/vl4wphmb3j0835.xlsx) and [DTI BNRS FAQ](https://bnrs.dti.gov.ph/faq).

| Scope             | Registration | DST    | Total     |
| ----------------- | ------------ | ------ | --------- |
| City/Municipality | PHP 500      | PHP 30 | PHP 530   |
| Regional          | PHP 1,000    | PHP 30 | PHP 1,030 |
| National          | PHP 2,000    | PHP 30 | PHP 2,030 |

Fee and descriptor values are snapshotted on each application so later catalog changes cannot alter an in-progress or completed record.

## Persistence

The Drizzle schema uses four tables:

- `bnrs_applications` for ownership, lifecycle, business name, scope, fee snapshot, registration result, certificate number, and certificate validity
- `bnrs_owner_information` for the one-to-one owner PII record
- `bnrs_business_addresses` for the one-to-one required business-address PII record and its source
- `bnrs_payments` for every hosted-payment attempt and provider reference

Run the generated migration through the `@repo/db` migration command before using the module.

## Deferred

- Civil status, email, and mobile are not mapped or stored.
- Refugee/stateless and related owner questions are skipped.
- Missing-field completeness checks are skipped; available owner values are stored silently.
- Barangay scope is not included yet.
- A fuller descriptor catalog and any database seeder will be added separately.
- Live DTI/BNRS API calls, agent tools, and application routes are outside this package.
- Certificate PDF generation and document storage are deferred; the structured JSON certificate is implemented.

# DX BIR demo helper

`@repo/dx/bir` currently exposes `assignDemoRdo` for the simplified BIR demo. The
helper randomly chooses a simulated assignment containing only the three-digit
code, a code-only label such as `RDO 047`, and `simulated: true`. The caller
should retain that result for the duration of its demo flow.

This is intentionally not an address-based BIR jurisdiction lookup. No city or
office name is returned, and the assignment must not be used for a real filing.
The current demo deliberately does not collect the Tax Type Questionnaire. That
questionnaire remains required for an actual NewBizReg filing and must not be
treated as optional.

# DX LGU business permits

`@repo/dx/lgu` is a separate, local mock of a straightforward sole-proprietor LGU business-permit flow. It accepts a structured business-name certificate credential containing the BNRS business address, derives the issuing city from that address, charges one fixed demo fee, and immediately issues both a business permit and barangay clearance after authoritative payment confirmation.

## Agency isolation and handoff

The LGU module does not import, call, query, or share persistence with the BNRS module. Neither DX has access to the other DX's service, repository, database tables, or domain types. The caller is responsible for retrieving a completed certificate from the appropriate source and passing only these structurally compatible details to LGU:

```ts
type LguBusinessRegistrationCredentialInput = {
  certificateNumber: string;
  issuingAgency: "DTI-BNRS";
  businessName: string;
  ownerName: string;
  descriptor: string;
  territorialScope: "CITY_MUNICIPALITY" | "REGIONAL" | "NATIONAL";
  businessAddress: {
    addressLine1: string;
    addressLine2?: string;
    barangay: string;
    cityMunicipality: string;
    province: string;
    region: string;
    postalCode: string;
  };
  issuedAt: string;
  validUntil: string;
  status: "REGISTERED";
};
```

LGU validates required fields, the complete structured address, the supported issuer and status, date consistency, expiry, and the normalized owner-name match. This is an input contract for the demo, not proof of certificate authenticity: LGU has no BNRS lookup or cryptographic verification. The orchestrating caller fetches the authoritative credential from BNRS and passes it to LGU; do not give LGU a BNRS repository or service instance.

Agent tools, routes, and orchestration are deliberately outside this package.

## Identity and applicant data

Create the actor only from the authenticated SSO profile's trusted `rawProfile.uniqid`:

```ts
const actor = { egovUserId: session.rawProfile.uniqid };
const applicant = mapEgovSsoProfileToLguApplicantInformation(session);
```

The actor ID is authorization context and is stored separately from applicant data. The mapper returns the normalized full owner name and, when SSO supplies it, the complete normalized TIN. The TIN is optional and is intentionally returned unmasked in this demo. Never accept `egovUserId` from a browser, certificate, or agent payload.

## Setup and usage

Use an LGU-owned repository and an independently configured eGovPay client. The SDK can be the same library used elsewhere, but credentials, settlement template, provider instance, and environment configuration belong to LGU:

```ts
import { createDatabaseFromEnv } from "@repo/db";
import { createEgovPayClient } from "@repo/egov/eGovPay";
import {
  createDrizzleLguRepository,
  createEgovPayLguPaymentProvider,
  createLguService,
} from "@repo/dx/lgu";

const database = createDatabaseFromEnv();
const repository = createDrizzleLguRepository(database);
const paymentProvider = createEgovPayLguPaymentProvider(
  createEgovPayClient({
    apiKey: process.env.LGU_EGOVPAY_API_KEY!,
    baseUrl: process.env.LGU_EGOVPAY_BASE_URL!,
    settlementTemplateUuid: process.env.LGU_EGOVPAY_SETTLEMENT_TEMPLATE_UUID!,
  }),
);
const lgu = createLguService({ repository, paymentProvider });

const application = await lgu.startOrResumeApplication({
  actor,
  applicant,
  certificate,
});
const checkout = await lgu.createPayment({
  actor,
  applicationId: application.applicationId,
  callbackUrl,
  redirectUrl,
});
```

Use `syncPaymentStatus({ transactionUuid })` from callback and return handling. Callback payloads do not decide the result: LGU reads the provider transaction and verifies its UUID, transaction ID, amount, and currency. Repeated checkout creation reuses the pending transaction. A failed, expired, or voided payment returns the application to `PAYMENT_READY`; a pending payment is provider-voided before abandonment. If payment won an abandonment race, the application completes instead.

Payment sync is deliberately not actor-scoped, so its result contains only application ID, lifecycle state, non-PII payment summary, and a `documentsIssued` boolean. It never returns the business address, city, applicant data, TIN, certificate details, or issued documents. After a return or callback, use actor-scoped `getStatus` or `getIssuedDocuments` to show the result to the authenticated owner.

If provider creation is interrupted, checkout retry and abandonment both reuse the stored callback/redirect URLs and the same logical transaction ID. Abandonment first recovers the provider transaction, then voids and authoritatively verifies it; LGU never abandons a possibly payable attempt only in local state.

The public service also provides `getStatus`, `getPaymentQuote`, `abandonApplication`, `listIssuedDocuments`, and actor-scoped `getIssuedDocuments`. Both issued documents are returned together.

## Lifecycle, business-address identity, and fee

```text
PAYMENT_READY -> PAYMENT_PENDING -> COMPLETED
       |                 |
       +-----> ABANDONED +-- failed / expired / voided -> PAYMENT_READY
```

LGU no longer accepts a separate city. It validates and stores the structured business address carried by the BNRS credential, and derives its city identity from `cityMunicipality`. Address fields are Unicode-normalized, trimmed, and whitespace-collapsed; the postal code must contain four digits. The demo does not use an address catalog, correct spelling, or enforce territorial-scope compatibility.

One non-abandoned application is allowed for each eGov user, certificate number, and normalized city. The same certificate can therefore produce permits in different cities. A matching retry resumes the immutable snapshot; different applicant or certificate details conflict. An unpaid application may be abandoned and replaced. Multiple branches for the same certificate in the same city are deferred.

The fee is a fixed PHP 2,500 for every city and is exposed as one line item that includes the barangay clearance. This demo has no city fee table, effective dates, fee versioning, or future fee-change behavior.

## Issued JSON documents

Verified payment immediately approves the application and atomically issues exactly one stable pair:

- Business permit number `LGU-BP-YYYY-XXXXXXXX`, permit type `NEW_BUSINESS`, `ACTIVE` status, issuing city, BNRS certificate number, business and owner details, optional full TIN, activity, certificate territorial scope, issue/validity dates, and PHP 2,500 total paid.
- Barangay clearance number `LGU-BC-YYYY-XXXXXXXX`, type `BARANGAY_BUSINESS_CLEARANCE`, `APPROVED` status, the same business/owner/activity data, issue/validity dates, and `includedInBusinessPermitFee: true`.

Both documents include the structured BNRS business address and expire at `23:59:59.999Z` on December 31 of their issue year. Payment callbacks and retries preserve the first numbers and timestamps.

## LGU persistence

The generated Drizzle migration adds three LGU-owned tables:

- `lgu_applications` stores lifecycle, the accepted credential, the required structured-address snapshot, derived city identity, and dedicated permit/clearance issuance columns.
- `lgu_applicant_information` stores the separate one-to-one owner name and optional TIN.
- `lgu_payments` stores every LGU hosted-payment attempt and provider reference.

No JSON document blob or separate barangay-clearance table is used. Run the `@repo/db` migration command before using the module.

## LGU deferred and out of scope

- Certificate authenticity checks and direct BNRS access
- Territorial-scope-to-city compatibility rules and authoritative city/barangay catalogs
- Multiple same-city branches
- Terms, undertakings, and additional form stages
- TIN verification
- Capitalization, employees, tenancy, cedula, and ancillary permits
- Review, inspections, and processing delays
- Renewals, amendments, cancellation, revocation, and post-release workflows
- PDF generation, document storage, UI/routes, and agent integration
