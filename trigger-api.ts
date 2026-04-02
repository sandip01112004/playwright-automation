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
        console.error(`\n[API] [${new Date().toLocaleTimeString()}] JSON SyntaxError detected!`);
        console.error(`[API] Message: ${err.message}`);
        console.error(`[API] Raw body that failed to parse (first 100 chars):`);
        console.error(`--------------------------------------------------`);
        // Note: req.body might not be populated if parsing failed, 
        // but some body-parsers attach the raw body to the error object.
        const rawBody = (err as any).body;
        console.error(rawBody ? rawBody.toString().substring(0, 500) : 'No raw body available in error object.');
        console.error(`--------------------------------------------------\n`);

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
 * Payload Example: { "taskId": 123, "username": "...", "orderData": {...} }
 */
app.post('/api/trigger', (req: Request, res: Response) => {
    const payload = req.body;
    // Handle both taskId (old) and task_id (new/official)
    const task_id = payload.task_id || payload.taskId;

    if (!task_id) {
        return res.status(400).json({
            error: 'Missing task_id or taskId in payload. task_id is required to track status.'
        });
    }

    console.log(`\n[API] [${new Date().toLocaleTimeString()}] Trigger received for Task ID: ${task_id}`);

    // Log keys in payload for transparency
    const payloadKeys = Object.keys(payload);
    console.log(`[API] Payload keys detected: [${payloadKeys.join(', ')}]`);

    // 1. Respond to BFC immediately (Industrial Standard: Asynchronous Handshake)
    res.status(202).json({
        message: 'Task accepted. Automation worker starting in background.',
        taskId: task_id,
        status: 'ACCEPTED'
    });

    // 2. Launch Playwright Worker
    // We pass the entire payload as a Base64 string to the environment
    const payloadString = JSON.stringify(payload);
    const encodedPayload = Buffer.from(payloadString).toString('base64');

    console.log(`[Worker] Spawning Playwright process for Task ${task_id}...`);
    console.log(`[Worker] Payload size (encoded): ${encodedPayload.length} chars`);

    // Run ONLY the create-shipment test by default
    const pwArgs = ['playwright', 'test', 'tests/create-shipment.spec.ts', '--project=chromium', '--headed'];

    console.log(`[Worker] Running: npx ${pwArgs.join(' ')}`);

    const pwProcess = spawn('npx', pwArgs, {
        env: {
            ...process.env,
            TASK_ID: task_id.toString(),
            TASK_PAYLOAD: encodedPayload // The full data packet
        },
        shell: true
    });

    // Capture standard output for logging
    pwProcess.stdout.on('data', (data) => {
        console.log(`[PW-Task-${task_id}]: ${data.toString().trim()}`);
    });

    // Capture errors
    pwProcess.stderr.on('data', (data) => {
        console.error(`[PW-Error-${task_id}]: ${data.toString().trim()}`);
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
    console.log(`🚀 Automation Trigger API Running`);
    console.log(`🔗 Endpoint: http://localhost:${PORT}/api/trigger`);
    console.log(`================================================\n`);
});
