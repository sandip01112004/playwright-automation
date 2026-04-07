# SupplierFirst Automation

Automation suite and API dashboard for the SupplierFirst platform, built with Node.js and Playwright.

## 📦 Project Structure

This project is a JavaScript/Node-based monorepo containing:
- **Playwright Tests**: End-to-end browser automation scripts.
- **Express API** (`trigger-api.ts`): Backend service to trigger the automation workflows.
- **Dashboard** (`supplierfirst-automation-dashboard/`): Frontend React interface.

---

## 🛠️ Prerequisites

Ensure you have the following installed on your machine:
- [Node.js](https://nodejs.org/en/) (v16.0 or higher recommended)
- Optional: [Docker](https://www.docker.com/) (if you prefer to run services via container)

---

## 🚀 Installation & Setup

**1. Clone the repository**
```bash
git clone <your-repo-url>
cd playwright-automation
```

**2. Install Root Dependencies**
Always use `npm ci` after cloning to cleanly install predefined dependencies without altering lockfiles:
```bash
npm ci
```

**3. Install Playwright Browsers**

```bash
npx playwright install
```

**4. Set up Environment Variables**
Copy the example environment file and configure it with your credentials:
(both on root and dashboard)
```bash
cp .env.example .env
```

---

## 💻 Running the Application

To start just the trigger API:
```bash
npm run start:api
```

To start just the React dashboard:
```bash
cd supplierfirst-automation-dashboard
npm start
```

### Running Tests
To run the Playwright end-to-end tests:
```bash
# Run tests in headless mode
npx playwright test

# Run tests with the Playwright UI mode (great for debugging)
npx playwright test --ui
```

---

## 🐳 Docker Deployment

To run this application using Docker, refer to the [README_DOCKER.md](README_DOCKER.md) file included in this repository. 
You can start all services with:
```bash
docker-compose up -d
```
