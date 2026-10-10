# AmpliVerify web (Next.js standalone). Build from the repository root:
#   docker build -f docker/web.Dockerfile -t ampliverify-web .
# Run `npm run auth:migrate --workspace apps/web` against AUTH_DATABASE_URL
# once per release before starting (Better Auth tables).
FROM node:22-alpine AS build
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY apps/api/package.json apps/api/
RUN npm ci --ignore-scripts
COPY apps/web apps/web
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build --workspace apps/web

FROM node:22-alpine
RUN apk add --no-cache tini
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /repo/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/web/server.js"]
