import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Stagehand, type Page, type Variables } from "@browserbasehq/stagehand";
import { z } from "zod";
import type { FlowConfig } from "./config.js";

/** Everything in a scenario report is serialized with JSON.stringify. */
type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export type ReportDetails = Record<string, JsonValue>;

/** The subset of Stagehand's act options this harness sets. */
type ActOptions = { timeout: number; variables?: Variables };

type Step = {
  name: string;
  status: "passed" | "failed";
  url: string;
};

type ScenarioOptions = {
  config: FlowConfig;
  id: string;
  title: string;
};

const sourceDirectory = path.dirname(fileURLToPath(import.meta.url));
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

export class ScenarioHarness {
  readonly artifactDirectory: string;
  readonly config: FlowConfig;
  readonly id: string;
  readonly title: string;

  private lastStep = "initialization";
  private stagehand: Stagehand | undefined;
  private readonly startedAt = new Date();
  private readonly steps: Step[] = [];

  constructor(options: ScenarioOptions) {
    this.config = options.config;
    this.id = options.id;
    this.title = options.title;
    this.artifactDirectory = path.resolve(
      sourceDirectory,
      "..",
      "artifacts",
      `${this.config.runId}-${this.id}`,
    );
  }

  async initialize() {
    await mkdir(this.artifactDirectory, { recursive: true });
    const health = await fetch(this.config.baseUrl);
    assert(
      health.ok,
      `Expected ${this.config.baseUrl} to be running, received HTTP ${health.status}.`,
    );

    this.stagehand = new Stagehand({
      env: "LOCAL",
      model: {
        apiKey: this.config.modelApiKey,
        modelName: this.config.model,
      },
      cacheDir: path.resolve(
        sourceDirectory,
        "..",
        ".stagehand-cache",
        `${this.config.runId}-${this.id}`,
      ),
      domSettleTimeout: 2_500,
      localBrowserLaunchOptions: {
        headless: this.config.headless,
        viewport: { width: 1440, height: 1050 },
      },
      selfHeal: true,
      systemPrompt:
        "You are testing a local eGovPH Business demo. Act only on active visible controls. Prefer the bottom-most active checkpoint or latest unpaid card. Never invent or alter the scenario’s requested business details or payment method.",
      verbose: 1,
    });
    await this.stagehand.init();
  }

  async activePage() {
    assert(this.stagehand, "Stagehand has not been initialized.");
    return this.stagehand.context.awaitActivePage(3_000);
  }

  async bodyText(page?: Page) {
    const currentPage = page ?? (await this.activePage());
    return currentPage.evaluate(() => document.body?.innerText ?? "");
  }

  async screenshot(name: string) {
    const page = await this.activePage();
    await page.screenshot({
      animations: "disabled",
      fullPage: true,
      path: path.join(
        this.artifactDirectory,
        `${String(this.steps.length + 1).padStart(2, "0")}-${filename(name)}.png`,
      ),
    });
  }

  async pass(name: string) {
    const page = await this.activePage();
    this.steps.push({ name, status: "passed", url: page.url() });
    await this.screenshot(name);
    console.log(`✓ ${name}`);
  }

  async act(name: string, instruction: string, variables?: Variables) {
    assert(this.stagehand, "Stagehand has not been initialized.");
    this.lastStep = name;
    console.log(`→ ${name}`);
    const actOptions: ActOptions = { timeout: 90_000 };
    if (variables) actOptions.variables = variables;
    const result = await this.stagehand.act(instruction, actOptions);
    assert.equal(
      result.success,
      true,
      `Stagehand could not ${name}: ${result.message || result.actionDescription}`,
    );
    await (await this.activePage()).waitForTimeout(500);
  }

