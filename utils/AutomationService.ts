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

    constructor(taskId: number, baseUrl: string = process.env.WEBSITE_A_BASE_URL || 'https://api-dev-next.biofuelcircle.com') {
        this.taskId = taskId;
        this.baseUrl = baseUrl;
        this.headers = {
            'Authorization': `Bearer ${process.env.EXTERNAL_API_TOKEN || ''}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };
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
    async updateTaskStatus(status: number, extra: { otp?: string; error_message?: string; scn?: string } = {}) {
        console.log(`[AutomationService] Updating Task ${this.taskId} to: ${status}`);
        try {
            const response = await axios.patch(`${this.baseUrl}/api/v1/automation_task/${this.taskId}/`, {
                status,
                ...extra
            }, {
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
            (data) => data.otp && (Number(data.status) === 1298 ),
            timeoutMs
        );
    }

    /**
     * Poll until a specific field is provided in the task object
     */
    async waitForInput(fieldName: string, timeoutMs: number = 300000): Promise<string> {
        return this.pollTaskField<string>(
            fieldName,
            (data) => !!data[fieldName],
            timeoutMs
        );
    }

    /**
     * Post session/token data after successful login
     */
    async saveAutomationToken(username: string, token: string) {
        try {
            const response = await axios.post(`${this.baseUrl}/api/v1/automation_token/`, {
                username,
                token_data: token,
                target_system: 1295
            }, {
                headers: this.headers
            });
            return response.data;
        } catch (err: any) {
            console.error(`[AutomationService] Failed to save automation token: ${err.message}`);
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
