import axios from 'axios';
import { TaskData, LookupData } from '../types/automation.types';

// In Create React App, variables MUST start with REACT_APP_ to be visible in the browser
const rawUrl = process.env.REACT_APP_TRIGGER_API_URL ?? '';
const TRIGGER_API_URL = rawUrl.replace(/\/$/, '');
const API_BASE_URL = `${TRIGGER_API_URL}/api/proxy`;
const API_TOKEN = process.env.REACT_APP_biofuelcircle_API_TOKEN || '';

const commonHeaders = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'ngrok-skip-browser-warning': 'true',
};

const authHeaders = {
    ...commonHeaders,
    'Authorization': `Bearer ${API_TOKEN}`,
};

const lookupCache: { [key: string]: number } = {};
const lookupDataPromiseCache: Record<string, Promise<LookupData[]> | undefined> = {};

export const taskApi = {
    getLookupData: (category: string): Promise<LookupData[]> => {
        const cachedPromise = lookupDataPromiseCache[category];
        if (cachedPromise) {
            return cachedPromise;
        }

        const url = `${API_BASE_URL}/reference/lookupdata/?category=${category}`;

        const fetchPromise = axios.get(url, { headers: commonHeaders })
            .then(response => {
                const data = response.data.data?.data || response.data.data || response.data;

                // Cache automation status mapping for later use
                if (category === 'automation_status' && Array.isArray(data)) {
                    data.forEach((item: LookupData) => {
                        const id = item.id;
                        const keys = [item.value, item.name].filter(k => typeof k === 'string' && k.length > 0);

                        keys.forEach(k => {
                            lookupCache[k.toLowerCase()] = id;
                        });
                    });
                }
                return data;
            })
            .catch((error: any) => {
                console.error(`[taskApi] getLookupData failed for ${url}:`, error.response?.status, error.response?.data || error.message);
                delete lookupDataPromiseCache[category]; // Remove from cache on failure so we can retry later
                throw error;
            });

        lookupDataPromiseCache[category] = fetchPromise;
        return fetchPromise;
    },

    getTaskStatus: async (taskId: number): Promise<TaskData> => {
        const url = `${API_BASE_URL}/automation_task/${taskId}/`;
        try {
            const response = await axios.get(url, {
                headers: authHeaders,
            });

            // Defensive: Check if we got an ngrok error page instead of JSON
            if (typeof response.data === 'string' && response.data.includes('ngrok')) {
                throw new Error('Ngrok Tunnel Error: The backend tunnel is inactive or the URL is invalid (ERR_NGROK_6024).');
            }

            return response.data.data || response.data;
        } catch (error: any) {
            if (error.message === 'Network Error') {
                throw new Error('Network Error: The automation server is unreachable. This usually happens if the ngrok tunnel is down or your internet is unstable.');
            }
            console.error(`[taskApi] getTaskStatus failed for ${url}:`, error.response?.status, error.response?.data || error.message);
            throw error;
        }
    },

    /**
     * Specifically fetch the OTP from the task object (or dedicated endpoint)
     */
    fetchAutomatedOtp: async (taskId: number): Promise<string | null> => {
        const url = `${API_BASE_URL}/automation_task/${taskId}/`;
        try {
            const response = await axios.get(url, { headers: authHeaders });
            const data = response.data.data || response.data;
            return data.otp || null;
        } catch (error) {
            return null;
        }
    },



    updateTaskStatus: async (taskId: number, statusKey: string): Promise<TaskData> => {
        const statusId = lookupCache[statusKey.toLowerCase()];

        if (!statusId) {
            console.error(`[taskApi] Status key "${statusKey}" not found in cache. Available:`, Object.keys(lookupCache));
            throw new Error(`Invalid status key: ${statusKey}`);
        }

        const response = await axios.patch(`${API_BASE_URL}/automation_task/${taskId}/`, {
            status: statusId
        }, {
            headers: authHeaders,
        });
        return response.data.data || response.data;
    },

    /**
     * Helper to get a status ID from a string key (if cached)
     */
    getStatusId: (key: string): number | undefined => {
        return lookupCache[key.toLowerCase()];
    },

    /**
     * Discovery: Fetch the most recently triggered task from the Trigger API
     */
    getActiveTask: async (): Promise<{ taskId: string | null; status: string } | null> => {
        const TRIGGER_API_URL = process.env.REACT_APP_TRIGGER_API_URL;
        const SECRET_KEY = process.env.REACT_APP_SCN_API_SECRET_KEY;

        try {
            const response = await axios.get(`${TRIGGER_API_URL}/api/active-task`, {
                headers: {
                    ...commonHeaders,
                    'x-api-key': SECRET_KEY
                }
            });
            return response.data;
        } catch (error) {
            return null;
        }
    },

    /**
     * Fetch real-time automation logs from the Trigger API
     */
    getTaskLogs: async (taskId: number): Promise<string[]> => {
        const TRIGGER_API_URL = process.env.REACT_APP_TRIGGER_API_URL || 'http://localhost:3001';
        // Use the secret key for the handshake with the Trigger API
        const SECRET_KEY = process.env.REACT_APP_SCN_API_SECRET_KEY || '';

        try {
            const response = await axios.get(`${TRIGGER_API_URL}/api/logs/${taskId}`, {
                headers: {
                    ...commonHeaders,
                    'x-api-key': SECRET_KEY
                }
            });
            return response.data.logs || [];
        } catch (error) {
            // Silently fail log fetching to avoid disrupting main status polling
            console.warn('[taskApi] Log fetch failed. Check X-API-KEY or Trigger API status.');
            return [];
        }
    }
};

