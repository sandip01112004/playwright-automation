import express from 'express';
import type { Request, Response } from 'express';
import { spawn } from 'child_process';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables (.env in root)
dotenv.config();

const app = express();

app.use(express.json());

// In-memory log storage
const taskLogs = new Map<string, string[]>();

// Error handling middleware for JSON parsing
app.use((err: any, req: Request, res: Response, next: any) => {
    if (err instanceof SyntaxError && 'body' in err) {
        const rawBody = (err as any).body;
        console.error(rawBody ? rawBody.toString().substring(0, 500) : 'No raw body available in error object.');

        return res.status(400).json({
            error: 'Malformed JSON payload',
            message: err.message
        });
    }
    next();
});

/**
 * LOGS ENDPOINT
 * Returns the captured logs for a specific task.
 */
app.get('/api/logs/:taskId', (req: Request, res: Response) => {
    const taskId = req.params.taskId as string;
    const logs = taskLogs.get(taskId) || [];
    res.json({ taskId, logs });
});

/**
 * TRIGGER ENDPOINT
 * Receives the full payload from BFC and spawns a Playwright worker.
 */
app.post('/api/trigger', (req: Request, res: Response) => {
    const payload = req.body;
    const task_id = payload.task_id;

    if (!task_id) {
        console.error(`[API] Rejecting request: Missing task_id in payload.`);
        return res.status(400).json({
            error: 'Missing task_id in payload.'
        });
    }

    const taskIdStr = task_id.toString();

    // Reset logs for this task
    taskLogs.set(taskIdStr, [`[System] Task ${taskIdStr} triggered at ${new Date().toISOString()}`]);

    console.log(`\n************************************************`);
    console.log(`[API] TRIGGER RECEIVED FOR TASK ID: ${task_id}`);
    console.log(`************************************************\n`);

    // 1. Respond to BFC immediately
    res.status(202).json({
        message: 'Task accepted. Automation worker starting in background.',
        taskId: task_id,
        status: 'ACCEPTED'
    });

    // 2. Launch Playwright Worker
    const payloadString = JSON.stringify(payload);
    const encodedPayload = Buffer.from(payloadString).toString('base64');

    const authHeader = req.headers.authorization;
    const incomingToken = (authHeader && authHeader.startsWith('Bearer ')) ? authHeader.substring(7) : '';

    console.log(`[Worker] Spawning Playwright process for Task ${task_id}...`);

    // Explicitly use list reporter and colored output for better visibility
    const pwArgs = ['playwright', 'test', 'tests/create-shipment.spec.ts', '--project=chromium', '--reporter=list'];

    const pwProcess = spawn('npx', pwArgs, {
        env: {
            ...process.env,
            TASK_ID: taskIdStr,
            TASK_PAYLOAD: encodedPayload,
            BFC_API_TOKEN: incomingToken || '',
            DOTENV_CONFIG_QUIET: 'true',
            FORCE_COLOR: '1' // Ensure colors are preserved for captured logs if possible
        },
        shell: true
    });

    const appendLog = (data: any) => {
        const lines = data.toString().split('\n');
        const logs = taskLogs.get(taskIdStr) || [];
        lines.forEach((line: string) => {
            const trimmed = line.trim();
            if (trimmed) {
                // Also log to the worker's console for debugging
                console.log(`[Task ${taskIdStr}] ${trimmed}`);
                logs.push(trimmed);
            }
        });
        // Limit log size to prevent memory issues (last 1000 lines)
        if (logs.length > 1000) logs.shift();
        taskLogs.set(taskIdStr, logs);
    };

    pwProcess.stdout.on('data', appendLog);
    pwProcess.stderr.on('data', appendLog);

    pwProcess.on('close', (code) => {
        const status = code === 0 ? 'FINISHED' : 'FAILED';
        appendLog(`[System] Playwright process finished with code ${code} (${status})`);
        console.log(`[Worker] Playwright process for Task ${task_id} finished with code ${code}`);

        // Optional: Clear logs after some time (e.g., 10 minutes)
        setTimeout(() => {
            // taskLogs.delete(taskIdStr); 
        }, 600000);
    });
});

/**
 * START THE API SERVER
 */
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`\n================================================`);
    console.log(`Automation Trigger API Running`);
    console.log(`Endpoint: http://localhost:${PORT}/api/trigger`);
    console.log(`Log Endpoint: http://localhost:${PORT}/api/logs/:taskId`);
    console.log(`================================================\n`);
});
