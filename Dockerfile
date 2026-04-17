# ==================== Stage 1: Build React Dashboard ====================
FROM node:20-slim AS dashboard-builder

WORKDIR /app/dashboard

# Accept BFC API URLs as build args so they're baked into the React bundle correctly
# Values must be provided via .env and docker-compose build.args — no defaults here
ARG REACT_APP_TRIGGER_API_URL
ARG REACT_APP_biofuelcircle_API_BASE_URL

ENV REACT_APP_TRIGGER_API_URL=$REACT_APP_TRIGGER_API_URL
ENV REACT_APP_biofuelcircle_API_BASE_URL=$REACT_APP_biofuelcircle_API_BASE_URL

COPY supplierfirst-automation-dashboard/package*.json ./
RUN npm install

COPY supplierfirst-automation-dashboard/ ./
RUN npm run build

# ==================== Stage 2: Runtime ====================
FROM mcr.microsoft.com/playwright:v1.58.2-jammy

WORKDIR /app

# Install root dependencies (API + Playwright)
COPY package*.json ./
RUN npm install

# Install serve to host the static React build
RUN npm install -g serve

# Copy application source files
COPY tsconfig.json ./
COPY playwright.config.ts ./
COPY trigger-api.ts ./
COPY types/ ./types/
COPY utils/ ./utils/
COPY fixtures/ ./fixtures/
COPY pages/ ./pages/
COPY tests/ ./tests/

# Copy built React dashboard from Stage 1
COPY --from=dashboard-builder /app/dashboard/dist ./dashboard-build

EXPOSE 3000

ENV HEADLESS=true
ENV PORT=3001

# Health check against the logs endpoint — returns 200 for any taskId, even unknown ones
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s \
  CMD curl -sf http://localhost:3001/api/logs/healthcheck > /dev/null || exit 1

CMD ["npx", "concurrently", \
     "npx ts-node trigger-api.ts", \
     "serve -s dashboard-build -l 3000 --no-clipboard"]
