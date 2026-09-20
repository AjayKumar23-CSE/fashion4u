# Built from the REPOSITORY ROOT, not from apps/api:
#   docker build -f apps/api/Dockerfile -t store-api .
# The root lockfile governs the whole workspace, so the build context has to
# include it.

FROM node:24-alpine AS deps
WORKDIR /app
# Only the manifests, so this layer is reused whenever dependencies are unchanged.
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
# --ignore-scripts because the Prisma client is generated explicitly below, and
# npm blocks unapproved dependency scripts anyway.
RUN npm ci --ignore-scripts

FROM deps AS build
WORKDIR /app
COPY apps/api apps/api
# `prebuild` runs `prisma generate`, so the client is produced here rather than
# committed; `nest build` then compiles it along with the rest into dist/.
RUN npm run build --workspace api

FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
# The Prisma driver adapter talks to Postgres through node-postgres, so there is
# no native query engine binary to carry.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/prisma ./apps/api/prisma

# Not root, so a compromise inside the container is not a compromise of it.
USER node
# Only a default: the platform sets PORT and the app reads it.
ENV PORT=4000
EXPOSE 4000
CMD ["node", "--enable-source-maps", "apps/api/dist/main"]
