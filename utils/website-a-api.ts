import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * Helper to interact with Website A APIs (Your System)
 */
export class WebsiteAApi {
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
            console.error(`[Website A API] Failed to fetch task: ${err.message}`);
            throw err;
        }
    }

    /**
     * Update task status (e.g., 'awaiting_otp', 'completed', 'failed')
     */
    async updateTaskStatus(status: string, extra: { otp?: string; error_message?: string; scn?: string } = {}) {
        console.log(`[Website A API] Updating Task ${this.taskId} to: ${status}`);
        try {
            const response = await axios.patch(`${this.baseUrl}/api/v1/automation_task/${this.taskId}/`, {
                status,
                ...extra
            }, {
                headers: this.headers
            });
            return response.data;
        } catch (err: any) {
            console.error(`[Website A API] Failed to update task status: ${err.message}`);
            throw err;
        }
    }

    /**
     * Poll Website A until the user has provided an OTP in the dashboard
     */
    async waitForOtp(timeoutMs: number = 300000) {
        console.log(`[Website A API] Waiting for OTP for Task ${this.taskId}...`);
        const start = Date.now();

        while (Date.now() - start < timeoutMs) {
            try {
                const response = await axios.get(`${this.baseUrl}/api/v1/automation_task/${this.taskId}/`, {
                    headers: this.headers
                });
                // The response might be { status: 'success', data: { otp: ... } } or just the object
                const data = response.data.data || response.data;
                if (data.otp && data.status === 'otp_provided') {
                    console.log(`[Website A API] OTP received: ${data.otp}`);
                    return data.otp;
                }
            } catch (err: any) {
                console.warn(`[Website A API] Polling error: ${err.message}`);
            }
            // Wait 5 seconds before next poll
            await new Promise(resolve => setTimeout(resolve, 5000));
        }

        throw new Error(`Timeout waiting for user to provide OTP on the dashboard.`);
    }

    /**
     * Poll Website A until a specific field is provided in the task object
     */
    async waitForInput(fieldName: string, timeoutMs: number = 300000): Promise<string> {
        console.log(`[Website A API] Waiting for ${fieldName} for Task ${this.taskId}...`);
        const start = Date.now();

        while (Date.now() - start < timeoutMs) {
            try {
                const response = await axios.get(`${this.baseUrl}/api/v1/automation_task/${this.taskId}/`, {
                    headers: this.headers
                });
                const data = response.data.data || response.data;
                if (data[fieldName]) {
                    console.log(`[Website A API] Received ${fieldName}: ${data[fieldName]}`);
                    return data[fieldName];
                }
            } catch (err: any) {
                console.warn(`[Website A API] Polling error for ${fieldName}: ${err.message}`);
            }
            // Wait 5 seconds before next poll
            await new Promise(resolve => setTimeout(resolve, 5000));
        }

        throw new Error(`Timeout waiting for user to provide ${fieldName} on the dashboard.`);
    }

    /**
     * Post session/token data after successful login
     */
    async saveAutomationToken(username: string, token: string) {
        console.log(`[Website A API] Saving token for user: ${username}`);
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
            console.error(`[Website A API] Failed to save automation token: ${err.message}`);
            throw err;
        }
    }

    /**
     * Fetch the automation token from the remote system
     */
    static async getAutomationToken(targetSystem: number, username: string) {
        const url = `https://api-dev-next.biofuelcircle.com/api/v1/automation_token/?target_system=${targetSystem}&username=${encodeURIComponent(username)}`;
        console.log(`[Website A API] Fetching automation token from: ${url}`);
        try {
            const response = await axios.get(url, {
                headers: {
                    'Authorization': `Bearer ${process.env.EXTERNAL_API_TOKEN || ''}`,
                    'Accept': 'application/json'
                }
            });
            console.log(`[Website A API] Full response:`, JSON.stringify(response.data, null, 2));
            // The response structure: { status, message, data: { results: [ { token_data, ... } ] } }
            const results = response.data?.data?.results;
            if (results && results.length > 0) {
                // Return the most recent token (first in results)
                console.log(`[Website A API] Token found for user ${username}: ${results[0].token_data.substring(0, 10)}...`);
                return results[0].token_data;
            }
            console.log(`[Website A API] No automation token found for user ${username}. Response:`, JSON.stringify(response.data.data, null, 2));
            return null;
        } catch (err: any) {
            console.error(`[Website A API] Failed to fetch automation token: ${err.message}`);
            return null;
        }
    }
}
