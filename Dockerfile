# Use the official Playwright image as the base
# This image contains all necessary browsers and system dependencies
FROM mcr.microsoft.com/playwright:v1.58.2-jammy

WORKDIR /app

# 1. Install root dependencies (API & Automation)
# Copy only package files first to optimize layer caching
COPY package*.json ./
RUN npm install

# 2. Install dashboard dependencies
# Copy only package files first to optimize layer caching
COPY supplierfirst-automation-dashboard/package*.json ./supplierfirst-automation-dashboard/
RUN cd supplierfirst-automation-dashboard && npm install

# 3. Copy the rest of the application code
COPY . .

# 4. Expose the dashboard (3000) and the API (3001)
EXPOSE 3000 3001

# 5. Set default environment variables
# These can be overridden by docker-compose or .env file
ENV HEADLESS=true
ENV NODE_ENV=development
ENV PORT=3000
ENV TRIGGER_API_PORT=3001

# 6. Start both processes concurrently using the cross-platform script
# This will also copy the .env file to the dashboard folder correctly
CMD ["npm", "run", "start:all"]
