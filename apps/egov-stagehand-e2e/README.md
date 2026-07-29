# eGovPH Business Stagehand E2E

This workspace app drives the local eGovPH Business journeys with
[Stagehand](https://github.com/browserbase/stagehand). Each supported route has
its own E2E file and package script:

| Script               | E2E file                                 | Coverage                                                                                  |
| -------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------- |
| `e2e:food`           | `whole-business-flow.e2e.ts`             | Complete sole-proprietor food flow, three payments, business record, and management chats |
| `e2e:self-employed`  | `self-employed-professional-flow.e2e.ts` | Direct-to-BIR professional flow, Form 1901 generation, tax setup, and business record     |
| `e2e:online-retail`  | `online-retail-flow.e2e.ts`              | Online work-location branch through the converged DTI application checkpoint              |
| `e2e:vehicle-rental` | `vehicle-rental-flow.e2e.ts`             | Vehicle-use intake branch through the converged DTI application checkpoint                |

The complete food-business journey:

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

Run commands from this app so its local `.env` is loaded:

```bash
cd apps/egov-stagehand-e2e
bun run e2e:self-employed
bun run e2e:online-retail
bun run e2e:vehicle-rental
```

The food flow creates three stateful eGovPay staging payments, so it additionally
requires explicit acknowledgement:

```bash
cd apps/egov-stagehand-e2e
E2E_ALLOW_EGOVPAY=1 bun run e2e:food
```

Required for every scenario:

- `AI_GATEWAY_API_KEY` for the default `gateway/google/gemini-2.5-flash`
  Stagehand model, or `OPENAI_API_KEY` when selecting an OpenAI model;
- a running local `egov-agentic-biz` app and its Redis dependency.

Required only for `e2e:food`:

- the existing eGovPay staging configuration used by `egov-agentic-biz`;
- an `EGOVPAY_API_KEY` beginning with `test_` when that key is visible to this
  process.

Required only for `e2e:self-employed`:

- the target `egov-agentic-biz` dev server must have `R2_BASE_URL`,
  `R2_ACCESS_KEY`, and `R2_SECRET_KEY` configured;
- the scenario generates Form 1901 and writes that PDF artifact to the configured
  remote Cloudflare R2 bucket.

Every scenario refuses non-loopback targets because it depends on
`/api/auth/dev-login`, which is intentionally unavailable outside local
development. Only the food flow refuses to run until
`E2E_ALLOW_EGOVPAY=1` is set.

Each run writes screenshots and a JSON result under `artifacts/<run-id>/` or
`artifacts/<run-id>-<scenario>/`. Created demo businesses, chat sessions, PDF
artifacts, and remote staging transactions are kept for inspection.

## Non-live checks

The normal monorepo `test`, `lint`, `format:check`, and `check-types` tasks do not
run the stateful browser journey. They only validate this harness:

```bash
bun --filter egov-stagehand-e2e test
bun --filter egov-stagehand-e2e check-types
bun --filter egov-stagehand-e2e lint
bun --filter egov-stagehand-e2e format:check
```
