import { useState, useEffect, useCallback } from 'react';
import { taskApi } from '../services/taskApi';
import { TaskData, LookupData } from '../types/automation.types';

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
            // We don't block the UI if just lookup data fails, but Log it
        }
    }, []);

    const fetchTaskStatus = useCallback(async () => {
        try {
            const data = await taskApi.getTaskStatus(taskId);
            setTask(data);
            if (loading) setLoading(false);
        } catch (err) {
            console.error('Polling error:', err);
            // Don't set global error yet, just Log. Persistent failure might need handling.
        }
    }, [taskId, loading]);

    useEffect(() => {
        fetchInitialData();
        fetchTaskStatus();

        const interval = setInterval(fetchTaskStatus, 5000);
        return () => clearInterval(interval);
    }, [fetchInitialData, fetchTaskStatus]);

    const submitOtp = async (otp: string) => {
        try {
            await taskApi.updateTaskOtp(taskId, otp);
            // Optimistically update local state or wait for next poll
            if (task) {
                setTask({ ...task, status: 1298 }); // 1298 is otp_provided
            }
        } catch (err) {
            setError('Failed to submit OTP');
            throw err;
        }
    };

    return { task, lookupData, loading, error, submitOtp };
};
