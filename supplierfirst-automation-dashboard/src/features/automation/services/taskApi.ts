import axios from 'axios';
import { TaskData, LookupData } from '../types/automation.types';

// In Create React App, variables MUST start with REACT_APP_ to be visible in the browser
const API_BASE_URL = (process.env.REACT_APP_biofuelcircle_API_BASE_URL || 'https://api-dev-next.biofuelcircle.com/api/v1').replace(/\/$/, '');
const API_TOKEN = process.env.REACT_APP_biofuelcircle_API_TOKEN || '';

const authHeaders = {
    'Authorization': `Bearer ${API_TOKEN}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
};

export const taskApi = {
    getLookupData: async (category: string): Promise<LookupData[]> => {
        const url = `${API_BASE_URL}/reference/lookupdata/?category=${category}`;
        try {
            const response = await axios.get(url, {
                headers: authHeaders,
            });
            return response.data.data?.data || response.data.data || response.data;
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

    updateTaskOtp: async (taskId: number, otp: string): Promise<TaskData> => {
        const response = await axios.patch(`${API_BASE_URL}/automation_task/${taskId}/`, {
            otp,
            status: 1298 // otp_provided 
        }, {
            headers: authHeaders,
        });
        return response.data.data || response.data;
    }
};

