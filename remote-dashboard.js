const express = require('express');
const { exec } = require('child_process');
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
                        <label>Order Number:</label>
                        <input type="text" id="orderNo" placeholder="e.g. SF12345">
                        <button onclick="startTest()">Start Test</button>
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
                        const orderNo = document.getElementById('orderNo').value;
                        if (!orderNo) return alert('Enter Order Number');
                        
                        document.getElementById('status').innerText = 'Test Started! Waiting for prompts...';
                        document.getElementById('initial-form').classList.add('hidden');
                        
                        await fetch('/run', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ orderNo })
                        });

                        pollForPrompts();
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
                        const val = document.getElementById('remoteInput').value;
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
                </script>
            </body>
        </html>
    `);
});

// Endpoint for the test to request input
app.get('/request-input/:name', (req, res) => {
    const name = req.params.name;
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
    const { orderNo } = req.body;
    console.log(`\n⏳ Running test remotely for Order: ${orderNo}`);

    const cmd = `ORDER_NO=${orderNo} npx playwright test tests/create-shipment.spec.ts --headed`;

    exec(cmd, (error, stdout, stderr) => {
        console.log(`✅ Test finished.`);
        if (error) console.log(`Note: Test might have had failures.`);
    });
    res.json({ status: 'started' });
});

app.listen(port, () => {
    console.log(`\n✅ INTERACTIVE Dashboard running at http://localhost:${port}`);
});
