import { readFlowConfig } from "./config.js";
import { runScenario } from "./scenario-harness.js";

const config = readFlowConfig(process.env, new Date(), {
  businessNamePrefix: "Stagehand Roadster Rentals",
  stagingPaymentCount: 0,
});
const businessIdea =
  "I want to start a vehicle rental business in Poblacion, Makati and work alone";
const proposedBusinessName = `${config.businessName} TRAVEL AND TOURS`;

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

    await flow.waitForText(
      "profile-address checkpoint",
      "Which address should this registration use?",
    );
    await flow.clickLabeledOption("use profile address", "Use my registered eGov address");
    await flow.clickControl("continue after address", "form button[type='submit']:not(:disabled)");

    await flow.waitForText(
      "vehicle-rental BNRS terms",
      "Do you accept the BNRS terms and conditions?",
    );
    await flow.clickLabeledOption("accept vehicle-rental BNRS terms", "I accept");
    await flow.clickControl(
      "continue after BNRS terms",
      "form button[type='submit']:not(:disabled)",
    );
    await flow.waitForText(
      "vehicle-rental dominant-name checkpoint",
      "What distinctive name do you want to register?",
    );
    await flow.typeField(
      "enter vehicle-rental dominant name",
      "input[placeholder='For example, Molar Bear']",
      config.businessName,
    );
    await flow.clickControl(
      "continue after vehicle-rental dominant name",
      "form button[type='submit']:not(:disabled)",
    );
    await flow.waitForText(
      "vehicle-rental descriptor checkpoint",
      "Which BNRS descriptor best matches the business?",
    );
    await flow.clickLabeledOption("choose travel descriptor", "TRAVEL AND TOURS");
    await flow.clickControl(
      "continue after vehicle-rental descriptor",
      "form button[type='submit']:not(:disabled)",
    );
    await flow.waitForText(
      "vehicle-rental scope checkpoint",
      "Where should the business name be protected?",
    );
    await flow.clickLabeledOption("choose vehicle-rental city scope", "City / municipality");
    await flow.clickControl(
      "submit vehicle-rental BNRS identity",
      "form button[type='submit']:not(:disabled)",
    );

    await flow.waitForText("vehicle-rental DTI application", "Submit and pay", 240_000);
    await flow.expectDtiApplication({
      proposedBusinessName,
      businessActivity: businessIdea,
    });
    await flow.pass("vehicle-rental branch converged on DTI application");

    return {
      expectedRegistrationType: "Sole proprietor",
      expectedUniqueCheckpoint: "Self-drive rental",
      proposedBusinessName,
      stagingPaymentsCreated: 0,
    };
  },
);
