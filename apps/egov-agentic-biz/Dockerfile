# syntax=docker/dockerfile:1

# Build this file from the repository root:
# docker build -f apps/egov-agentic-biz/Dockerfile -t egov-agentic-biz .

FROM oven/bun:1.3.14-slim AS dependencies

WORKDIR /repo

# Copy manifests first so dependency installation remains cached when source
# files change. Bun needs every workspace manifest to honor the frozen lockfile,
# so a new package under apps/ or packages/ has to be added here too.
COPY package.json bun.lock ./
COPY apps/egov-agentic-biz/package.json apps/egov-agentic-biz/package.json
COPY apps/egov-ai-sample/package.json apps/egov-ai-sample/package.json
COPY apps/egov-smoke/package.json apps/egov-smoke/package.json
COPY apps/egov-sso-sample/package.json apps/egov-sso-sample/package.json
COPY apps/rag-hor/package.json apps/rag-hor/package.json
COPY apps/rag-hor/packages/transcript-scraper/package.json \
  apps/rag-hor/packages/transcript-scraper/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/dx/package.json packages/dx/package.json
COPY packages/egov/package.json packages/egov/package.json
COPY packages/transcript-scraper/package.json packages/transcript-scraper/package.json

RUN bun install --frozen-lockfile

FROM dependencies AS builder

ENV NEXT_TELEMETRY_DISABLED=1

COPY turbo.json turbo.json
COPY packages/egov packages/egov
COPY apps/egov-agentic-biz apps/egov-agentic-biz

RUN bun run turbo build --filter=egov-agentic-biz

FROM node:24-trixie-slim AS runner

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000

WORKDIR /app/apps/egov-agentic-biz

RUN chown -R node:node /app

# Next.js does not copy public or static assets into standalone output.
COPY --from=builder --chown=node:node \
  /repo/apps/egov-agentic-biz/.next/standalone /app
COPY --from=builder --chown=node:node \
  /repo/apps/egov-agentic-biz/.next/static ./.next/static
COPY --from=builder --chown=node:node \
  /repo/apps/egov-agentic-biz/public ./public

# Migrations ship with the image so `drizzle-kit migrate` can be run against the
# remote database as a release step.
COPY --from=builder --chown=node:node \
  /repo/apps/egov-agentic-biz/drizzle ./drizzle

USER node

EXPOSE 3000

# State lives in Turso and R2 now, so the container itself is stateless and
# needs no mounted volume.
CMD ["node", "server.js"]
