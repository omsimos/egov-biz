import { readFlowConfig } from "./config.js";
import { runScenario } from "./scenario-harness.js";

const config = readFlowConfig(process.env, new Date(), {
  businessNamePrefix: "Stagehand Online Market",
  stagingPaymentCount: 0,
});
const businessIdea = "I want to start a retail business in Poblacion, Makati and work alone";
const proposedBusinessName = `${config.businessName} ONLINE SHOP`;

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

    await flow.waitForText(
      "profile-address checkpoint",
      "Which address should this registration use?",
    );
    await flow.clickLabeledOption("use profile address", "Use my registered eGov address");
    await flow.clickControl("continue after address", "form button[type='submit']:not(:disabled)");

    await flow.waitForText(
      "online-retail BNRS terms",
      "Do you accept the BNRS terms and conditions?",
    );
    await flow.clickLabeledOption("accept online-retail BNRS terms", "I accept");
    await flow.clickControl(
      "continue after BNRS terms",
      "form button[type='submit']:not(:disabled)",
    );
    await flow.waitForText(
      "online-retail dominant-name checkpoint",
      "What distinctive name do you want to register?",
    );
    await flow.typeField(
      "enter online-retail dominant name",
      "input[placeholder='For example, Molar Bear']",
      config.businessName,
    );
    await flow.clickControl(
      "continue after online-retail dominant name",
      "form button[type='submit']:not(:disabled)",
    );
    await flow.waitForText(
      "online-retail descriptor checkpoint",
      "Which BNRS descriptor best matches the business?",
    );
    await flow.clickLabeledOption("choose online-shop descriptor", "ONLINE SHOP");
    await flow.clickControl(
      "continue after online-retail descriptor",
      "form button[type='submit']:not(:disabled)",
    );
    await flow.waitForText(
      "online-retail scope checkpoint",
      "Where should the business name be protected?",
    );
    await flow.clickLabeledOption("choose online-retail city scope", "City / municipality");
    await flow.clickControl(
      "submit online-retail BNRS identity",
      "form button[type='submit']:not(:disabled)",
    );

    await flow.waitForText("online-retail DTI application", "Submit and pay", 240_000);
    await flow.expectDtiApplication({
      proposedBusinessName,
      businessActivity: businessIdea,
    });
    await flow.pass("online-retail branch converged on DTI application");

    return {
      expectedRegistrationType: "Sole proprietor",
      expectedUniqueCheckpoint: "Online work location",
      proposedBusinessName,
      stagingPaymentsCreated: 0,
    };
  },
);
