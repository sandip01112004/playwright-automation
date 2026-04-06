import axios from 'axios';
import { TaskData, LookupData } from '../types/automation.types';

// In Create React App, variables MUST start with REACT_APP_ to be visible in the browser
const API_BASE_URL = (process.env.REACT_APP_biofuelcircle_API_BASE_URL || 'https://api-dev-next.biofuelcircle.com/api/v1').replace(/\/$/, '');
const API_TOKEN = process.env.REACT_APP_biofuelcircle_API_TOKEN || '';

// Diagnostic check (can be removed once debugged)
console.log('[taskApi] Configuration:', {
    baseUrl: API_BASE_URL,
    hasToken: !!API_TOKEN,
    tokenPrefix: API_TOKEN ? API_TOKEN.substring(0, 10) + '...' : 'none'
});

const commonHeaders = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
};

const authHeaders = {
    ...commonHeaders,
    'Authorization': `Bearer ${API_TOKEN}`,
};

const lookupCache: { [key: string]: number } = {};

export const taskApi = {
    getLookupData: async (category: string): Promise<LookupData[]> => {
        const url = `${API_BASE_URL}/reference/lookupdata/?category=${category}`;
        try {
            const response = await axios.get(url, {
                headers: commonHeaders, // Public endpoint
            });
            const data = response.data.data?.data || response.data.data || response.data;

            // Cache automation status for later use
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
        } catch (error: any) {
            console.error(`[taskApi] getLookupData failed for ${url}:`, error.response?.status, error.response?.data || error.message);
            throw error;
        }
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
    }
};

