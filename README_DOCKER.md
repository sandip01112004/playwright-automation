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
    Open [http://localhost:5000](http://localhost:5000) in your browser.

4.  **Run Tests**:
    Click "Start Test" on the dashboard. The tests will run in "headless" mode inside the container. 
    You can view the results at [http://localhost:5000/report](http://localhost:5000/report) once finished.

## Notes
- To run in **headed** mode (if you have an X11 server or VNC set up), change `HEADLESS=true` to `HEADLESS=false` in `docker-compose.yml`. However, for most users, headless is the way to go in Docker.
