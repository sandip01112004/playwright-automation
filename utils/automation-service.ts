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
            console.log(`[AutomationService] Fetching lookup data from: ${url}`);
            const response = await axios.get(url, { headers: this.headers });

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

            console.log(`[AutomationService] Loaded ${Object.keys(this.lookupCache).length} lookup entries for ${category}: ${Object.keys(this.lookupCache).join(', ')}`);
        } catch (err: any) {
            console.error(`[AutomationService] Failed to load lookup data: ${err.message}`);
            if (err.response) {
                console.error(`[AutomationService] Lookup Error Details: ${JSON.stringify(err.response.data).substring(0, 200)}`);
            }
            throw new Error(`Critical: Failed to load ${category} mapping. Automation cannot proceed.`);
        }
    }

    /**
     * Fetch the task object from the backend
     */
    async getTask() {
        try {
            const url = `${this.baseUrl}/automation_task/${this.taskId}/`;
            console.log(`>>> [DEBUG] FETCHING TASK FROM: ${url}`);
            const response = await axios.get(url, {
                headers: this.headers
            });
            const data = response.data.data || response.data;
            console.log(`[AutomationService] Task ${this.taskId} data fetched successfully.`);

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
        await this.loadLookupData();

        const statusId = this.lookupCache[statusKey.toLowerCase()];
        if (!statusId) {
            console.error(`[AutomationService] Invalid status key: "${statusKey}". Available: ${Object.keys(this.lookupCache).join(', ')}`);
            throw new Error(`Invalid status key: ${statusKey}`);
        }

        console.log(`[AutomationService] Updating Task ${this.taskId} status: "${statusKey}" -> ${statusId}`);
        const payload: any = { status: statusId, ...extra };

        // If status is 'processing', explicitly clear old data
        if (statusId === this.lookupCache['processing']) {
            payload.otp = '';
            payload.error_message = '';
        }

        const url = `${this.baseUrl}/automation_task/${this.taskId}/`;
        try {
            const response = await axios.patch(url, payload, {
                headers: this.headers
            });
            return response.data;
        } catch (err: any) {
            console.error(`[AutomationService] Failed to update task status: ${err.message}`);
            if (err.response) {
                console.error(`[AutomationService] Server responded with: ${JSON.stringify(err.response.data)}`);
            }
            throw err;
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
            const searchResponse = await axios.get(searchUrl, { headers: this.headers });
            const results = searchResponse.data?.data?.results || [];

            if (results.length > 0) {
                const tokenId = results[0].id;
                await axios.patch(`${this.baseUrl}/automation_token/${tokenId}/`, {
                    token_data: token
                }, { headers: this.headers });
            } else {
                await axios.post(`${this.baseUrl}/automation_token/`, {
                    username,
                    token_data: token,
                    target_system: config.TARGET_SYSTEM_ID
                }, { headers: this.headers });
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
            console.log(`[AutomationService] Fetching Automation Token from: ${url}`);
            const response = await axios.get(url, {
                headers: {
                    'Authorization': `Bearer ${config.BFC_API_TOKEN}`,
                    'Accept': 'application/json'
                }
            });

            const results = response.data?.data?.results;
            if (results && results.length > 0) {
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

        console.log(`[AutomationService] Polling for ${fieldName} on Task ${this.taskId}...`);
        while (timeoutMs === 0 || Date.now() - start < timeoutMs) {
            try {
                const url = `${this.baseUrl}/automation_task/${this.taskId}/`;
                const response = await axios.get(url, {
                    headers: this.headers
                });
                const data = response.data.data || response.data;

                if (condition(data)) {
                    const value = data[fieldName];
                    return value as T;
                }
            } catch (err: any) {
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
