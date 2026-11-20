# syntax=docker/dockerfile:1
# Multi-stage build: compile everything in a "build" stage that has dev tools,
# then copy only what's needed to run into a small "runtime" stage.

# ---------- build ----------
FROM node:22-alpine AS build
WORKDIR /app

# Copy package manifests first so `npm ci` is cached until dependencies change.
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci

COPY . .
RUN npm run build --workspace apps/web && npm run build --workspace apps/api

# ---------- production dependencies only ----------
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --omit=dev --workspace apps/api --include-workspace-root=false

# ---------- runtime ----------
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    STATIC_DIR=/app/apps/web/dist

# The CI pipeline passes the git commit SHA so /api/health can report which version is live.
ARG APP_VERSION=dev
ENV APP_VERSION=$APP_VERSION

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/drizzle ./apps/api/drizzle
COPY --from=build /app/apps/web/dist ./apps/web/dist

# Don't run as root inside the container.
USER node
EXPOSE 3000
CMD ["node", "apps/api/dist/index.js"]
