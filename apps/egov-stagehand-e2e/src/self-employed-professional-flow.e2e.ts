import { readFlowConfig } from "./config.js";
import { runScenario } from "./scenario-harness.js";

const config = readFlowConfig(process.env, new Date(), {
  businessNamePrefix: "Stagehand Professional Services",
  stagingPaymentCount: 1,
});
const expectedLegalName = "Josh Dela Cruz Preview";

await runScenario(
  {
    config,
    id: "self-employed-professional",
    title: "Self-employed professional flow",
  },
  async (flow) => {
    await flow.authenticateAndOpenBusiness();
    await flow.submitBusinessIdea(
      "I want to work as a freelance graphic designer from home in Poblacion, Makati, working alone",
    );

    await flow.waitForText(
      "profile-address checkpoint",
      "Which address should this registration use?",
    );
    await flow.clickLabeledOption("use profile address", "Use my registered eGov address");
    await flow.clickControl("continue after address", "form button[type='submit']:not(:disabled)");

    await flow.waitForText(
      "self-employed BIR route",
      /self-employed professional route goes directly to BIR|DTI business-name registration is not required/i,
      240_000,
    );
    await flow.expectBodyNot(
      "Submit and pay",
      "The self-employed route must not create a DTI payment checkpoint.",
    );
    await flow.pass("self-employed route skips DTI and local permits");

    await flow.waitForText(
      "generated BIR Form 1901",
      /Your prefilled BIR Form 1901 is ready|PDF artifact/i,
      240_000,
    );
    await flow.expectBody(
      "BIR Form 1901",
      "The self-employed flow should produce a BIR Form 1901 artifact.",
    );
    await flow.completePayment({
      amount: /(?:₱|PHP)?\s*30(?:\.00)?/,
      card: "Final registration payment",
      next: /Registration plan complete|Open records and tax calendar|Certificate of Registration/i,
      service: "BIR Documentary Stamp Tax",
    });
    await flow.waitForText(
      "completed self-employed plan",
      /Registration plan complete|All set up|Open records and tax calendar/i,
      240_000,
    );
    await flow.expectBody(
      "7/7",
      "The self-employed registration plan should finish with non-applicable steps skipped.",
    );
    await flow.pass("self-employed registration finalized");

    await flow.act(
      "open self-employed business record",
      "Click the completed business card that says “Open records and tax calendar”.",
    );
    await flow.waitForText("self-employed business record", "View CoR (2303)", 90_000);
    await flow.expectBody(
      "Self-employed",
      "The finalized business record should preserve the self-employed registration type.",
    );
    await flow.expectBody(
      expectedLegalName,
      "The self-employed business should be finalized under the authenticated legal name.",
    );

    await flow.act(
      "open self-employed Files tab",
      "In the Business record, click the “Files” tab.",
    );
    await flow.waitForText("self-employed files", "BIR Form 1901");
    await flow.expectBody(
      /Certificate of Registration|BIR Form 2303/i,
      "The self-employed record should include the certificate issued after payment.",
    );
    await flow.pass("self-employed files verified");

    return {
      expectedRegistrationType: "Self-employed",
      expectedUniqueCheckpoint: "BIR Form 1901 generation",
      finalizedBusinessName: expectedLegalName,
      stagingPaymentsCreated: 1,
    };
  },
);
