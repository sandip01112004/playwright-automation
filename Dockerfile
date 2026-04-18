# ==================== Stage 1: Build React Dashboard ====================
FROM node:20-slim AS dashboard-builder

WORKDIR /app/dashboard

# Accept BFC API URLs as build args so they're baked into the React bundle correctly
ARG REACT_APP_biofuelcircle_API_BASE_URL
ARG REACT_APP_biofuelcircle_API_TOKEN
ARG REACT_APP_SCN_API_SECRET_KEY

ENV REACT_APP_biofuelcircle_API_BASE_URL=$REACT_APP_biofuelcircle_API_BASE_URL
ENV REACT_APP_biofuelcircle_API_TOKEN=$REACT_APP_biofuelcircle_API_TOKEN
ENV REACT_APP_SCN_API_SECRET_KEY=$REACT_APP_SCN_API_SECRET_KEY

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

# Copy application source files
COPY . .

# Copy built React dashboard from Stage 1 into the location Express expects
RUN mkdir -p supplierfirst-automation-dashboard
COPY --from=dashboard-builder /app/dashboard/dist ./supplierfirst-automation-dashboard/dist

# Environment Settings
ENV NODE_ENV=production
ENV HEADLESS=true
ENV PORT=3000

EXPOSE 3000

# Health check against the logs endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s \
  CMD curl -sf http://localhost:${PORT}/api/logs/healthcheck > /dev/null || exit 1

# Start the integrated server
CMD ["npx", "ts-node", "trigger-api.ts"]
