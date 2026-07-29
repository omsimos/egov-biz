import { readFlowConfig } from "./config.js";
import { runScenario } from "./scenario-harness.js";

const config = readFlowConfig(process.env, new Date(), {
  businessNamePrefix: "Stagehand Online Market",
  stagingPaymentCount: 0,
});
const businessIdea = "I want to start a retail business in Poblacion, Makati and work alone";

await runScenario(
  {
    config,
    id: "online-retail",
    title: "Online-retail sole-proprietor flow",
  },
  async (flow) => {
    await flow.authenticateAndOpenBusiness();
    await flow.submitBusinessIdea(businessIdea);

    await flow.waitForText("work-location checkpoint", "Where will you work?", 240_000);
    await flow.clickLabeledOption("choose online retail", "Online");
    await flow.pass("online work-location branch selected");
    await flow.clickControl(
      "continue after work location",
      "form button[type='submit']:not(:disabled)",
    );

    await flow.waitForText("profile-address checkpoint", "Which address should this business use?");
    await flow.clickLabeledOption("use profile address", "Use my registered eGov address");
    await flow.clickControl("continue after address", "form button[type='submit']:not(:disabled)");

    await flow.waitForText(
      "online-retail business-name checkpoint",
      "What business name do you want to register?",
    );
    await flow.typeField(
      "enter online-retail business name",
      "input[placeholder='Proposed trade name']",
      config.businessName,
    );
    await flow.clickControl(
      "submit online-retail business name",
      "form button[type='submit']:not(:disabled)",
    );

    await flow.waitForText("online-retail DTI application", "Submit and pay", 240_000);
    await flow.expectDtiApplication({
      proposedBusinessName: config.businessName,
      businessActivity: businessIdea,
    });
    await flow.pass("online-retail branch converged on DTI application");

    return {
      expectedRegistrationType: "Sole proprietor",
      expectedUniqueCheckpoint: "Online work location",
      proposedBusinessName: config.businessName,
      stagingPaymentsCreated: 0,
    };
  },
);
