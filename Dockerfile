# Use the official Playwright image as the base
FROM mcr.microsoft.com/playwright:v1.58.2-jammy

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json to the container
COPY package*.json ./

# Install project dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Expose the dashboard port
EXPOSE 5000

# Set environment variables (can be overridden at runtime)
# Defaulting to headless true for Docker
ENV HEADLESS=true

# Start the remote dashboard
CMD ["node", "remote-dashboard.js"]
