# AmpliVerify API (NestJS + Prisma). Build from the repository root:
#   docker build -f docker/api.Dockerfile -t ampliverify-api .
# Runs pending migrations, then the API (the background job worker runs in
# the same process unless JOBS_WORKER=off).
FROM node:22-alpine AS build
RUN apk add --no-cache openssl
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --ignore-scripts --workspace apps/api --include-workspace-root
COPY apps/api apps/api
RUN npx --workspace apps/api prisma generate && npm run build --workspace apps/api

# Production dependencies only (the Prisma CLI is a runtime dependency for
# `migrate deploy`).
FROM node:22-alpine AS deps
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --omit=dev --ignore-scripts --workspace apps/api && npm cache clean --force

FROM node:22-alpine
RUN apk add --no-cache openssl tini
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=deps --chown=node:node /repo/node_modules node_modules
# Generated client and the engines downloaded by `prisma generate`.
COPY --from=build --chown=node:node /repo/node_modules/.prisma node_modules/.prisma
COPY --from=build --chown=node:node /repo/node_modules/@prisma/engines node_modules/@prisma/engines
COPY --from=build --chown=node:node /repo/node_modules/prisma node_modules/prisma
COPY --chown=node:node package.json package.json
COPY --chown=node:node apps/api/package.json apps/api/package.json
COPY --from=build --chown=node:node /repo/apps/api/prisma apps/api/prisma
COPY --from=build --chown=node:node /repo/apps/api/dist apps/api/dist
WORKDIR /repo/apps/api
USER node
EXPOSE 4000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["sh", "-c", "npx --no-install prisma migrate deploy && node dist/main.js"]
