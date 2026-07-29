import { createClient, eMessage } from "egov.js";

function printUsage(): void {
  console.log('Usage: bun scripts/send-emessage.ts <E.164 number> "<message>"');
  console.log('Example: bun scripts/send-emessage.ts +639171234567 "Hello World"');
}

const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  printUsage();
  process.exit(0);
}

const [number, ...messageParts] = args;
const message = messageParts.join(" ").trim();

if (!number || !message) {
  printUsage();
  process.exit(1);
}

if (!/^\+[1-9]\d{7,14}$/.test(number)) {
  throw new Error(`Invalid E.164 number: ${number}`);
}

const baseUrl = process.env.EMESSAGE_BASE_URL?.trim();

if (!baseUrl) {
  throw new Error("Missing required eGov environment variable: EMESSAGE_BASE_URL");
}

const accessToken = process.env.EMESSAGE_ACCESS_TOKEN?.trim();

if (!accessToken) {
  throw new Error("Missing required eGov environment variable: EMESSAGE_ACCESS_TOKEN");
}

const client = createClient({ baseUrl });
const response = await eMessage.sendSms({
  auth: accessToken,
  body: { message, number },
  client,
  throwOnError: true,
});

console.log(JSON.stringify({ message, number, response }, null, 2));
