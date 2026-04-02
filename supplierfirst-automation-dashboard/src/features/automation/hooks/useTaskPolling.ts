import { useState, useEffect, useCallback } from 'react';
import { taskApi } from '../services/taskApi';
import { TaskData, LookupData } from '../types/automation.types';
import { getFriendlyErrorMessage } from '../utils/errorUtils';



export const useTaskPolling = (taskId: number) => {
    const [task, setTask] = useState<TaskData | null>(null);
    const [lookupData, setLookupData] = useState<LookupData[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const fetchInitialData = useCallback(async () => {
        try {
            const data = await taskApi.getLookupData('automation_status');
            setLookupData(data);
        } catch (err) {
            console.error('Error fetching lookup data:', err);
        }
    }, []);

    const fetchTaskStatus = useCallback(async () => {
        try {
            const data = await taskApi.getTaskStatus(taskId);
            setTask(data);
            setError(null);
        } catch (err: any) {
            const msg = getFriendlyErrorMessage(err);
            setError(msg);
        } finally {
            setLoading(false);
        }
    }, [taskId]);

    useEffect(() => {
        fetchInitialData();
        fetchTaskStatus();

        const interval = setInterval(fetchTaskStatus, 5000);
        return () => clearInterval(interval);
    }, [fetchInitialData, fetchTaskStatus]);

    const submitOtp = async (otp: string) => {
        try {
            await taskApi.updateTaskOtp(taskId, otp);
            if (task) {
                setTask({ ...task, status: 1298 });
            }
        } catch (err) {
            setError(getFriendlyErrorMessage(err));
            throw err;
        }
    };

    return { task, lookupData, loading, error, submitOtp };
};
