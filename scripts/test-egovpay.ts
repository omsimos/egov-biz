import { createHmac } from "node:crypto";
import { createClient, egovPay } from "egov.js";

// Verified staging fixture links:
// Success:
// https://egovpay-pgi-dev.oueg.info/a2503297-f00b-4bb2-8bca-d423e52533b5
// Unable to process:
// https://egovpay-pgi-dev.oueg.info/a2502edc-838d-4210-82ca-44082ed7df8b

function printUsage(): void {
  console.log("Usage:");
  console.log("  bun scripts/test-egovpay.ts create [amount] [transaction-id]");
  console.log("  bun scripts/test-egovpay.ts status <transaction-uuid>");
  console.log("  bun scripts/test-egovpay.ts void <transaction-uuid>");
}

function requireEnvironment(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required eGov environment variable: ${name}`);
  }

  return value;
}

function requireStagingApiKey(): string {
  const apiKey = requireEnvironment("EGOVPAY_API_KEY");

  if (!apiKey.startsWith("test_")) {
    throw new Error("This one-off script only accepts an EGOVPAY_API_KEY with a test_ prefix");
  }

  return apiKey;
}

function requireTransactionUuid(value: string | undefined): string {
  if (
    !value ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  ) {
    throw new Error("A valid transaction UUID is required");
  }

  return value;
}

function createEgovPayDigest(amount: number, transactionId: string, apiKey: string) {
  return createHmac("sha256", apiKey).update(`${amount}|${transactionId}`).digest("hex");
}

async function createPayment(amountArg: string | undefined, transactionIdArg: string | undefined) {
  const amount = amountArg === undefined ? 1000 : Number(amountArg);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`Invalid payment amount: ${amountArg}`);
  }

  const baseUrl = requireEnvironment("EGOVPAY_BASE_URL");
  const apiKey = requireStagingApiKey();
  const settlementTemplateUuid = requireEnvironment("EGOVPAY_SETTLEMENT_TEMPLATE_UUID");
  const transactionId = transactionIdArg?.trim() || `CODEX-STAGING-${Date.now()}`;

  // The staging gateway uses the test_ prefix to select the environment, but
  // validates the HMAC against the token value after that prefix is removed.
  const digest = createEgovPayDigest(amount, transactionId, apiKey.slice(5));
  const client = createClient({ baseUrl });
  const created = await egovPay.generatePayment({
    auth: apiKey,
    body: {
      amount,
      callback_url: "https://example.com/egovpay/callback",
      currency: "PHP",
      digest,
      email: "sandbox@example.com",
      items: [{ amount, name: "eGovPay staging test" }],
      mobile: "09170000000",
      name: "Sandbox Tester",
      redirect_url: "https://example.com/egovpay/complete",
      settlement_template_uuid: settlementTemplateUuid,
      txnid: transactionId,
    },
    client,
    throwOnError: true,
  });

  console.log(
    JSON.stringify(
      {
        ...created,
        next: [
          "Open data.url",
          "Select Cash Payments",
          "Click Pay Now",
          "Use Mark as Paid or Mark as Failed in Test Mode",
        ],
      },
      null,
      2,
    ),
  );
}

async function getPaymentStatus(transactionUuidArg: string | undefined) {
  const baseUrl = requireEnvironment("EGOVPAY_BASE_URL");
  const apiKey = requireStagingApiKey();
  const client = createClient({ baseUrl });
  const response = await egovPay.getTransaction({
    auth: apiKey,
    client,
    path: { uuid: requireTransactionUuid(transactionUuidArg) },
    throwOnError: true,
  });

  console.log(JSON.stringify(response, null, 2));
}

async function voidPayment(transactionUuidArg: string | undefined) {
  const baseUrl = requireEnvironment("EGOVPAY_BASE_URL");
  const apiKey = requireStagingApiKey();
  const transactionUuid = requireTransactionUuid(transactionUuidArg);
  const client = createClient({ baseUrl });
  const voided = await egovPay.voidTransaction({
    auth: apiKey,
    client,
    path: { uuid: transactionUuid },
    throwOnError: true,
  });
  const transaction = await egovPay.getTransaction({
    auth: apiKey,
    client,
    path: { uuid: transactionUuid },
    throwOnError: true,
  });

  console.log(JSON.stringify({ transaction, voided }, null, 2));
}

const [command, firstArgument, secondArgument] = process.argv.slice(2);

switch (command) {
  case "create":
    await createPayment(firstArgument, secondArgument);
    break;
  case "status":
    await getPaymentStatus(firstArgument);
    break;
  case "void":
    await voidPayment(firstArgument);
    break;
  case "--help":
  case "-h":
    printUsage();
    break;
  default:
    printUsage();
    process.exitCode = 1;
}
