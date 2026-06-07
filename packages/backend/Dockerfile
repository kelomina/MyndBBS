# ===== Stage 1: Build =====
FROM node:22-alpine AS builder

RUN apk add --no-cache python3 make g++

RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

WORKDIR /app

# Copy all source code (node_modules excluded via .dockerignore)
COPY . .

# Use hoisted node_modules for Docker builds (standard pnpm Docker pattern)
# This ensures binary executables (prisma, tsc) resolve correctly
RUN echo "node-linker=hoisted" > .npmrc

# Install ALL dependencies and build
# Use absolute paths to .bin wrappers to bypass pnpm's package-local resolution
ENV PUPPETEER_SKIP_DOWNLOAD=true
RUN pnpm install --frozen-lockfile && \
    cd packages/backend && \
    /app/node_modules/.bin/prisma generate && \
    /app/node_modules/.bin/tsc

# Prune dev dependencies for production
RUN cd packages/backend && \
    CI=true pnpm install --prod --frozen-lockfile

# ===== Stage 2: Production =====
FROM node:22-alpine AS runner

RUN apk add --no-cache tini

RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

WORKDIR /app

# Copy root workspace files needed by Prisma
COPY --from=builder /app/package.json /app/

# Copy backend built artifacts
COPY --from=builder /app/packages/backend/dist /app/packages/backend/dist
COPY --from=builder /app/packages/backend/prisma /app/packages/backend/prisma
COPY --from=builder /app/packages/backend/package.json /app/packages/backend/

# Copy Prisma config (needed for datasource URL resolution in Prisma 7)
COPY --from=builder /app/packages/backend/prisma.config.ts /app/packages/backend/

# Copy production node_modules (already pruned)
COPY --from=builder /app/packages/backend/node_modules /app/packages/backend/node_modules
COPY --from=builder /app/node_modules /app/node_modules

# Copy shared package (needed at runtime for imports)
COPY --from=builder /app/packages/shared /app/packages/shared

# Copy locale translation files (JSON files are not compiled by tsc)
COPY --from=builder /app/packages/backend/src/locales /app/packages/backend/dist/locales

# Copy install wizard HTML view (static file, not compiled by tsc)
COPY --from=builder /app/packages/backend/src/views /app/packages/backend/dist/views

# Copy install wizard JS (served by built-in route /install/tailwind.js)
COPY --from=builder /app/packages/backend/src/routes/install-wizard.js /app/packages/backend/dist/routes/tailwind.js

# Compile shared package TypeScript to CommonJS for Node.js v22 compatibility
# (Node.js v22 ESM loader does not support directory imports like './constants')
RUN /app/node_modules/.bin/tsc --project /app/packages/shared/tsconfig.json \
    --outDir /app/packages/shared/dist \
    --rootDir /app/packages/shared/src \
    --module commonjs --target es2022 \
    --ignoreDeprecations "6.0" && \
    sed -i 's|"main": "src/index.ts"|"main": "dist/index.js"|' /app/packages/shared/package.json && \
    sed -i 's|"types": "src/index.ts"|"types": "dist/index.d.ts"|' /app/packages/shared/package.json

# Set working directory to backend package so Prisma commands work correctly
WORKDIR /app/packages/backend

# Copy entrypoint script and set permissions
COPY packages/backend/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Create uploads directory with node user ownership
RUN mkdir -p /app/packages/backend/uploads && chown -R node:node /app/packages/backend/uploads

# Create empty .env with node user ownership (backend may write to it at startup)
RUN touch /app/packages/backend/.env && chown node:node /app/packages/backend/.env

# Switch to non-root user
USER node

EXPOSE 3001

ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/docker-entrypoint.sh"]
