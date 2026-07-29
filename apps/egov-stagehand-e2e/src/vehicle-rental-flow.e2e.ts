import { readFlowConfig } from "./config.js";
import { runScenario } from "./scenario-harness.js";

const config = readFlowConfig(process.env, new Date(), {
  businessNamePrefix: "Stagehand Roadster Rentals",
  stagingPaymentCount: 0,
});
const businessIdea =
  "I want to start a vehicle rental business in Poblacion, Makati and work alone";

await runScenario(
  {
    config,
    id: "vehicle-rental",
    title: "Vehicle-rental sole-proprietor flow",
  },
  async (flow) => {
    await flow.authenticateAndOpenBusiness();
    await flow.submitBusinessIdea(businessIdea);

    await flow.waitForText(
      "vehicle-use checkpoint",
      "How will customers use the vehicles?",
      240_000,
    );
    await flow.clickLabeledOption("choose self-drive rentals", "Self-drive rental");
    await flow.pass("self-drive vehicle-use branch selected");
    await flow.clickControl(
      "continue after vehicle use",
      "form button[type='submit']:not(:disabled)",
    );

    await flow.waitForText("profile-address checkpoint", "Which address should this business use?");
    await flow.clickLabeledOption("use profile address", "Use my registered eGov address");
    await flow.clickControl("continue after address", "form button[type='submit']:not(:disabled)");

    await flow.waitForText(
      "vehicle-rental business-name checkpoint",
      "What business name do you want to register?",
    );
    await flow.typeField(
      "enter vehicle-rental business name",
      "input[placeholder='Proposed trade name']",
      config.businessName,
    );
    await flow.clickControl(
      "submit vehicle-rental business name",
      "form button[type='submit']:not(:disabled)",
    );

    await flow.waitForText("vehicle-rental DTI application", "Submit and pay", 240_000);
    await flow.expectDtiApplication({
      proposedBusinessName: config.businessName,
      businessActivity: businessIdea,
    });
    await flow.pass("vehicle-rental branch converged on DTI application");

    return {
      expectedRegistrationType: "Sole proprietor",
      expectedUniqueCheckpoint: "Self-drive rental",
      proposedBusinessName: config.businessName,
      stagingPaymentsCreated: 0,
    };
  },
);
