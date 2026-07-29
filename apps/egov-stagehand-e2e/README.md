# eGovPH Business Stagehand E2E

This workspace app drives the complete local eGovPH Business journey with
[Stagehand](https://github.com/browserbase/stagehand):

1. authenticate through the loopback-only dev session;
2. register a Makati coffee-subscription business;
3. answer the RDO, premises, staffing, address, and proposed-name checkpoints;
4. complete the DTI, barangay, and EBPLS fees through eGovPay staging using
   **Cash Payments → Pay Now → Mark as Paid → Go Back to Merchant**;
5. verify the completed 10/10 plan and business-record Overview, Records, Files,
   and Tax calendar tabs;
6. create two post-registration chats, ask about taxes, fire safety, and files,
   then verify per-business persistence across chat, business-record, Business,
   and Home navigation.

Stagehand runs under Node and uses its native CDP page/locator APIs. The repository
continues to use Bun for dependency management and Turborepo orchestration.

## Run

Start the target app’s Redis dependency and dev server first:

```bash
docker compose -f apps/egov-agentic-biz/docker-compose.yml up -d redis
bun run dev:business
```

Copy this app’s environment template if you want to override defaults. The root
`.env` is also loaded for the existing local credentials:

```bash
cp apps/egov-stagehand-e2e/.env.example apps/egov-stagehand-e2e/.env
```

Then explicitly acknowledge the three stateful staging payments:

```bash
E2E_ALLOW_EGOVPAY=1 bun run e2e:business
```

Required:

- `AI_GATEWAY_API_KEY` for the default `gateway/google/gemini-2.5-flash`
  Stagehand model, or `OPENAI_API_KEY` when selecting an OpenAI model;
- the existing eGovPay staging configuration used by `egov-agentic-biz`;
- an `EGOVPAY_API_KEY` beginning with `test_` when that key is visible to this
  process.

The test refuses non-loopback targets because it depends on `/api/auth/dev-login`,
which is intentionally unavailable outside local development. It also refuses
to run until `E2E_ALLOW_EGOVPAY=1` is set.

Each run writes screenshots and a JSON result under `artifacts/<run-id>/`. The
created demo business, chat sessions, and remote staging transactions are kept
for inspection.

## Non-live checks

The normal monorepo `test`, `lint`, `format:check`, and `check-types` tasks do not
run the stateful browser journey. They only validate this harness:

```bash
bun --filter egov-stagehand-e2e test
bun --filter egov-stagehand-e2e check-types
bun --filter egov-stagehand-e2e lint
bun --filter egov-stagehand-e2e format:check
```
