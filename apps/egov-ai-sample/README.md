# eGov AI Sample

A small Bun CLI that exercises the eGov AI service of the `@repo/egov` SDK and
prints what each endpoint returns — both a response-shape summary and the full
raw JSON. Use it to discover the actual result contract of an endpoint.

## Setup

The CLI mints a short-lived access token from `EGOVAI_ACCESS_CODE`, so set it in
the repo-root `.env` (see `.env.sample`):

```sh
EGOVAI_ACCESS_CODE="your-access-code"
EGOVAI_BASE_URL="https://egov-ai-core-ws.oueg.info" # optional; this is the default
```

## Usage

From the repo root:

```sh
bun run sample:ai assistant --prompt "How do I register a business?"
```

Or directly (cleaner output — the root script prefixes each line via Turbo):

```sh
cd apps/egov-ai-sample
bun --env-file=../../.env src/index.ts laws --category PH --prompt "..."
```

The first positional argument is the command; the rest are flags. Every run
first prints the issued access token (credit balance included), then runs the
selected command.

### Commands

| Command     | Endpoint                        | Notes                                     |
| ----------- | ------------------------------- | ----------------------------------------- |
| `assistant` | `ai_assistant/generate`         | Default command.                          |
| `speech`    | `speech_maker/generate`         |                                           |
| `tourism`   | `tourism/generate`              |                                           |
| `laws`      | `laws_and_regulations/generate` | `--category` must be `PH` or `GLOBAL`.    |
| `translate` | `translator/generate`           | Uses `--source` / `--target`.             |
| `document`  | `document_extractor/generate`   | Requires `--file <path>`.                 |
| `credits`   | `credits`                       | Shows the token's credit usage.           |
| `all`       | —                               | Runs every text endpoint back-to-back.    |

### Flags

| Flag         | Applies to                 | Default                                                  |
| ------------ | -------------------------- | -------------------------------------------------------- |
| `--prompt`   | all text commands          | `"What are the requirements to renew a Philippine passport?"` |
| `--category` | `assistant` `speech` `tourism` `laws` | `general` (note: `laws` requires `PH` or `GLOBAL`) |
| `--source`   | `translate`                | `en`                                                     |
| `--target`   | `translate`                | `fil`                                                    |
| `--file`     | `document`                 | — (skipped if omitted)                                   |

### Examples

```sh
# Ask the assistant a question
bun --env-file=../../.env src/index.ts assistant --prompt "How do I renew my driver's license?"

# Philippine laws & regulations (category is a required enum here)
bun --env-file=../../.env src/index.ts laws --category PH --prompt "Penalties under the Data Privacy Act of 2012?"

# Translate English to Filipino
bun --env-file=../../.env src/index.ts translate --source en --target fil --prompt "Good morning"

# Extract structured data from a document
bun --env-file=../../.env src/index.ts document --file ./sample-id.jpg

# Run every text endpoint in one go
bun --env-file=../../.env src/index.ts all
```

## Output

For each call the CLI logs the exact request body it sent, then the response as:

- a **shape summary** — each top-level key, its type, and a short value preview;
- the **raw JSON**, pretty-printed.

The text endpoints (`assistant`, `speech`, `tourism`, `laws`) share one shape:

```json
{
  "data": "…Markdown-formatted answer…",
  "session_id": "3734f0f2-e763-4c01-8411-e9e4ecfed3f7"
}
```

On a non-2xx response the CLI prints the `EgovApiError` status and the raw error
body — useful for discovering a contract (e.g. a `422` reveals that `laws`
accepts only the `PH` and `GLOBAL` categories).
