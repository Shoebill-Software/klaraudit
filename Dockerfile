# syntax=docker/dockerfile:1
#
# Production image for KlarAudit (Playwright Chromium + Node 20).
# The scanner already launches Chromium with --no-sandbox and
# --disable-dev-shm-usage, so USER node is safe in typical containers.
#
# Recommended run:
#   docker run --rm --init --ipc=host klaraudit scan https://example.com

FROM node:20-bookworm-slim AS chromium-deps

ENV DEBIAN_FRONTEND=noninteractive

# Headless Chromium shared libraries (Playwright / Debian bookworm).
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    fonts-liberation \
    fonts-noto-color-emoji \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libexpat1 \
    libgbm1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    libxshmfence1 \
    wget \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ---------------------------------------------------------------------------
# Build: install JS deps, Chromium, and compile TypeScript.
# NODE_ENV is left unset so npm ci includes typescript (devDependency).
# ---------------------------------------------------------------------------
FROM chromium-deps AS build

COPY package.json package-lock.json ./
RUN npm ci

# playwright-core does not download browsers during npm ci.
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=0 \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

RUN npx playwright-core install --with-deps chromium \
  && chmod -R a+rX /ms-playwright

COPY tsconfig.json ./
COPY scripts ./scripts
COPY src ./src

RUN npm run build \
  && npm prune --omit=dev

# ---------------------------------------------------------------------------
# Runtime: production Node, Chromium libs, compiled CLI, non-root user.
# ---------------------------------------------------------------------------
FROM chromium-deps AS runtime

ENV NODE_ENV=production \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/package-lock.json ./package-lock.json
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /ms-playwright /ms-playwright

USER node

ENTRYPOINT ["node", "dist/index.js"]
CMD ["--help"]
