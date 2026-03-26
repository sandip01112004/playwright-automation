const express = require('express');
const { exec, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const app = express();
const port = 5000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Temporary store for mid-test inputs
let pendingInputs = {}; // { 'DELIVERY_ID': { status: 'waiting', value: null } }

// Serve the Playwright report folder
app.use('/report', express.static(path.join(__dirname, 'playwright-report')));

app.get('/', (req, res) => {
    res.send(`
        <html>
            <head>
                <title>Remote Test Control</title>
                <style>
                    body { font-family: sans-serif; padding: 20px; background: #f4f4f9; }
                    .card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); max-width: 500px; margin: auto; }
                    input { width: 100%; padding: 10px; margin: 10px 0; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; }
                    button { width: 100%; padding: 10px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; }
                    button:hover { background: #0056b3; }
                    .hidden { display: none; }
                    #status { margin-top: 20px; font-weight: bold; text-align: center; color: #666; }
                </style>
            </head>
            <body>
                <div class="card" id="main-card">
                    <h2>Run Shipment Test</h2>
                    <div id="initial-form">
                        <button id="start-btn" onclick="startTest()">Start Test</button>
                    </div>
                </div>

                <div class="card hidden" id="input-card" style="margin-top: 20px;">
                    <h3 id="prompt-label">Waiting for Test...</h3>
                    <input type="text" id="remoteInput">
                    <button onclick="submitInput()">Submit Parameter</button>
                </div>

                <div id="status">Ready</div>
                <div style="text-align: center; margin-top: 20px;">
                    <a href="/report" style="color: #28a745; text-decoration: none; font-weight: bold;">View Latest Results</a>
                </div>

                <script>
                    let currentPrompt = null;

                    async function startTest() {
                        const btn = document.getElementById('start-btn');
                        const status = document.getElementById('status');
                        
                        btn.disabled = true;
                        btn.style.opacity = '0.5';
                        btn.style.cursor = 'not-allowed';
                        status.innerText = 'Running...';
                        status.style.color = '#007bff';

                        try {
                            const response = await fetch('/run', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ })
                            });
                            
                            const result = await response.json();
                            
                            if (result.status === 'passed') {
                                status.innerText = '✅ Test Passed';
                                status.style.color = '#28a745';
                            } else {
                                status.innerText = '❌ Test Failed: ' + (result.message || 'Unknown error');
                                status.style.color = '#dc3545';
                            }
                        } catch (err) {
                            status.innerText = '❌ Error: ' + err.message;
                            status.style.color = '#dc3545';
                        } finally {
                            btn.disabled = false;
                            btn.style.opacity = '1';
                            btn.style.cursor = 'pointer';
                        }
                    }

                    async function pollForPrompts() {
                        setInterval(async () => {
                            const res = await fetch('/pending-input');
                            const data = await res.json();
                            
                            if (data.name) {
                                currentPrompt = data.name;
                                document.getElementById('input-card').classList.remove('hidden');
                                document.getElementById('prompt-label').innerText = 'Test needs: ' + data.name;
                                document.getElementById('status').innerText = 'ACTION REQUIRED';
                            } else {
                                if (!currentPrompt) {
                                    document.getElementById('input-card').classList.add('hidden');
                                }
                            }
                        }, 2000);
                    }

                    async function submitInput() {
                        const val = document.getElementById('remoteInput').value.trim();
                        if (!val) {
                            alert('Please enter a value');
                            return;
                        }
                        await fetch('/submit-input', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ name: currentPrompt, value: val })
                        });
                        document.getElementById('input-card').classList.add('hidden');
                        document.getElementById('remoteInput').value = '';
                        document.getElementById('status').innerText = 'Input Sent. Test continuing...';
                        currentPrompt = null;
                    }

                    // Start polling immediately on page load
                    pollForPrompts();
                </script>
            </body>
        </html>
    `);
});

// Endpoint for the test to request input
app.get('/request-input/:name', (req, res) => {
    const name = req.params.name;
    // Clear existing waiting prompts to avoid stale UI state from aborted tests
    for (const key in pendingInputs) {
        if (pendingInputs[key].status === 'waiting') {
            delete pendingInputs[key];
        }
    }
    pendingInputs[name] = { status: 'waiting', value: null };
    console.log(`[Test] Requesting input: ${name}`);
    res.json({ status: 'ok' });
});

// Endpoint for the test to poll for the value
app.get('/get-input/:name', (req, res) => {
    const name = req.params.name;
    if (pendingInputs[name] && pendingInputs[name].status === 'received') {
        const val = pendingInputs[name].value;
        delete pendingInputs[name];
        res.json({ value: val });
    } else {
        res.json({ value: null });
    }
});

// Endpoint for the dashboard to check for pending requests
app.get('/pending-input', (req, res) => {
    const nextItem = Object.keys(pendingInputs).find(k => pendingInputs[k].status === 'waiting');
    res.json({ name: nextItem || null });
});

// Endpoint for the dashboard to submit values
app.post('/submit-input', (req, res) => {
    const { name, value } = req.body;
    if (pendingInputs[name]) {
        pendingInputs[name] = { status: 'received', value: value };
        res.json({ status: 'ok' });
    } else {
        res.status(404).json({ error: 'No such prompt' });
    }
});

app.post('/run', (req, res) => {
    console.log(`\n--- [Remote Dashboard] Starting Test Run ---`);

    const isWin = process.platform === 'win32';
    const shell = isWin ? 'powershell.exe' : '/bin/sh';
    const npxCmd = isWin ? 'npx.cmd' : 'npx';
    const cmd = `${npxCmd} playwright test tests/create-shipment.spec.ts --headed`;

    console.log(`Executing: ${cmd}`);

    const childEnv = { ...process.env, RUN_MODE: 'remote' };

    exec(cmd, { env: childEnv, shell: shell }, (error, stdout, stderr) => {
        console.log(`Test finished.`);
        if (error) {
            console.error(`Test failed with code ${error.code}`);
            console.error(`STDOUT: ${stdout}`);
            console.error(`STDERR: ${stderr}`);
            const shortError = stderr.split('\n')[0] || stdout.split('\n')[0] || error.message.split('\n')[0];
            res.json({ status: 'failed', message: shortError });
        } else {
            console.log(`STDOUT: ${stdout}`);
            res.json({ status: 'passed' });
        }
    });
});

app.listen(port, () => {
    console.log(`\nINTERACTIVE Dashboard running at http://localhost:${port}`);
});