  async clickControl(name: string, selector: string) {
    this.lastStep = name;
    console.log(`→ ${name}`);
    const deadline = Date.now() + 30_000;
    let count = 0;
    while (Date.now() < deadline) {
      const page = await this.activePage();
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

  async clickLabeledOption(name: string, label: string) {
    this.lastStep = name;
    console.log(`→ ${name}`);
    const page = await this.activePage();
    const options = page.locator("label[data-cuelume-toggle='toggle']");
    const matches: number[] = [];
    for (let index = 0; index < (await options.count()); index += 1) {
      const text = normalizeText(await options.nth(index).innerText());
      if (text === label || text.startsWith(`${label} `)) matches.push(index);
    }
    assert.equal(
      matches.length,
      1,
      `Expected one visible option labelled ${JSON.stringify(label)}.`,
    );
    await options.nth(matches[0]!).click();
    await page.waitForTimeout(500);
  }

  async typeField(name: string, selector: string, value: string) {
    this.lastStep = name;
    console.log(`→ ${name}`);
    const page = await this.activePage();
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

  async waitFor(
    description: string,
    predicate: (input: { text: string; url: string }) => boolean,
    timeout = 180_000,
  ) {
    const deadline = Date.now() + timeout;
    let latest = { text: "", url: "" };
    while (Date.now() < deadline) {
      try {
        const page = await this.activePage();
        latest = { text: await this.bodyText(page), url: page.url() };
        if (predicate(latest)) return latest;
      } catch {
        // Navigation can briefly invalidate an evaluation. Poll the active page again.
      }
      await sleep(750);
    }
    throw new Error(
      `Timed out waiting for ${description} at ${latest.url}.\nLast page text:\n${normalizeText(latest.text).slice(-1_500)}`,
    );
  }

  async waitForText(description: string, expected: string | RegExp, timeout = 180_000) {
    return this.waitFor(
      description,
      ({ text }) => (expected instanceof RegExp ? expected.test(text) : text.includes(expected)),
      timeout,
    );
  }

  async expectBody(expected: string | RegExp, message: string) {
    const text = await this.bodyText();
    assert(
      expected instanceof RegExp ? expected.test(text) : text.includes(expected),
      `${message}\nCurrent page text:\n${normalizeText(text).slice(-1_500)}`,
    );
  }

  async expectBodyNot(expected: string | RegExp, message: string) {
    const text = await this.bodyText();
    assert(
      expected instanceof RegExp ? !expected.test(text) : !text.includes(expected),
      `${message}\nCurrent page text:\n${normalizeText(text).slice(-1_500)}`,
    );
  }

  async expectDtiApplication(expected: { proposedBusinessName: string; businessActivity: string }) {
    assert(this.stagehand, "Stagehand has not been initialized.");
    const application = await this.stagehand.extract(
      "Read only the visible DTI Business name registration Application draft card. Return its exact Proposed business name and Business activity row values.",
      z.object({
        proposedBusinessName: z.string(),
        businessActivity: z.string(),
      }),
    );
    assert.deepEqual(
      application,
      expected,
      "The DTI application should exactly preserve the scenario's business name and activity.",
    );
  }

  async completePayment(input: { amount: RegExp; card: string; next: RegExp; service: string }) {
    const { amount, card, next, service } = input;
    await this.waitForText(`${service} payment card`, card);
    await this.expectBody(amount, `${service} should show the expected staging amount.`);
    await this.act(
      `open ${service} payment`,
      `In the latest unpaid ${service} card at the bottom of the eGovPH Business chat, click its payment button.`,
    );
    await this.waitForText(`${service} secure-payment dialog`, "Continue to secure payment");
    await this.expectBody(amount, `${service} payment dialog should preserve the expected amount.`);
    await this.act(
      `continue ${service} to eGovPay`,
      "In the secure eGovPay dialog, click the primary “Continue to eGovPay” button.",
    );
    await this.waitFor(
      `${service} hosted checkout`,
      ({ text, url }) =>
        !url.startsWith(this.config.baseUrl.origin) &&
        /Cash Payments|Payment Method|Pay Now/i.test(text),
    );
    await this.screenshot(`${service} hosted checkout`);
    await this.act(
      `select Cash Payments for ${service}`,
      "On the hosted eGovPay checkout, select the “Cash Payments” payment method. Do not select a card, bank, or wallet.",
    );
    await this.act(
      `submit ${service} payment`,
      "On the Cash Payments checkout, click the enabled “Pay Now” button to continue in the staging payment flow.",
    );
    try {
      await this.waitForText(`${service} staging confirmation`, /Mark as Paid/i, 60_000);
    } catch (error) {
      const checkout = await this.activePage();
      const state = await this.bodyText(checkout);
      if (!/\bINITIAL\b/i.test(state) || !/Loading/i.test(state)) throw error;
      await checkout.goto(checkout.url(), { waitUntil: "load", timeoutMs: 30_000 });
      const reloaded = await this.waitFor(
        `${service} reloaded checkout`,
        ({ text }) => /Mark as Paid|Cash Payments|Pay Now/i.test(text),
        30_000,
      );
      if (!/Mark as Paid/i.test(reloaded.text)) {
        await this.act(
          `reselect Cash Payments for ${service}`,
          `The ${service} staging checkout was still INITIAL after a gateway loading timeout. Select “Cash Payments” again after this single reload.`,
        );
        const selected = await this.waitFor(
          `${service} payment method after reload`,
          ({ text }) => /Mark as Paid|Pay Now/i.test(text),
          30_000,
        );
        if (!/Mark as Paid/i.test(selected.text))
          await this.act(
            `retry ${service} payment once`,
            `The ${service} staging transaction is still explicitly INITIAL. Click the enabled “Pay Now” button once to retry the test checkout.`,
          );
        await this.waitForText(
          `${service} staging confirmation after retry`,
          /Mark as Paid/i,
          90_000,
        );
      }
    }
    await this.act(
      `mark ${service} paid`,
      "This is the explicitly authorized eGovPay test checkout. Click “Mark as Paid”.",
    );
    await this.waitForText(
      `${service} paid result`,
      /Transaction Success|Payment Successful|PAID/i,
      90_000,
    );
    await sleep(5_000);
    await this.act(
      `return ${service} to merchant`,
      "Click “Go Back to Merchant” (or the equivalent “Back to merchant” button) after the successful test payment.",
    );
    await this.waitFor(
      `${service} merchant return`,
      ({ url }) => url.startsWith(this.config.baseUrl.origin),
      90_000,
    );
    try {
      await this.waitForText(`${service} continuation`, next, 45_000);
    } catch (error) {
      const merchant = await this.activePage();
      if (!merchant.url().includes("payment=return")) throw error;
      await merchant.goto(merchant.url(), { waitUntil: "load", timeoutMs: 30_000 });
      await this.waitForText(`${service} continuation after status refresh`, next, 180_000);
    }
    await this.pass(`${service} paid and continued`);
  }

  async authenticateAndOpenBusiness() {
    const page = await this.activePage();
    await page.goto(new URL("/api/auth/dev-login", this.config.baseUrl).toString(), {
      waitUntil: "load",
      timeoutMs: 30_000,
    });
    await this.waitForText("authenticated home", "Hi, Josh", 60_000);
    await this.pass("dev session authenticated");

    await page.reload({ waitUntil: "load", timeoutMs: 30_000 });
    await this.waitForText("authenticated home after reload", "Hi, Josh", 60_000);
    await this.expectBodyNot(
      /Sign in again|Sign in to eGovPH/,
      "Reloading must restore the authenticated session instead of showing remembered-account login.",
    );
    await this.pass("authenticated session survives reload");

    await this.clickControl("open Business", "nav[aria-label='eGovPH services'] button");
    await this.waitForText("Business landing", /Describe your business|Start something new/);
  }

  async submitBusinessIdea(prompt: string) {
    await this.typeField(
      "fill registration idea",
      "[aria-label='Describe your business idea']",
      prompt,
    );
    await this.clickControl("submit registration idea", "[aria-label='Continue']:not(:disabled)");
  }

  async writeReport(status: "passed" | "failed", details: ReportDetails = {}) {
    const metrics = this.stagehand ? await this.stagehand.metrics : undefined;
    await writeFile(
      path.join(this.artifactDirectory, "report.json"),
      `${JSON.stringify(
        {
          artifactDirectory: this.artifactDirectory,
          finishedAt: new Date().toISOString(),
          metrics,
          runId: this.config.runId,
          scenario: this.id,
          startedAt: this.startedAt.toISOString(),
          status,
          steps: this.steps,
          title: this.title,
          ...details,
        },
        null,
        2,
      )}\n`,
    );
  }

  async recordFailure(error: unknown) {
    const message = error instanceof Error ? error.stack || error.message : String(error);
    this.steps.push({
      name: this.lastStep,
      status: "failed",
      url: this.stagehand ? (await this.activePage().catch(() => undefined))?.url() || "" : "",
    });
    if (this.stagehand) await this.screenshot(`failure-${this.lastStep}`).catch(() => undefined);
    await mkdir(this.artifactDirectory, { recursive: true });
    await this.writeReport("failed", { error: message });
    return message;
  }

  async close() {
    await this.stagehand?.close().catch(() => undefined);
  }
}

export async function runScenario(
  options: ScenarioOptions,
  execute: (flow: ScenarioHarness) => Promise<ReportDetails | void>,
) {
  const flow = new ScenarioHarness(options);
  try {
    await flow.initialize();
    const details = await execute(flow);
    await flow.writeReport("passed", details ?? {});
    console.log(`\n${options.title} passed. Artifacts: ${flow.artifactDirectory}`);
  } catch (error) {
    console.error(await flow.recordFailure(error));
    process.exitCode = 1;
  } finally {
    await flow.close();
  }
}
