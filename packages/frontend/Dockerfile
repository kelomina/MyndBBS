# ===== Stage 1: Build =====
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

WORKDIR /app

# Copy all source code (node_modules excluded via .dockerignore)
COPY . .

# Use hoisted node_modules for Docker builds (standard pnpm Docker pattern)
RUN echo "node-linker=hoisted" > .npmrc

# Install ALL dependencies and build Next.js
# Use absolute path to .bin wrapper to bypass pnpm's package-local resolution
RUN PUPPETEER_SKIP_DOWNLOAD=true pnpm install --frozen-lockfile && \
    cd packages/frontend && \
    NODE_ENV=production SECURITY_HEADERS_OWNER=proxy API_URL=http://backend:3001 /app/node_modules/.bin/next build

# ===== Stage 2: Production Runner =====
FROM node:22-alpine AS runner

RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

WORKDIR /app

# Copy Next.js standalone output (preserves monorepo path structure)
COPY --from=builder /app/packages/frontend/.next/standalone ./

# Copy static files (from standalone)
COPY --from=builder /app/packages/frontend/.next/static ./packages/frontend/.next/static

# Copy public directory
COPY --from=builder /app/packages/frontend/public ./packages/frontend/public

# Copy shared package (needed if any runtime imports reference it)
COPY --from=builder /app/packages/shared ./packages/shared

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3100

# Switch to non-root user
USER node

EXPOSE 3100

CMD ["node", "packages/frontend/server.js"]
