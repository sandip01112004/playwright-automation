# Use the official Playwright image as the base
FROM mcr.microsoft.com/playwright:v1.58.2-jammy
WORKDIR /app

# 1. Install root dependencies (API & Automation)
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

# 5. Set environment variables
ENV HEADLESS=true
ENV PORT=3001
ENV REACT_APP_API_BASE_URL=http://localhost:3001/api/v1

# 6. Start both processes concurrently
CMD ["npm", "run", "start:all"]
