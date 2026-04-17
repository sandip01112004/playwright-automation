import express from 'express';
import type { Request, Response } from 'express';
import { spawn } from 'child_process';
import * as dotenv from 'dotenv';
import path from 'path';
import cors from 'cors';
import axios from 'axios';
import { AutomationService } from './utils/automation-service';
import { config } from './utils/config';

// Load environment variables (.env in root)
dotenv.config();

// Global Error Handlers to catch silent crashes
process.on('uncaughtException', (err) => {
    console.error('\n[FATAL] Uncaught Exception:', err.message);
    console.error(err.stack);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('\n[FATAL] Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

const app = express();

// Allow Cross-Origin requests from the React frontend
app.use(cors());
app.use(express.json());

// Set up the path to the React dashboard build folder
const BUILD_PATH = path.join(__dirname, 'supplierfirst-automation-dashboard', 'dist');

// In production, serve the React dashboard static files
if (process.env.NODE_ENV === 'production') {
    console.log(`[System] Production mode: Serving UI from ${BUILD_PATH}`);
    app.use(express.static(BUILD_PATH));
}

// In-memory log storage
const taskLogs = new Map<string, string[]>();

// Tracking for "Active Task Discovery"
let lastActiveTask: { taskId: string; status: 'STARTING' | 'ACTIVE' | 'FINISHED' | 'FAILED' } | null = null;

// SSE Client Management
let sseClients: Response[] = [];

/**
 * SSE ENDPOINT
 * Dashboard connects here to receive real-time updates without polling.
 */
app.get('/api/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // Send initial ping to confirm connection
    res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

    sseClients.push(res);
    console.log(`[SSE] Dashboard connected. Active clients: ${sseClients.length}`);

    req.on('close', () => {
        sseClients = sseClients.filter(client => client !== res);
        console.log(`[SSE] Dashboard disconnected. Active clients: ${sseClients.length}`);
    });
});

/**
 * Broadcast helper
 */
const broadcast = (event: any) => {
    const data = `data: ${JSON.stringify(event)}\n\n`;
    sseClients.forEach(client => client.write(data));
};

/**
 * NAVIGATION SIGNAL ENDPOINT
 * Allows Playwright or other services to force the dashboard to navigate.
 */
app.get('/api/signal-navigation/:taskId', (req, res) => {
    const taskId = req.params.taskId;
    console.log(`[Signal] Manual navigation signal received for Task ${taskId}`);
    broadcast({ type: 'task_triggered', taskId });
    res.json({ status: 'OK', message: `Navigation signal sent for Task ${taskId}` });
});

// Error handling middleware for JSON parsing
app.use((err: any, req: Request, res: Response, next: any) => {
    if (err instanceof SyntaxError && 'body' in err) {
        return res.status(400).json({
            error: 'Malformed JSON payload',
            message: err.message
        });
    }
    next();
});

/**
 * PROXY ENDPOINT (Bypasses CORS/Ngrok issues)
 */
app.all(/\/api\/proxy\/(.*)/, async (req: Request, res: Response) => {
    const targetPath = req.params[0];
    const bfcBaseUrl = config.BFC_API_URL.replace(/\/$/, '');

    const url = `${bfcBaseUrl}/${targetPath}${req.url.includes('?') ? '?' + req.url.split('?')[1] : ''}`;

    console.log(`[Proxy] ${req.method} ${url}`);

    try {
        const response = await axios({
            method: req.method,
            url: url,
            data: req.body,
            params: req.query,
            headers: {
                ...req.headers,
                'host': new URL(bfcBaseUrl).host,
                'origin': bfcBaseUrl,
                'referer': bfcBaseUrl,
                'ngrok-skip-browser-warning': 'true',
                'Authorization': req.headers['authorization'] || `Bearer ${config.BFC_API_TOKEN}`
            },
            validateStatus: () => true, // Pass all status codes through
            responseType: 'json'
        });

        res.status(response.status).json(response.data);
    } catch (err: any) {
        console.error(`[Proxy Error] ${err.message}`);
        res.status(500).json({ error: 'Proxy failed', message: err.message });
    }
});

/**
 * LOGS ENDPOINT
 */
app.get('/api/logs/:taskId', (req: Request, res: Response) => {
    // Standard X-API-KEY check for log endpoint too
    const incomingSecret = req.headers['x-api-key'];
    const expectedSecret = config.SCN_API_SECRET_KEY;
    if (!incomingSecret || incomingSecret !== expectedSecret) {
        return res.status(401).json({ error: 'Authentication failed.' });
    }

    const taskId = req.params.taskId as string;
    const logs = taskLogs.get(taskId) || [];
    res.json({ taskId, logs });
});


/**
 * ACTIVE TASK ENDPOINT (Discovery)
 */
app.get('/api/active-task', (req: Request, res: Response) => {
    const incomingSecret = req.headers['x-api-key'];
    const expectedSecret = config.SCN_API_SECRET_KEY;
    if (!incomingSecret || incomingSecret !== expectedSecret) {
        return res.status(401).json({ error: 'Authentication failed.' });
    }

    if (!lastActiveTask) {
        return res.json({ taskId: null, status: 'IDLE' });
    }
    res.json(lastActiveTask);
});

/**
 * RESET ENDPOINT (Clears stale tasks)
 */
app.post('/api/reset', (req: Request, res: Response) => {
    const incomingSecret = req.headers['x-api-key'];
    const expectedSecret = config.SCN_API_SECRET_KEY;
    if (!incomingSecret || incomingSecret !== expectedSecret) {
        return res.status(401).json({ error: 'Authentication failed.' });
    }

    console.log('[API] Resetting discovery state...');
    lastActiveTask = null;
    res.json({ status: 'OK', message: 'System discovery reset.' });
});

/**
 * TRIGGER ENDPOINT
 */
app.post('/api/trigger', async (req: Request, res: Response) => {
    const payload = req.body;
    const task_id = payload.task_id;
    console.log('Payload:', payload);

    // 1. Secret Key Validation
    const incomingSecret = req.headers['x-api-key'];
    const expectedSecret = config.SCN_API_SECRET_KEY;

    if (!incomingSecret || incomingSecret !== expectedSecret) {
        console.error(`[API] Rejecting request: Invalid or missing X-API-KEY.`);
        return res.status(401).json({
            error: 'Authentication failed.',
            message: 'Invalid or missing secret key in x-api-key header.'
        });
    }

    // 2. Task ID Validation
    if (!task_id) {
        console.error(`[API] Rejecting request: Missing task_id in payload.`);
        return res.status(400).json({
            error: 'Missing task_id in payload. Closing flow.'
        });
    }

    const taskIdStr = task_id.toString();

    // 3. Automation Token Logic
    console.log(`[API] Checking automation token for Task ${taskIdStr}...`);
    const targetSystem = await AutomationService.fetchTargetSystemId();
    const username = config.SUPPLIER_NAME;

    const tokenStatus = await AutomationService.checkTokenStatus(username, targetSystem.toString());
    let flowAction = 'CONTINUE';

    if (!tokenStatus.exists) {
        console.log(`[Flow] automation_token NOT EXISTS for ${username}. Will run login flow.`);
        flowAction = 'LOGIN_AND_POST';
    } else {
        console.log(`[Flow] automation_token EXISTS for ${username}. Continuing flow.`);
        flowAction = 'CONTINUE';
        // Note: Browser will naturally hit /login if session is expired, and auth fixture will handle it.
    }

    // Reset logs for this task
    taskLogs.set(taskIdStr, [
        `[System] Task ${taskIdStr} triggered at ${new Date().toISOString()}`,
        `[Flow] Action determined: ${flowAction}`
    ]);

    console.log(`\n************************************************`);
    console.log(`[API] TRIGGER RECEIVED FOR TASK ID: ${task_id}`);
    console.log(`[Flow] Action: ${flowAction}`);
    console.log(`************************************************\n`);

    // 4. Update Global Discovery State
    lastActiveTask = { taskId: taskIdStr, status: 'STARTING' };

    // 5. Respond to BFC
    res.status(202).json({
        message: 'Task accepted.',
        taskId: task_id,
        status: 'ACCEPTED',
        action: flowAction
    });

    // 6. Notify Dashboard via SSE (Instant Navigation)
    console.log(`[SSE] Broadcasting trigger for Task ${taskIdStr}...`);
    broadcast({ type: 'task_triggered', taskId: taskIdStr });


    // 6. Launch Playwright Worker
    const payloadString = JSON.stringify(payload);
    const encodedPayload = Buffer.from(payloadString).toString('base64');

    console.log(`[Worker] Spawning Playwright process for Task ${task_id}...`);

    const pwArgs = ['playwright', 'test', 'tests/create-shipment.spec.ts', '--project=chromium', '--reporter=list'];

    const pwProcess = spawn('npx', pwArgs, {
        env: {
            ...process.env,
            TASK_ID: taskIdStr,
            TASK_PAYLOAD: encodedPayload,
            BFC_API_TOKEN: config.BFC_API_TOKEN,
            REACT_APP_biofuelcircle_API_TOKEN: config.BFC_API_TOKEN,
            FLOW_ACTION: flowAction,
            DOTENV_CONFIG_QUIET: 'true',
            FORCE_COLOR: '1'
        },
        shell: true
    });

    const appendLog = (data: any) => {
        const lines = data.toString().split('\n');
        const logs = taskLogs.get(taskIdStr) || [];
        lines.forEach((line: string) => {
            const trimmed = line.trim();
            if (trimmed) {
                console.log(`[Task ${taskIdStr}] ${trimmed}`);
                logs.push(trimmed);
            }
        });
        if (logs.length > 1000) logs.shift();
        taskLogs.set(taskIdStr, logs);
    };

    pwProcess.stdout.on('data', appendLog);
    pwProcess.stderr.on('data', appendLog);

    pwProcess.on('error', (err) => {
        appendLog(`[System] Failed to start Playwright process: ${err.message}`);
        console.error(`[Worker] Failed to start Playwright process for Task ${task_id}:`, err);
    });

    pwProcess.on('spawn', () => {
        if (lastActiveTask && lastActiveTask.taskId === taskIdStr) {
            lastActiveTask.status = 'ACTIVE';
        }
    });

    pwProcess.on('close', (code) => {
        const status = code === 0 ? 'FINISHED' : 'FAILED';
        appendLog(`[System] Playwright process finished with code ${code} (${status})`);
        console.log(`[Worker] Playwright process for Task ${task_id} finished with code ${code}`);

        // Update discovery state to finished or failed
        if (lastActiveTask && lastActiveTask.taskId === taskIdStr) {
            lastActiveTask.status = status;

            // Keep discovery status for 30 seconds so the UI definitely sees it
            setTimeout(() => {
                if (lastActiveTask && lastActiveTask.taskId === taskIdStr) {
                    console.log(`[API] Clearing Discovery memory for Task ${taskIdStr} (Grace period expired)`);
                    lastActiveTask = null;
                }
            }, 30000);
        }
    });
});

/**
 * UI HOSTING (Consolidated Port)
 * Serve the React dashboard from the dist folder.
 */
// Server static files first
app.use(express.static(BUILD_PATH));

// SPA Support: Catch-all route to serve index.html for any non-API routes
app.use((req, res, next) => {
    if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(BUILD_PATH, 'index.html'), (err) => {
            if (err) {
                res.status(404).send("Dashboard build (dist) not found. Please ensure the project is built.");
            }
        });
    } else {
        next();
    }
});

const PORT = config.PORT;
app.listen(PORT, () => {
    console.log(`\n================================================`);
    console.log(`Automation Trigger API Running`);
    console.log(`Endpoint: http://localhost:${PORT}/api/trigger`);
    console.log(`================================================\n`);
}).on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`\n[FATAL] Port ${PORT} is already in use. Please close the other process.`);
    } else {
        console.error(`\n[FATAL] Server failed to start:`, err.message);
    }
    process.exit(1);
});
