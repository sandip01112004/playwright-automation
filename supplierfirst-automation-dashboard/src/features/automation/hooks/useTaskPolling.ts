import { useState, useEffect, useCallback } from 'react';
import { taskApi } from '../services/taskApi';
import { TaskData, LookupData } from '../types/automation.types';
import { getFriendlyErrorMessage } from '../utils/errorUtils';



export const useTaskPolling = (taskId: number) => {
    const [task, setTask] = useState<TaskData | null>(null);
    const [lookupData, setLookupData] = useState<LookupData[]>([]);
    const [logs, setLogs] = useState<string[]>([]);
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

            // Also fetch logs if in processing, awaiting_otp, or failed state
            const statusId = Number(data.status);
            const isLogsNeeded = lookupData.some((l: any) =>
                ['processing', 'awaiting_otp', 'otp_provided', 'failed', 'completed'].includes(l.value || l.name) && l.id === statusId
            );

            if (isLogsNeeded || true) { // Default to fetching for visibility
                const newLogs = await taskApi.getTaskLogs(taskId);
                if (newLogs.length > 0) setLogs(newLogs);
            }
        } catch (err: any) {
            const msg = getFriendlyErrorMessage(err);
            setError(msg);
        } finally {
            setLoading(false);
        }
    }, [taskId, lookupData]);

    useEffect(() => {
        fetchInitialData();
        fetchTaskStatus();

        const interval = setInterval(fetchTaskStatus, 5000);
        return () => clearInterval(interval);
    }, [fetchInitialData, fetchTaskStatus]);

    const submitOtp = async (otp: string) => {
        try {
            await taskApi.updateTaskOtp(taskId, otp, 'otp_provided');
            // Optimistically update local state using the helper to get the ID
            if (task) {
                const statusId = taskApi.getStatusId('otp_provided');
                if (statusId) {
                    setTask({ ...task, status: statusId });
                }
            }
        } catch (err) {
            setError(getFriendlyErrorMessage(err));
            throw err;
        }
    };

    return { task, lookupData, logs, loading, error, submitOtp };
};
