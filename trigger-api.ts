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

// In-memory log storage
const taskLogs = new Map<string, string[]>();

// Tracking for "Active Task Discovery"
let lastActiveTask: { taskId: string; status: 'STARTING' | 'ACTIVE' | 'FINISHED' } | null = null;

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
    const bfcBaseUrl = process.env.BFC_API_URL?.replace(/\/$/, '');
    
    if (!bfcBaseUrl) {
        return res.status(500).json({ error: 'BFC_API_URL not configured in server .env' });
    }

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
                'Authorization': req.headers['authorization'] || `Bearer ${process.env.BFC_API_TOKEN}`
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
    const expectedSecret = process.env.SCN_API_SECRET_KEY;
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
    const expectedSecret = process.env.SCN_API_SECRET_KEY;
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
    const expectedSecret = process.env.SCN_API_SECRET_KEY;
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

    // 1. Secret Key Validation
    const incomingSecret = req.headers['x-api-key'];
    const expectedSecret = process.env.SCN_API_SECRET_KEY;

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
    const targetSystem = Number(process.env.TARGET_SYSTEM_ID);
    const username = process.env.SUPPLIER_NAME || 'unknown';

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

    // --- NEW: Neutralize Task Status immediately ---
    // This prevents the Dashboard from seeing the "failed" status from a previous run
    try {
        const automationService = new AutomationService(task_id);
        await automationService.updateTaskStatus('processing');
    } catch (err: any) {
        console.warn(`[API] Failed to pre-neutralize Task ${task_id} status: ${err.message}`);
    }
    // ----------------------------------------------

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
            BFC_API_TOKEN: process.env.BFC_API_TOKEN || '',
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

    pwProcess.on('spawn', () => {
        if (lastActiveTask && lastActiveTask.taskId === taskIdStr) {
            lastActiveTask.status = 'ACTIVE';
        }
    });

    pwProcess.on('close', (code) => {
        const status = code === 0 ? 'FINISHED' : 'FAILED';
        appendLog(`[System] Playwright process finished with code ${code} (${status})`);
        console.log(`[Worker] Playwright process for Task ${task_id} finished with code ${code}`);

        // Update discovery state to finished
        if (lastActiveTask && lastActiveTask.taskId === taskIdStr) {
            lastActiveTask.status = 'FINISHED';
            
            // Keep discovery status for 15 seconds so the UI definitely sees it
            // Only clear if the task ID hasn't changed (prevents race conditions)
            setTimeout(() => {
                if (lastActiveTask && lastActiveTask.taskId === taskIdStr) {
                    console.log(`[API] Clearing Discovery memory for Task ${taskIdStr} (Grace period expired)`);
                    lastActiveTask = null;
                }
            }, 15000);
        }
    });
});

const PORT = config.TRIGGER_API_PORT;
app.listen(PORT, () => {
    console.log(`\n================================================`);
    console.log(`Automation Trigger API Running`);
    console.log(`Endpoint: http://localhost:${PORT}/api/trigger`);
    console.log(`Discovery: http://localhost:${PORT}/api/active-task`);
    console.log(`================================================\n`);
}).on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`\n[FATAL] Port ${PORT} is already in use. Please close the other process.`);
    } else {
        console.error(`\n[FATAL] Server failed to start:`, err.message);
    }
    process.exit(1);
});
