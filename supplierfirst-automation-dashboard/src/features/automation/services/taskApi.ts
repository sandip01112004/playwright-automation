import axios from 'axios';
import { TaskData, LookupData } from '../types/automation.types';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://api-dev-next.biofuelcircle.com';

export const taskApi = {
    getLookupData: async (category: string): Promise<LookupData[]> => {
        const response = await axios.get(`${API_BASE_URL}/api/v1/reference/lookupdata/?category=${category}`);
        // Response format: { status: 'success', data: { count: 5, data: [...] } }
        return response.data.data?.data || response.data.data || response.data;
    },

    getTaskStatus: async (taskId: number): Promise<TaskData> => {
        const response = await axios.get(`${API_BASE_URL}/api/v1/automation_task/${taskId}/`);
        return response.data.data || response.data;
    },

    updateTaskOtp: async (taskId: number, otp: string): Promise<TaskData> => {
        const response = await axios.patch(`${API_BASE_URL}/api/v1/automation_task/${taskId}/`, {
            otp,
            status: 'otp_provided'
        });
        return response.data.data || response.data;
    }
};
