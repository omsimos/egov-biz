# syntax=docker/dockerfile:1

# Build this file from the repository root:
# docker build -f apps/egov-biz/Dockerfile -t egov-biz .

FROM oven/bun:1.4.0-slim AS dependencies

WORKDIR /repo

# Copy manifests first so dependency installation remains cached when source
# files change. Bun needs every workspace manifest to honor the frozen lockfile,
# so a new package under apps/ or packages/ has to be added here too.
COPY package.json bun.lock ./
COPY apps/egov-biz/package.json apps/egov-biz/package.json
COPY apps/egov-stagehand-e2e/package.json apps/egov-stagehand-e2e/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/dx/package.json packages/dx/package.json
COPY packages/transcript-scraper/package.json packages/transcript-scraper/package.json
COPY packages/utils/package.json packages/utils/package.json

# lefthook's postinstall runs `lefthook install -f`, and .dockerignore keeps
# .git out of the build context, so it would print a git fatal on every build.
# Its postinstall no-ops when CI is set, which is accurate here anyway.
ENV CI=true

RUN bun install --frozen-lockfile

FROM dependencies AS builder

ENV NEXT_TELEMETRY_DISABLED=1

COPY turbo.json turbo.json
COPY apps/egov-biz apps/egov-biz

RUN bun run turbo build --filter=egov-biz

FROM node:24-trixie-slim AS runner

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000

WORKDIR /app/apps/egov-biz

RUN chown -R node:node /app

# Next.js does not copy public or static assets into standalone output.
COPY --from=builder --chown=node:node \
  /repo/apps/egov-biz/.next/standalone /app
COPY --from=builder --chown=node:node \
  /repo/apps/egov-biz/.next/static ./.next/static
COPY --from=builder --chown=node:node \
  /repo/apps/egov-biz/public ./public

# Migrations ship with the image so `drizzle-kit migrate` can be run against the
# remote database as a release step.
COPY --from=builder --chown=node:node \
  /repo/apps/egov-biz/drizzle ./drizzle

USER node

EXPOSE 3000

# State lives in Turso and R2 now, so the container itself is stateless and
# needs no mounted volume.
CMD ["node", "server.js"]
