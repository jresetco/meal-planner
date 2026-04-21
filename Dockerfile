# syntax=docker/dockerfile:1.6

# -------- Stage 1: build --------
# node:22 Docker Hub tag resolves to the latest Node 22 LTS (>=22.14 as of 2026),
# which satisfies Prisma 7.6's engine requirement of ^20.19 || ^22.12 || >=24.0.
# Bookworm-slim (Debian) avoids Alpine musl incompatibility with Prisma's binary engines.
FROM node:22-bookworm-slim AS builder

WORKDIR /app

# openssl + ca-certificates are required by Prisma's binary engine at install/runtime.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Copy only the files needed to install deps first, so Docker can cache this
# layer when source files change but dependencies don't.
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma

# Install ALL dependencies (including dev) — needed for `next build` and `tsc`.
RUN npm ci

# Copy the rest of the source.
COPY . .

# `prisma generate` and `next build` both load config files that touch env vars.
# We supply placeholder values so the BUILD succeeds without needing real secrets
# in the image. These are NEVER baked into runtime — Next.js reads env at request
# time for server components, and Railway will inject the real values then.
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" \
    ENCRYPTION_KEY="0000000000000000000000000000000000000000000000000000000000000000" \
    APP_AUTH_SECRET="build-only-placeholder-not-used-at-runtime" \
    OPENAI_API_KEY="build-only-placeholder" \
    NEXT_TELEMETRY_DISABLED=1

RUN npx prisma generate

RUN npm run build

# -------- Stage 2: runtime --------
FROM node:22-bookworm-slim

WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Bring over everything the running server actually needs.
# We include the full node_modules (includes runtime deps). Next.js resolves
# imports from node_modules at runtime in non-standalone mode.
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./
COPY --from=builder /app/next.config.ts ./
# The Prisma client is generated into node_modules/.prisma/client (default output for
# the `prisma-client-js` provider), which is already included via the node_modules copy.

EXPOSE 3000

# Shell form so $PORT (injected by Railway) is expanded at runtime.
CMD node ./node_modules/next/dist/bin/next start -p ${PORT:-3000}
