import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * Helper to interact with Website A APIs (Your System)
 */
export class AutomationService {
    private taskId: number;
    private baseUrl: string;
    private headers: any;
    public payload: any = null;

    constructor(taskId: number, baseUrl: string = process.env.WEBSITE_A_BASE_URL || 'https://api-dev-next.biofuelcircle.com') {
        this.taskId = taskId;
        this.baseUrl = baseUrl;
        this.headers = {
            'Authorization': `Bearer ${process.env.EXTERNAL_API_TOKEN || ''}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };

        // Decode payload if provided by the Trigger API
        if (process.env.TASK_PAYLOAD) {
            try {
                const decoded = Buffer.from(process.env.TASK_PAYLOAD, 'base64').toString('utf8');
                this.payload = JSON.parse(decoded);
                console.log(`[AutomationService] Loaded payload for Task ${this.taskId}`);
            } catch (err) {
                console.error(`[AutomationService] Failed to decode TASK_PAYLOAD: ${err}`);
            }
        }
    }

    /**
     * Fetch the task object
     */
    async getTask() {
        try {
            const response = await axios.get(`${this.baseUrl}/api/v1/automation_task/${this.taskId}`, {
                headers: this.headers
            });
            return response.data.data || response.data;
        } catch (err: any) {
            console.error(`[AutomationService] Failed to fetch task: ${err.message}`);
            throw err;
        }
    }

    /**
     * Update task status (e.g., 'awaiting_otp', 'completed', 'failed')
     */
    async updateTaskStatus(status: number, extra: { otp?: string; error_message?: string } = {}) {
        console.log(`[AutomationService] Updating Task ${this.taskId} to: ${status}`);
        const payload: any = { status, ...extra };

        // If status is 1296 (Processing), explicitly clear old data
        if (status === 1296) {
            payload.otp = '';
            payload.error_message = '';
        }

        try {
            const response = await axios.patch(`${this.baseUrl}/api/v1/automation_task/${this.taskId}/`, payload, {
                headers: this.headers
            });
            return response.data;
        } catch (err: any) {
            console.error(`[AutomationService] Failed to update task status: ${err.message}`);
            throw err;
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

        while (timeoutMs === 0 || Date.now() - start < timeoutMs) {
            try {
                const response = await axios.get(`${this.baseUrl}/api/v1/automation_task/${this.taskId}/`, {
                    headers: this.headers
                });
                const data = response.data.data || response.data;

                if (condition(data)) {
                    const value = data[fieldName];
                    console.log(`[AutomationService] Received ${fieldName} for Task ${this.taskId}`);
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

    /**
     * Poll until the user has provided an OTP in the dashboard
     */
    async waitForOtp(timeoutMs: number = 0) {
        return this.pollTaskField<string>(
            'otp',
            (data) => data.otp && (Number(data.status) === 1298),
            timeoutMs
        );
    }

    /**
     * Poll until a specific field is provided in the task object.
     * PRIORITY: If the field exists in the initial payload, use it immediately.
     */
    async waitForInput(fieldName: string, timeoutMs: number = 300000): Promise<string> {
        // 1. Check the local payload first (Industrial Standard: No polling if data is provided)
        if (this.payload && this.payload[fieldName]) {
            console.log(`[AutomationService] Using ${fieldName} from initial payload.`);
            return this.payload[fieldName].toString();
        }

        // 2. Otherwise, fall back to polling the BFC database
        return this.pollTaskField<string>(
            fieldName,
            (data) => !!data[fieldName],
            timeoutMs
        );
    }

    /**
     * Directly update the automation token for the user defined in .env (SUPPLIER_NAME)
     */
    async saveAutomationToken(token: string) {
        const username = process.env.SUPPLIER_NAME!;
        try {
            // Search for existing record
            const searchUrl = `${this.baseUrl}/api/v1/automation_token/?target_system=1295&username=${encodeURIComponent(username)}`;
            const searchResponse = await axios.get(searchUrl, { headers: this.headers });
            const results = searchResponse.data?.data?.results || [];

            if (results.length > 0) {
                const tokenId = results[0].id;
                console.log(`[AutomationService] Patching token (ID: ${tokenId}) for ${username}`);
                await axios.patch(`${this.baseUrl}/api/v1/automation_token/${tokenId}/`, {
                    token_data: token
                }, { headers: this.headers });
            } else {
                console.log(`[AutomationService] Creating new token for ${username}`);
                await axios.post(`${this.baseUrl}/api/v1/automation_token/`, {
                    username,
                    token_data: token,
                    target_system: 1295
                }, { headers: this.headers });
            }
        } catch (err: any) {
            console.error(`[AutomationService] Token sync failed: ${err.message}`);
            throw err;
        }
    }

    /**
     * Fetch the most recent automation token for a specific user and system.
     */
    static async getAutomationToken(targetSystem: number, username: string) {
        const url = `https://api-dev-next.biofuelcircle.com/api/v1/automation_token/?target_system=${targetSystem}&username=${encodeURIComponent(username)}`;
        try {
            const response = await axios.get(url, {
                headers: {
                    'Authorization': `Bearer ${process.env.EXTERNAL_API_TOKEN || ''}`,
                    'Accept': 'application/json'
                }
            });

            const results = response.data?.data?.results;
            if (results && results.length > 0) {
                const token = results[0].token_data;
                console.log(`[AutomationService] Token found for user "${username}" (${token.substring(0, 10)}...)`);
                return token;
            }

            console.warn(`[AutomationService] No active automation token found for user: ${username}`);
            return null;
        } catch (err: any) {
            console.error(`[AutomationService] Failed to retrieve automation token: ${err.message}`);
            return null;
        }
    }
}
