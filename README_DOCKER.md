# Docker Setup for Playwright Automation

To run this project using Docker, follow these steps:

## Prerequisites
- [Docker](https://docs.docker.com/get-docker/) installed.
- [Docker Compose](https://docs.docker.com/compose/install/) installed.

## Instructions

1.  **Configure environment variables**:
    Create a `.env` file in the root directory (based on your existing credentials).

2.  **Build and run with Docker Compose**:
    ```bash
    docker compose up --build
    ```

3.  **Access the Dashboard**:
    Open [http://localhost:3000](http://localhost:3000) in your browser.

4.  **Run Tests**:
    The system waits for a trigger at `http://localhost:3001/api/trigger`.
    The Dashboard will automatically detect active tasks and show the UI.
    You can view the reports in the `playwright-report` folder on your host machine.

## Notes
- To run in **headed** mode (if you have an X11 server or VNC set up), change `HEADLESS=true` to `HEADLESS=false` in `docker-compose.yml`. However, for most users, headless is the way to go in Docker.
