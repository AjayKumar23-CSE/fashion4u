# Built from the REPOSITORY ROOT, not from apps/api:
#   docker build -f apps/api/Dockerfile -t store-api .
# The root lockfile governs the whole workspace, so the build context has to
# include it. On Koyeb, Render or Cloud Run set the Dockerfile path to
# apps/api/Dockerfile and leave the build context at the repository root.

# --- dependencies, including the tooling needed to compile -------------------
FROM node:24-alpine AS deps
WORKDIR /app
# Only the manifests, so this layer is reused whenever dependencies are unchanged.
# The other workspaces' package.json files are not needed: npm resolves the
# whole tree from the lockfile.
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
# --ignore-scripts because the Prisma client is generated explicitly below, and
# npm blocks unapproved dependency scripts anyway.
RUN npm ci --ignore-scripts

# --- compile -----------------------------------------------------------------
FROM deps AS build
WORKDIR /app
COPY apps/api apps/api
# `prebuild` runs `prisma generate`, so the client is produced here rather than
# committed; `nest build` then compiles it along with the rest into dist/.
RUN npm run build --workspace api

# --- runtime dependencies only ----------------------------------------------
# Installed separately rather than carried over from `deps`, which holds the
# build tooling and every other workspace's React/Next/Vite tree. Those have no
# business in an API image.
FROM node:24-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
RUN npm ci --omit=dev --ignore-scripts --workspace api --include-workspace-root

# --- what actually ships -----------------------------------------------------
FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
# The Prisma driver adapter reaches Postgres through node-postgres, so there is
# no native query engine binary to carry.
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
# Migrations are applied from a developer machine (`npm run db:deploy`), never
# at container start: a failure would take the service down with it, and two
# instances booting together would race. The schema travels for reference only.
COPY --from=build /app/apps/api/prisma ./apps/api/prisma

# Not root, so a compromise inside the container is not a compromise of it.
USER node
# Only a default: the platform sets PORT and the app reads it.
ENV PORT=4000
EXPOSE 4000
CMD ["node", "--enable-source-maps", "apps/api/dist/main"]
