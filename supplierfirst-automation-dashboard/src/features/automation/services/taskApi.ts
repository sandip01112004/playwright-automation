import axios from 'axios';
import { TaskData, LookupData } from '../types/automation.types';

// In Create React App, variables MUST start with REACT_APP_ to be visible in the browser
const API_BASE_URL = (process.env.REACT_APP_biofuelcircle_API_BASE_URL || 'https://api-dev-next.biofuelcircle.com/api/v1').replace(/\/$/, '');
const API_TOKEN = process.env.REACT_APP_biofuelcircle_API_TOKEN || '';

const commonHeaders = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
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
            return response.data.data || response.data;
        } catch (error: any) {
            console.error(`[taskApi] getTaskStatus failed for ${url}:`, error.response?.status, error.response?.data || error.message);
            throw error;
        }
    },

    updateTaskOtp: async (taskId: number, otp: string, statusKey: string = 'otp_provided'): Promise<TaskData> => {
        const statusId = lookupCache[statusKey.toLowerCase()];

        if (!statusId) {
            console.error(`[taskApi] Status key "${statusKey}" not found in cache. Available:`, Object.keys(lookupCache));
            throw new Error(`Invalid status key: ${statusKey}`);
        }

        const response = await axios.patch(`${API_BASE_URL}/automation_task/${taskId}/`, {
            otp,
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
     * Fetch real-time automation logs from the Trigger API
     */
    getTaskLogs: async (taskId: number): Promise<string[]> => {
        // We assume the trigger API is reachable at this relative or absolute URL
        // In local dev, it's typically http://localhost:3001
        const TRIGGER_API_URL = process.env.REACT_APP_TRIGGER_API_URL || 'http://localhost:3001';
        try {
            const response = await axios.get(`${TRIGGER_API_URL}/api/logs/${taskId}`);
            return response.data.logs || [];
        } catch (error) {
            // Silently fail log fetching to avoid disrupting main status polling
            return [];
        }
    }
};

