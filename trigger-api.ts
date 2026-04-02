import express from 'express';
import type { Request, Response } from 'express';
import { spawn } from 'child_process';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables (.env in root)
dotenv.config();

const app = express();
const PORT = process.env.TRIGGER_API_PORT || 3001;

app.use(express.json());

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
 * TRIGGER ENDPOINT
 * Receives the full payload from BFC and spawns a Playwright worker.
 */
app.post('/api/trigger', (req: Request, res: Response) => {
    const payload = req.body;

    // Support both snake_case and camelCase for Task ID
    const task_id = payload.task_id || payload.taskId;

    if (!task_id) {
        console.error(`[API] Rejecting request: Missing task_id in payload:`, JSON.stringify(payload));
        return res.status(400).json({
            error: 'Missing task_id or taskId in payload.'
        });
    }

    console.log(`\n************************************************`);
    console.log(`[API] TRIGGER RECEIVED FOR TASK ID: ${task_id}`);
    console.log(`[API] URL Base: ${process.env.BFC_API_URL}`);
    console.log(`[API] Full Payload:`, JSON.stringify(payload, null, 2));
    console.log(`************************************************\n`);

    // 1. Respond to BFC immediately
    res.status(202).json({
        message: 'Task accepted. Automation worker starting in background.',
        taskId: task_id,
        status: 'ACCEPTED'
    });

    // 2. Launch Playwright Worker
    // We pass the entire payload as a Base64 string to the environment
    const payloadString = JSON.stringify(payload);
    const encodedPayload = Buffer.from(payloadString).toString('base64');

    // Capture token ONLY from Authorization header (Security Enforcement)
    const authHeader = req.headers.authorization;
    const incomingToken = (authHeader && authHeader.startsWith('Bearer ')) ? authHeader.substring(7) : '';

    console.log(`[Worker] Spawning Playwright process for Task ${task_id}...`);
    if (incomingToken) {
        console.log(`[Worker] Using dynamic token found in trigger request.`);
    }

    // Run ONLY the create-shipment test by default
    const pwArgs = ['playwright', 'test', 'tests/create-shipment.spec.ts', '--project=chromium', '--headed'];

    const pwProcess = spawn('npx', pwArgs, {
        env: {
            ...process.env,
            TASK_ID: task_id.toString(),
            TASK_PAYLOAD: encodedPayload,
            // Override dynamic BFC Token from trigger request
            BFC_API_TOKEN: incomingToken || ''
        },
        shell: true
    });

    // Capture standard output for logging
    pwProcess.stdout.on('data', (data) => {
        const lines = data.toString().split('\n');
        lines.forEach((line: string) => {
            if (line.trim()) {
                console.log(`[PW-Task-${task_id}]: ${line.trim()}`);
            }
        });
    });

    // Capture errors
    pwProcess.stderr.on('data', (data) => {
        const lines = data.toString().split('\n');
        lines.forEach((line: string) => {
            if (line.trim()) {
                console.error(`[PW-Error-${task_id}]: ${line.trim()}`);
            }
        });
    });

    pwProcess.on('close', (code) => {
        console.log(`[Worker] Playwright process for Task ${task_id} finished with code ${code}`);
    });
});

/**
 * START THE API SERVER
 */
app.listen(PORT, () => {
    console.log(`\n================================================`);
    console.log(`Automation Trigger API Running`);
    console.log(`Endpoint: http://localhost:${PORT}/api/trigger`);
    console.log(`================================================\n`);
});
