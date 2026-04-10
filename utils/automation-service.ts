import axios from 'axios';
import { config } from './config';

/**
 * Helper to interact with Website A APIs (Your System)
 */
export class AutomationService {
    private taskId: number;
    private baseUrl: string;
    private headers: any;
    private lookupCache: { [key: string]: number } = {};
    public payload: any = null;

    constructor(taskId: number, baseUrl: string = config.BFC_API_URL) {
        this.taskId = taskId;
        this.baseUrl = baseUrl.replace(/\/$/, '');
        this.headers = {
            'Authorization': `Bearer ${config.BFC_API_TOKEN}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };

        // Decode payload if provided by the Trigger API
        if (process.env.TASK_PAYLOAD) {
            try {
                const decoded = Buffer.from(process.env.TASK_PAYLOAD, 'base64').toString('utf8');
                this.payload = JSON.parse(decoded);
            } catch (err) {
                console.error(`[AutomationService] Failed to decode TASK_PAYLOAD: ${err}`);
            }
        }
    }

    /**
     * Fetch lookup data for a specific category and cache it.
     */
    async loadLookupData(category: string = 'automation_status'): Promise<void> {
        if (Object.keys(this.lookupCache).length > 0) return;

        try {
            const url = `${this.baseUrl}/reference/lookupdata/?category=${category}`;
            
            // Try with existing headers first
            let response;
            try {
                response = await axios.get(url, { headers: this.headers });
            } catch (err: any) {
                if (err.response?.status === 401) {
                    // Fallback: This is often a public endpoint, try without the expired token
                    console.warn(`[AutomationService] 401 on lookup data. Retrying ${category} without authentication...`);
                    response = await axios.get(url, { 
                        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' } 
                    });
                } else {
                    throw err;
                }
            }

            // Extract items based on known response patterns
            const items = response.data.data?.data || response.data.data || (Array.isArray(response.data) ? response.data : []);

            if (items.length === 0) {
                console.warn(`[AutomationService] No items found in lookup data response for ${category}. Raw Body: ${JSON.stringify(response.data).substring(0, 200)}`);
            }

            items.forEach((item: any) => {
                const id = item.id;
                // Capture all possible identifier strings
                const keys = [item.value, item.name, item.display_name].filter(k => typeof k === 'string' && k.length > 0);

                keys.forEach(k => {
                    const normalized = k.toLowerCase();
                    this.lookupCache[normalized] = Number(id);
                    // Also support underscores instead of spaces
                    this.lookupCache[normalized.replace(/\s+/g, '_')] = Number(id);
                });
            });

            // console.log(`[AutomationService] Loaded ${Object.keys(this.lookupCache).length} lookup entries for ${category}: ${Object.keys(this.lookupCache).join(', ')}`);
        } catch (err: any) {
            console.error(`[AutomationService] Failed to load lookup data: ${err.message}`);
            if (err.response) {
                console.error(`[AutomationService] Lookup Error Details: ${JSON.stringify(err.response.data).substring(0, 200)}`);
            }
            console.warn(`[AutomationService] Failed to load ${category} mapping. The script will proceed but status updates might fail.`);
        }
    }

    /**
     * Fetch the task object from the backend
     */
    async getTask() {
        try {
            const url = `${this.baseUrl}/automation_task/${this.taskId}/`;
            console.log(`>>> [DEBUG] FETCHING TASK FROM: ${url}`);
            const response = await this.request('GET', url);
            const data = response.data.data || response.data;
            // console.log(`[AutomationService] Task ${this.taskId} data fetched successfully.`);

            if (data.payload) {
                this.payload = data.payload;
            } else {
                console.warn(`[AutomationService] No payload field found in Task ${this.taskId} response.`);
            }
            return data;
        } catch (err: any) {
            console.error(`[AutomationService] Failed to fetch task ${this.taskId}: ${err.message}`);
            throw err;
        }
    }

    /**
     * Update task status using a string key (e.g., 'processing', 'completed')
     * The key is mapped to a numeric ID using the lookup API.
     */
    async updateTaskStatus(statusKey: string, extra: { otp?: string; error_message?: string } = {}) {
        try {
            await this.loadLookupData();

            const statusId = this.lookupCache[statusKey.toLowerCase()];
            if (!statusId) {
                console.error(`[AutomationService] Invalid status key: "${statusKey}". Mapping missing.`);
                return;
            }

            console.log(`[Service] Updating Task ${this.taskId} status: "${statusKey}"`);
            const payload: any = { status: statusId, ...extra };

            // If status is 'processing', explicitly clear old data
            if (statusId === this.lookupCache['processing']) {
                payload.otp = '';
                payload.error_message = '';
            }

            const url = `${this.baseUrl}/automation_task/${this.taskId}/`;
            const response = await this.request('PATCH', url, payload);
            return response.data;
        } catch (err: any) {
            console.error(`[AutomationService] Failed to update task status to "${statusKey}": ${err.message}`);
            // Silently fail so the automation can proceed to login/worker execution
            return null;
        }
    }

    /**
     * Private helper to perform axios requests with retry logic
     */
    private async request(method: 'GET' | 'POST' | 'PATCH', url: string, data?: any, retries: number = 3): Promise<any> {
        let lastError: any;
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                return await axios({
                    method,
                    url,
                    data,
                    headers: this.headers
                });
            } catch (err: any) {
                lastError = err;
                const status = err.response?.status;
                // Only retry on network errors or 5xx server errors
                const shouldRetry = !status || (status >= 500 && status <= 599);
                
                if (shouldRetry && attempt < retries) {
                    const delay = attempt * 2000;
                    console.warn(`[AutomationService] ${method} ${url} failed (${status || 'Network'}). Attempt ${attempt}/${retries}. Retrying in ${delay}ms...`);
                    await new Promise(r => setTimeout(r, delay));
                } else {
                    throw err;
                }
            }
        }
    }

    /**
     * Poll until the user has provided an OTP in the dashboard
     */
    async waitForOtp(timeoutMs: number = 0) {
        await this.loadLookupData();
        const otpProvidedId = this.lookupCache['otp_provided'];

        return this.pollTaskField<string>(
            'otp',
            (data) => data.otp && (Number(data.status) === otpProvidedId),
            timeoutMs
        );
    }

    /**
     * Directly update the automation token for the user defined in .env (SUPPLIER_NAME)
     */
    async saveAutomationToken(token: string) {
        const username = config.SUPPLIER_NAME;
        try {
            // Search for existing record
            const searchUrl = `${this.baseUrl}/automation_token/?target_system=${config.TARGET_SYSTEM_ID}&username=${encodeURIComponent(username)}`;
            const searchResponse = await this.request('GET', searchUrl);
            
            const data = searchResponse.data?.data || {};
            const results = data.results || [];
            const count = data.count ?? results.length;

            if (count > 0 && results.length > 0) {
                // Update existing
                const tokenId = results[0].id;
                console.log(`[AutomationService] Syncing token: Updating existing record (ID: ${tokenId}) for ${username}`);
                await this.request('PATCH', `${this.baseUrl}/automation_token/${tokenId}/`, {
                    token_data: token
                });
            } else {
                // Create new
                console.log(`[AutomationService] Syncing token: Creating new record for ${username} (Count was 0)`);
                await this.request('POST', `${this.baseUrl}/automation_token/`, {
                    username,
                    token_data: token,
                    target_system: config.TARGET_SYSTEM_ID
                });
            }
        } catch (err: any) {
            console.error(`[AutomationService] Token sync failed: ${err.message}`);
            throw err;
        }
    }

    static async getAutomationToken(targetSystem: number, username: string) {
        const baseUrl = (process.env.BFC_API_URL || 'https://api-dev-next.biofuelcircle.com/api/v1').replace(/\/$/, '');
        const url = `${baseUrl}/automation_token/?target_system=${targetSystem}&username=${encodeURIComponent(username)}`;
        try {
            // console.log(`[Service] Fetching Automation Token from: ${url}`);
            const response = await axios.get(url, {
                headers: {
                    'Authorization': `Bearer ${config.BFC_API_TOKEN}`,
                    'Accept': 'application/json'
                }
            });

            const data = response.data?.data || {};
            const results = data.results || [];

            if (results.length > 0) {
                const token = results[0].token_data;
                return token;
            }

            console.warn(`[AutomationService] No active automation token found for user: ${username}`);
            return null;
        } catch (err: any) {
            console.error(`[AutomationService] Failed to retrieve automation token: ${err.message}`);
            return null;
        }
    }

    /**
     * static helper for the Trigger API to decide between CONTINUE and LOGIN_AND_POST
     */
    static async checkTokenStatus(username: string, targetSystem: string): Promise<{ exists: boolean; id?: number }> {
        const baseUrl = (process.env.BFC_API_URL || 'https://api-dev-next.biofuelcircle.com/api/v1').replace(/\/$/, '');
        const url = `${baseUrl}/automation_token/?target_system=${targetSystem}&username=${encodeURIComponent(username)}`;
        
        try {
            const response = await axios.get(url, {
                headers: {
                    'Authorization': `Bearer ${config.BFC_API_TOKEN}`,
                    'Accept': 'application/json'
                }
            });

            const data = response.data?.data || {};
            const results = data.results || [];

            if (results.length > 0) {
                const tokenObj = results[0];
                return {
                    exists: true,
                    id: tokenObj.id
                };
            }

            return { exists: false };
        } catch (err: any) {
            console.error(`[AutomationService] Failed to check token status: ${err.message}`);
            return { exists: false };
        }
    }

    /**
     * Generic helper to poll for a specific field in the task object.
     */
    private async pollTaskField<T = string>(
        fieldName: string,
        condition: (data: any) => boolean,
        timeoutMs: number = 300000,
        pollingIntervalMs: number = 5000
    ): Promise<T> {
        const start = Date.now();
        let attempts = 0;

        await this.loadLookupData();
        const terminalStatuses = ['completed', 'failed'].map(s => this.lookupCache[s]).filter(id => id !== undefined);

        console.log(`[Service] Waiting for ${fieldName} input from dashboard on Task ${this.taskId}...`);
        while (timeoutMs === 0 || Date.now() - start < timeoutMs) {
            try {
                const url = `${this.baseUrl}/automation_task/${this.taskId}/`;
                const response = await axios.get(url, {
                    headers: this.headers
                });
                const data = response.data.data || response.data;

                // Stop polling if the task has been marked completed or failed by someone else
                if (terminalStatuses.includes(Number(data.status))) {
                    console.warn(`[AutomationService] Aborting poll for ${fieldName}: Task ${this.taskId} is already in terminal state "${data.status}".`);
                    throw new Error(`Task ${this.taskId} reached terminal state during polling.`);
                }

                if (condition(data)) {
                    const value = data[fieldName];
                    return value as T;
                }
            } catch (err: any) {
                if (err.message.includes('terminal state')) throw err;
                
                // Log periodic warnings instead of every failure to reduce noise
                if (attempts % 6 === 0) { // Approx once per 30s
                    console.warn(`[AutomationService] Polling Task ${this.taskId} for ${fieldName}... (${err.message})`);
                }
            }

            attempts++;
            await new Promise(resolve => setTimeout(resolve, pollingIntervalMs));
        }

        throw new Error(`[AutomationService] Timeout: User did not provide ${fieldName} within ${timeoutMs / 1000}s on the dashboard.`);
    }

}
