import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Stagehand, type Page, type Variables } from "@browserbasehq/stagehand";
import { z } from "zod";
import { readFlowConfig } from "./config.js";

const config = readFlowConfig();
const dominantBusinessName = config.businessName;
const registeredBusinessName = `${dominantBusinessName} COFFEE SHOP`;
const registeredBusinessNamePattern = new RegExp(
  registeredBusinessName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  "i",
);
const sourceDirectory = path.dirname(fileURLToPath(import.meta.url));
const artifactDirectory = path.resolve(sourceDirectory, "..", "artifacts", config.runId);
const steps: { name: string; status: "passed" | "failed"; url: string }[] = [];
const startedAt = new Date();
let stagehand: Stagehand | undefined;
let lastStep = "initialization";

const sleep = (milliseconds: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  });

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function filename(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

async function activePage() {
  assert(stagehand, "Stagehand has not been initialized.");
  return stagehand.context.awaitActivePage(3_000);
}

async function bodyText(page?: Page) {
  const currentPage = page ?? (await activePage());
  return currentPage.evaluate(() => document.body?.innerText ?? "");
}

async function screenshot(name: string) {
  const page = await activePage();
  await page.screenshot({
    animations: "disabled",
    fullPage: true,
    path: path.join(
      artifactDirectory,
      `${String(steps.length + 1).padStart(2, "0")}-${filename(name)}.png`,
    ),
  });
}

async function pass(name: string) {
  const page = await activePage();
  steps.push({ name, status: "passed", url: page.url() });
  await screenshot(name);
  console.log(`✓ ${name}`);
}

/** The subset of Stagehand's act options this flow sets. */
type ActOptions = { timeout: number; variables?: Variables };

async function act(name: string, instruction: string, variables?: Variables) {
  assert(stagehand, "Stagehand has not been initialized.");
  lastStep = name;
  console.log(`→ ${name}`);
  const actOptions: ActOptions = { timeout: 90_000 };
  if (variables) actOptions.variables = variables;
  const result = await stagehand.act(instruction, actOptions);
  assert.equal(
    result.success,
    true,
    `Stagehand could not ${name}: ${result.message || result.actionDescription}`,
  );
  await (await activePage()).waitForTimeout(500);
}

async function clickControl(name: string, selector: string) {
  lastStep = name;
  console.log(`→ ${name}`);
  const deadline = Date.now() + 30_000;
  let count = 0;
  while (Date.now() < deadline) {
    const page = await activePage();
    count = await page.locator(selector).count();
    if (count > 1)
      assert.fail(
        `Expected one enabled control for ${name}, but found ${count} using selector ${JSON.stringify(selector)}.`,
      );
    if (count === 1) {
      const clicked = await page.evaluate((target) => {
        const element = document.querySelector(target);
        if (!(element instanceof HTMLElement)) return false;
        element.click();
        return true;
      }, selector);
      assert.equal(clicked, true, `${name} should click its resolved browser element.`);
      await page.waitForTimeout(500);
      return;
    }
    await sleep(250);
  }
  assert.equal(
    count,
    1,
    `Timed out waiting for one enabled control for ${name}, using selector ${JSON.stringify(selector)}.`,
  );
}

async function clickLabeledOption(name: string, label: string) {
  lastStep = name;
  console.log(`→ ${name}`);
  const page = await activePage();
  const options = page.locator("label[data-cuelume-toggle='toggle']");
  const matches: number[] = [];
  for (let index = 0; index < (await options.count()); index += 1) {
    const text = normalizeText(await options.nth(index).innerText());
    if (text === label || text.startsWith(`${label} `)) matches.push(index);
  }
  assert.equal(matches.length, 1, `Expected one visible option labelled ${JSON.stringify(label)}.`);
  await options.nth(matches[0]!).click();
  await page.waitForTimeout(500);
}

async function clickButtonContaining(name: string, expected: string) {
  lastStep = name;
  console.log(`→ ${name}`);
  const page = await activePage();
  const buttons = page.locator("button");
  const matches: number[] = [];
  for (let index = 0; index < (await buttons.count()); index += 1) {
    const text = normalizeText(await buttons.nth(index).innerText());
    if (text.toLocaleLowerCase("en-PH").includes(expected.toLocaleLowerCase("en-PH")))
      matches.push(index);
  }
  assert.equal(
    matches.length,
    1,
    `Expected one visible button containing ${JSON.stringify(expected)}.`,
  );
  await buttons.nth(matches[0]!).click();
  await page.waitForTimeout(500);
}

async function typeField(name: string, selector: string, value: string) {
  lastStep = name;
  console.log(`→ ${name}`);
  const page = await activePage();
  const field = page.locator(selector);
  assert.equal(
    await field.count(),
    1,
    `Expected one text field for ${name}, using selector ${JSON.stringify(selector)}.`,
  );
  await field.click();
  await field.type(value, { delay: 5 });
  assert.equal(await field.inputValue(), value, `${name} should populate the expected value.`);
  await page.waitForTimeout(500);
}

async function waitFor(
  description: string,
  predicate: (input: { text: string; url: string }) => boolean,
  timeout = 180_000,
) {
  const deadline = Date.now() + timeout;
  let latest = { text: "", url: "" };
  while (Date.now() < deadline) {
    try {
      const page = await activePage();
      latest = { text: await bodyText(page), url: page.url() };
      if (predicate(latest)) return latest;
    } catch {
      // Navigation can briefly invalidate an evaluation. Poll the current active page again.
    }
    await sleep(750);
  }
  throw new Error(
    `Timed out waiting for ${description} at ${latest.url}.\nLast page text:\n${normalizeText(latest.text).slice(-1_500)}`,
  );
}

async function waitForText(description: string, expected: string | RegExp, timeout = 180_000) {
  return waitFor(
    description,
    ({ text }) => (expected instanceof RegExp ? expected.test(text) : text.includes(expected)),
    timeout,
  );
}

async function expectBody(expected: string | RegExp, message: string) {
  const text = await bodyText();
  assert(
    expected instanceof RegExp ? expected.test(text) : text.includes(expected),
    `${message}\nCurrent page text:\n${normalizeText(text).slice(-1_500)}`,
  );
}

async function completePayment(input: {
  amount: RegExp;
  card: string;
  next: RegExp;
  service: string;
}) {
  const { amount, card, next, service } = input;
  await waitForText(`${service} payment card`, card);
  await expectBody(amount, `${service} should show the expected staging amount.`);
  await act(
    `open ${service} payment`,
    `In the latest unpaid ${service} card at the bottom of the eGovPH Business chat, click its payment button.`,
  );
  await waitForText(`${service} secure-payment dialog`, "Continue to secure payment");
  await expectBody(amount, `${service} payment dialog should preserve the expected amount.`);
  await act(
    `continue ${service} to eGovPay`,
    "In the secure eGovPay dialog, click the primary “Continue to eGovPay” button.",
  );
  await waitFor(
    `${service} hosted checkout`,
    ({ text, url }) =>
      !url.startsWith(config.baseUrl.origin) && /Cash Payments|Payment Method|Pay Now/i.test(text),
  );
  await screenshot(`${service} hosted checkout`);
  await act(
    `select Cash Payments for ${service}`,
    "On the hosted eGovPay checkout, select the “Cash Payments” payment method. Do not select a card, bank, or wallet.",
  );
  await act(
    `submit ${service} payment`,
    "On the Cash Payments checkout, click the enabled “Pay Now” button to continue in the staging payment flow.",
  );
  try {
    await waitForText(`${service} staging confirmation`, /Mark as Paid/i, 60_000);
  } catch (error) {
    const checkout = await activePage();
    const state = await bodyText(checkout);
    if (!/\bINITIAL\b/i.test(state) || !/Loading/i.test(state)) throw error;
    await checkout.goto(checkout.url(), { waitUntil: "load", timeoutMs: 30_000 });
    const reloaded = await waitFor(
      `${service} reloaded checkout`,
      ({ text }) => /Mark as Paid|Cash Payments|Pay Now/i.test(text),
      30_000,
    );
    if (!/Mark as Paid/i.test(reloaded.text)) {
      await act(
        `reselect Cash Payments for ${service}`,
        `The ${service} staging checkout was still INITIAL after a gateway loading timeout. Select “Cash Payments” again after this single reload.`,
      );
      const selected = await waitFor(
        `${service} payment method after reload`,
        ({ text }) => /Mark as Paid|Pay Now/i.test(text),
        30_000,
      );
      if (!/Mark as Paid/i.test(selected.text))
        await act(
          `retry ${service} payment once`,
          `The ${service} staging transaction is still explicitly INITIAL. Click the enabled “Pay Now” button once to retry the test checkout.`,
        );
      await waitForText(`${service} staging confirmation after retry`, /Mark as Paid/i, 90_000);
    }
  }
  await act(
    `mark ${service} paid`,
    "This is the explicitly authorized eGovPay test checkout. Click “Mark as Paid”.",
  );
  await waitForText(
    `${service} paid result`,
    /Transaction Success|Payment Successful|PAID/i,
    90_000,
  );
  await sleep(5_000);
  await act(
    `return ${service} to merchant`,
    "Click “Go Back to Merchant” (or the equivalent “Back to merchant” button) after the successful test payment.",
  );
  await waitFor(
    `${service} merchant return`,
    ({ url }) => url.startsWith(config.baseUrl.origin),
    90_000,
  );
  try {
    await waitForText(`${service} continuation`, next, 45_000);
  } catch (error) {
    const merchant = await activePage();
    if (!merchant.url().includes("payment=return")) throw error;
    await merchant.goto(merchant.url(), { waitUntil: "load", timeoutMs: 30_000 });
    await waitForText(`${service} continuation after status refresh`, next, 180_000);
  }
  await pass(`${service} paid and continued`);
}

async function run() {
  await mkdir(artifactDirectory, { recursive: true });
  const health = await fetch(config.baseUrl);
  assert(health.ok, `Expected ${config.baseUrl} to be running, received HTTP ${health.status}.`);

  stagehand = new Stagehand({
    env: "LOCAL",
    model: {
      apiKey: config.modelApiKey,
      modelName: config.model,
    },
    cacheDir: path.resolve(sourceDirectory, "..", ".stagehand-cache", config.runId),
    domSettleTimeout: 2_500,
    localBrowserLaunchOptions: {
      headless: config.headless,
      viewport: { width: 1440, height: 1050 },
    },
    selfHeal: true,
    systemPrompt:
      "You are testing a local eGovPH Business demo. Act only on the active visible controls. Prefer the bottom-most active checkpoint or latest unpaid card. Never change the requested values or payment method.",
    verbose: 1,
  });
  await stagehand.init();

  const page = await activePage();
  await page.goto(new URL("/api/auth/dev-login", config.baseUrl).toString(), {
    waitUntil: "load",
    timeoutMs: 30_000,
  });
  await waitForText("authenticated home", "Hi, Josh", 60_000);
  await pass("dev session authenticated");

  await page.reload({ waitUntil: "load", timeoutMs: 30_000 });
  await waitForText("authenticated home after reload", "Hi, Josh", 60_000);
  const authenticatedHome = await bodyText(page);
  assert(
    !/Sign in again|Sign in to eGovPH/i.test(authenticatedHome),
    "Reloading must restore the authenticated session instead of showing remembered-account login.",
  );
  await pass("authenticated session survives reload");

  await act(
    "open Business",
    "On the eGovPH home screen, click the interactive Business service tile.",
  );
  await waitForText("Business landing", /Describe your business|Start something new/);
  await typeField(
    "fill registration idea",
    "[aria-label='Describe your business idea']",
    "I want to start a coffee subscription business in Makati",
  );
  await clickControl("submit registration idea", "[aria-label='Continue']:not(:disabled)");
  await waitForText(
    "registration intake",
    /Which part of Makati|Where will you prepare the food or drinks/i,
    240_000,
  );

  await clickLabeledOption("choose South Makati RDO", "South Makati");
  await clickControl("continue after RDO", "form button[type='submit']:not(:disabled)");
  await waitForText("premises checkpoint", "Where will you prepare the food or drinks?");
  await clickLabeledOption("choose commercial premises", "Commercial kitchen or shop");
  await clickControl("continue after premises", "form button[type='submit']:not(:disabled)");
  await waitForText("staffing checkpoint", "Will you hire anyone?");
  await clickLabeledOption("declare employees", "Yes");
  await clickControl("continue after employees", "form button[type='submit']:not(:disabled)");
  await waitForText("address checkpoint", "Which address should this registration use?");
  await clickLabeledOption("use profile address", "Use my registered eGov address");
  await clickControl("continue after address", "form button[type='submit']:not(:disabled)");
  await waitForText("BNRS terms checkpoint", "Do you accept the BNRS terms and conditions?");
  await clickLabeledOption("accept BNRS terms", "I accept");
  await clickControl("continue after BNRS terms", "form button[type='submit']:not(:disabled)");
  await waitForText("dominant-name checkpoint", "What distinctive name do you want to register?");
  await typeField(
    "enter dominant business name",
    "input[placeholder='For example, Molar Bear']",
    dominantBusinessName,
  );
  await clickControl("submit intake batch", "form button[type='submit']:not(:disabled)");
  await waitForText(
    "BNRS descriptor checkpoint",
    "Which BNRS descriptor best matches the business?",
  );
  await clickLabeledOption("choose coffee-shop descriptor", "COFFEE SHOP");
  await clickControl("continue after descriptor", "form button[type='submit']:not(:disabled)");
  await waitForText("territorial-scope checkpoint", "Where should the business name be protected?");
  await clickLabeledOption("choose city scope", "City / municipality");
  await clickControl("submit BNRS identity", "form button[type='submit']:not(:disabled)");
  await waitForText("DTI application draft", "Submit and pay", 240_000);
  await expectBody(
    registeredBusinessName,
    "The DTI draft should combine the dominant name and BNRS descriptor.",
  );
  await pass("registration intake completed");

  await completePayment({
    amount: /(?:₱|PHP)?\s*530(?:\.00)?/,
    card: "Submit and pay",
    next: /Business permit \+ barangay clearance|Combined LGU fee/i,
    service: "DTI business-name registration",
  });
  await completePayment({
    amount: /(?:₱|PHP)?\s*2,?500(?:\.00)?/,
    card: "Combined LGU fee",
    next: /BIR Form 1901|Final registration payment/i,
    service: "DX LGU business permit",
  });
  await completePayment({
    amount: /(?:₱|PHP)?\s*30(?:\.00)?/,
    card: "Final registration payment",
    next: /Registration plan complete|Open records and tax calendar|Certificate of Registration/i,
    service: "BIR Documentary Stamp Tax",
  });

  await waitForText("completed registration plan", "7/7", 240_000);
  await expectBody(
    registeredBusinessNamePattern,
    "The finalization card should name the created business.",
  );
  await act(
    "open finalized business record",
    "Click the completed business card for %businessName% that says “Open records and tax calendar”.",
    { businessName: registeredBusinessName },
  );
  await waitForText("finalized business record", "View CoR (2303)", 90_000);
  await expectBody(
    registeredBusinessNamePattern,
    "The business record should show the created business.",
  );
  await pass("business record opened");

  await act("open Records tab", "In the Business record, click the “Records” tab.");
  await waitForText("records summary", "4 records");
  await expectBody(
    /Taxpayer Registration/i,
    "The records should include the finalized BIR taxpayer registration.",
  );
  await pass("records tab verified");

  await act("open Files tab", "In the Business record, click the “Files” tab.");
  await waitForText("files summary", "2 files");
  await expectBody(/BIR Form 1901/i, "The files should include the generated BIR Form 1901.");
  await expectBody(
    /BIR Certificate of Registration \(Form 2303\)/i,
    "The files should include the generated BIR Certificate of Registration.",
  );
  await pass("files tab verified");

  await act("open Tax calendar tab", "In the Business record, click the “Tax calendar” tab.");
  await waitForText("tax calendar", "Upcoming obligations");
  assert(stagehand, "Stagehand has not been initialized.");
  const taxCalendar = await stagehand.extract(
    "Read the visible Tax calendar and return each obligation card exactly once.",
    z.object({
      obligations: z.array(
        z.object({
          formCode: z.string(),
          title: z.string(),
        }),
      ),
    }),
  );
  assert.equal(
    taxCalendar.obligations.length,
    4,
    `Expected four tax obligations, found ${taxCalendar.obligations.length}.`,
  );
  await pass("tax calendar verified");

  await act("return to Overview", "In the Business record, click the “Overview” tab.");
  await waitForText("overview assistant", "Recent chats");
  await act(
    "start first management chat",
    "In the Recent chats section, click the plus button labelled to start a new chat about this business.",
  );
  await waitForText("first management chat", "How can I help?");
  await typeField(
    "fill tax-calendar question",
    "textarea[placeholder='Ask about your business…']",
    "What is next on my tax calendar?",
  );
  await clickControl("send tax-calendar question", "[aria-label='Send']:not(:disabled)");
  await waitForText("tax-calendar answer", /demo reminders|Confirm.*BIR/i, 180_000);
  await expectBody(
    /BIR Form/i,
    "The management answer should be grounded in the saved tax calendar.",
  );
  await typeField(
    "fill fire-safety question",
    "textarea[placeholder='Ask about your business…']",
    "Do I still need to do anything for fire safety?",
  );
  await clickControl("send fire-safety question", "[aria-label='Send']:not(:disabled)");
  await waitForText("fire-safety answer", /Bureau of Fire Protection|BFP/i, 180_000);
  await expectBody(
    /(?:don.t (?:see|have)|no)[^.\n]{0,96}fire[- ]?safety/i,
    "The management answer should not invent an unsaved fire-safety certificate.",
  );
  await pass("first management chat answered business questions");

  await act("back to record from first chat", "Click the chat header’s “Go back” button.");
  await waitForText("record after first chat", "Recent chats");
  await act(
    "reopen first management chat",
    "In Recent chats, open the most recently updated existing chat row, not the plus button.",
  );
  await waitForText("reopened first chat", "What is next on my tax calendar?");
  await expectBody(
    "Do I still need to do anything for fire safety?",
    "Both user messages should persist after reopening the first chat.",
  );
  await pass("first management chat persisted");

  await act("back to record for second chat", "Click the chat header’s “Go back” button.");
  await waitForText("record before second chat", "Recent chats");
  await act(
    "start second management chat",
    "In the Recent chats section, click the plus button labelled to start another new chat about this business.",
  );
  await waitForText("second management chat", "How can I help?");
  await typeField(
    "fill files question",
    "textarea[placeholder='Ask about your business…']",
    "Which business files do I have saved?",
  );
  await clickControl("send files question", "[aria-label='Send']:not(:disabled)");
  await waitForText(
    "files answer",
    /These files are saved|BIR Certificate of Registration|BIR Form 1901/i,
    180_000,
  );
  await pass("second management chat answered files question");

  await act("back to record with two chats", "Click the chat header’s “Go back” button.");
  await waitForText("record with two chats", "Recent chats");
  const recentChats = await stagehand.extract(
    "In the Recent chats section only, count existing conversation rows. Exclude the plus/new-chat button.",
    z.object({ count: z.number().int().nonnegative() }),
  );
  assert.equal(
    recentChats.count,
    2,
    `Expected two recent business chats, found ${recentChats.count}.`,
  );
  await pass("two per-business chat sessions listed");

  await act("return to business list", "Click the Business record header’s “Go back” button.");
  await waitForText("business list", "Your businesses");
  await expectBody(
    registeredBusinessNamePattern,
    "The new business should appear in the business list.",
  );
  await clickControl("return to eGovPH home", "[aria-label='Go back']");
  await waitForText("eGovPH home after flow", "Hi, Josh");
  await act("reopen Business from home", "Click the interactive Business service tile.");
  await waitForText("business list after home navigation", registeredBusinessNamePattern);
  await clickButtonContaining("reopen created business", registeredBusinessName);
  await waitForText("reopened business record", "Recent chats");
  const persistedChats = await stagehand.extract(
    "In the Recent chats section only, count existing conversation rows. Exclude the plus/new-chat button.",
    z.object({ count: z.number().int().nonnegative() }),
  );
  assert.equal(
    persistedChats.count,
    2,
    "Both chat sessions should remain linked to this business.",
  );
  await pass("business and chats persist across home navigation");

  const metrics = await stagehand.metrics;
  return {
    artifactDirectory,
    businessName: registeredBusinessName,
    finishedAt: new Date().toISOString(),
    metrics,
    runId: config.runId,
    startedAt: startedAt.toISOString(),
    steps,
  };
}

try {
  const report = await run();
  await writeFile(
    path.join(artifactDirectory, "report.json"),
    `${JSON.stringify({ ...report, status: "passed" }, null, 2)}\n`,
  );
  console.log(`\nWhole business flow passed. Artifacts: ${artifactDirectory}`);
} catch (error) {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  steps.push({
    name: lastStep,
    status: "failed",
    url: stagehand ? (await activePage().catch(() => undefined))?.url() || "" : "",
  });
  if (stagehand) await screenshot(`failure-${lastStep}`).catch(() => undefined);
  await mkdir(artifactDirectory, { recursive: true });
  await writeFile(
    path.join(artifactDirectory, "report.json"),
    `${JSON.stringify(
      {
        businessName: registeredBusinessName,
        error: message,
        finishedAt: new Date().toISOString(),
        runId: config.runId,
        startedAt: startedAt.toISOString(),
        status: "failed",
        steps,
      },
      null,
      2,
    )}\n`,
  );
  console.error(message);
  process.exitCode = 1;
} finally {
  await stagehand?.close().catch(() => undefined);
}
