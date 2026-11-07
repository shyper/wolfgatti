# syntax=docker/dockerfile:1

# Stage 1: dependencies (cached as long as the package files do not change)
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/
COPY packages/client/package.json packages/client/
COPY tools/package.json tools/
RUN npm ci --no-audit --no-fund

# Stage 2: test and build the client and server, including original web artwork.
FROM deps AS build
COPY packages ./packages
COPY vitest.config.ts ./vitest.config.ts
COPY tools/write-artwork-versions.mjs ./tools/write-artwork-versions.mjs
RUN npm test && npm run build

# Stage 3: runtime – the server is a single bundled file, no node_modules needed
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    PUBLIC_DIR=/app/public \
    DATA_DIR=/app/data
COPY --from=build /app/packages/server/dist/index.cjs ./server.cjs
COPY --from=build /app/packages/client/dist ./public
COPY LICENSE THIRD_PARTY_NOTICES.md ./
RUN mkdir -p /app/data && chown node:node /app/data
USER node
EXPOSE 3000
VOLUME ["/app/data"]
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s CMD wget -qO- http://127.0.0.1:3000/healthz || exit 1
CMD ["node", "server.cjs"]
