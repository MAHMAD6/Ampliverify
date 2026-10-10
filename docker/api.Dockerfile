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
RUN npm ci --ignore-scripts
COPY apps/api apps/api
RUN npx --workspace apps/api prisma generate && npm run build --workspace apps/api

FROM node:22-alpine
RUN apk add --no-cache openssl tini
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=build --chown=node:node /repo/node_modules node_modules
COPY --from=build --chown=node:node /repo/package.json package.json
COPY --from=build --chown=node:node /repo/apps/api/package.json apps/api/package.json
COPY --from=build --chown=node:node /repo/apps/api/prisma apps/api/prisma
COPY --from=build --chown=node:node /repo/apps/api/dist apps/api/dist
WORKDIR /repo/apps/api
USER node
EXPOSE 4000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
