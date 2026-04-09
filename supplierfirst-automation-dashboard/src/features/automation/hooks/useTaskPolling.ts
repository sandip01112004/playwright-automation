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

    const isTerminalStatus = useCallback((status: any) => {
        if (!status || lookupData.length === 0) return false;
        const statusId = Number(status);
        return lookupData.some(l => 
            ['completed', 'failed'].includes(String(l.value || l.name).toLowerCase()) && l.id === statusId
        );
    }, [lookupData]);

    const fetchTaskStatus = useCallback(async () => {
        try {
            const data = await taskApi.getTaskStatus(taskId);
            setTask(data);
            setError(null);
            return data;
        } catch (err: any) {
            const msg = getFriendlyErrorMessage(err);
            setError(msg);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [taskId]);

    useEffect(() => {
        fetchInitialData();
    }, [fetchInitialData]);

    useEffect(() => {
        // Only start polling if we have lookup data and it's not already terminal
        if (lookupData.length === 0) return;
        if (isTerminalStatus(task?.status)) return;

        // Perform initial fetch
        fetchTaskStatus().catch(() => {});

        // Set up interval for subsequent fetches
        const interval = setInterval(async () => {
            try {
                const data = await fetchTaskStatus();
                // Stop polling if we reached a terminal state
                if (isTerminalStatus(data.status)) {
                    clearInterval(interval);
                }
            } catch (err) {
                // Keep polling on transient errors, fetchTaskStatus handles error state
            }
        }, 5000);

        return () => clearInterval(interval);
        // Important: We do NOT depend on 'task' here to avoid restarting the interval on every update
    }, [lookupData, taskId, isTerminalStatus, fetchTaskStatus]);

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
