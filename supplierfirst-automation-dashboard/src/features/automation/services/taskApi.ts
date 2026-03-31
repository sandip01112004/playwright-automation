import axios from 'axios';
import { TaskData, LookupData } from '../types/automation.types';

const API_BASE_URL = 'https://api-dev-next.biofuelcircle.com/api/v1';
const API_TOKEN = process.env.REACT_APP_API_TOKEN || '';

const authHeaders = {
    'Authorization': `Bearer ${API_TOKEN}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
};

export const taskApi = {
    getLookupData: async (category: string): Promise<LookupData[]> => {
        const url = `${API_BASE_URL}/reference/lookupdata/?category=${category}`;
        console.log(`[taskApi] GET ${url}`);
        try {
            const response = await axios.get(url, {
                headers: authHeaders,
            });
            console.log(`[taskApi] getLookupData success:`, response.data);
            return response.data.data?.data || response.data.data || response.data;
        } catch (error: any) {
            console.error(`[taskApi] getLookupData failed for ${url}:`, error.response?.status, error.response?.data || error.message);
            throw error;
        }
    },

    getTaskStatus: async (taskId: number): Promise<TaskData> => {
        const url = `${API_BASE_URL}/automation_task/${taskId}/`;
        console.log(`[taskApi] GET ${url}`);
        try {
            const response = await axios.get(url, {
                headers: authHeaders,
            });
            console.log(`[taskApi] getTaskStatus success:`, response.data);
            return response.data.data || response.data;
        } catch (error: any) {
            console.error(`[taskApi] getTaskStatus failed for ${url}:`, error.response?.status, error.response?.data || error.message);
            throw error;
        }
    },

    updateTaskOtp: async (taskId: number, otp: string): Promise<TaskData> => {
        const response = await axios.patch(`${API_BASE_URL}/automation_task/${taskId}/`, {
            otp,
            status: 1298 // otp_provided (numeric)
        }, {
            headers: authHeaders,
        });
        return response.data.data || response.data;
    }
};

