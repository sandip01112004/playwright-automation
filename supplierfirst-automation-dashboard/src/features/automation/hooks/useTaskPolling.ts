import { useState, useEffect, useCallback, useRef } from 'react';
import { taskApi } from '../services/taskApi';
import { TaskData, LookupData } from '../types/automation.types';
import { getFriendlyErrorMessage } from '../utils/errorUtils';

export const useTaskPolling = (taskId: number | null) => {
    const [task, setTask] = useState<TaskData | null>(null);
    const [lookupData, setLookupData] = useState<LookupData[]>([]);
    const [logs, setLogs] = useState<string[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const taskRef = useRef<TaskData | null>(null);
    useEffect(() => {
        taskRef.current = task;
    }, [task]);

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
        if (taskId === null) return null;
        try {
            const data = await taskApi.getTaskStatus(taskId);
            setTask(data);
            return data;
        } catch (err: any) {
            console.warn(`[useTaskPolling] Fetch failed for Task ${taskId}: ${err.message}`);
            
            // Handle 404 specifically
            if (err.response?.status === 404) {
                setError(`Task #${taskId} not found on the server. Please check the ID or trigger a new task.`);
            }
            
            throw err;
        } finally {
            setLoading(false);
        }
    }, [taskId]);

    useEffect(() => {
        fetchInitialData();
    }, [fetchInitialData]);

    // Reset state when taskId changes
    useEffect(() => {
        if (taskId === null) {
            setTask(null);
            setLogs([]);
            setLoading(false);
            setError(null);
            return;
        }
        setTask(null);
        setLogs([]);
        setLoading(true);
        setError(null);
    }, [taskId]);

    useEffect(() => {
        // Log setup for debugging
        console.log(`[useTaskPolling] Setting up polling for Task ${taskId}. Lookup count: ${lookupData.length}`);

        if (taskId === null) return;

        let consecutiveFailures = 0;
        const FAILURE_LIMIT = 5;

        // Perform initial fetch immediately
        fetchTaskStatus().catch(err => {
            console.error('[useTaskPolling] Initial fetch failed:', err.message);
            consecutiveFailures++;
        });

        // Set up interval for subsequent fetches
        const interval = setInterval(async () => {
            // Use ref to check current status without depending on 'task' state
            const currentTask = taskRef.current;
            if (currentTask && isTerminalStatus(currentTask.status)) {
                console.log(`[useTaskPolling] Task ${taskId} is terminal. Stopping interval.`);
                clearInterval(interval);
                return;
            }

            try {
                if (taskId === null) return;
                console.log(`[useTaskPolling] Polling Task ${taskId}...`);
                const data = await fetchTaskStatus();
                
                if (!data) return;

                // Reset failure counter on success
                consecutiveFailures = 0;
                setError(null); // Clear any transient error status

                if (isTerminalStatus(data.status)) {
                    clearInterval(interval);
                }
            } catch (err: any) {
                consecutiveFailures++;
                console.warn(`[useTaskPolling] Polling failure ${consecutiveFailures}/${FAILURE_LIMIT}`);

                if (consecutiveFailures >= FAILURE_LIMIT) {
                    console.error(`[useTaskPolling] Reached failure limit. Stopping polling for Task ${taskId}.`);
                    clearInterval(interval);
                    setError('Connection to automation server lost. Please check your network and refresh.');
                } else if (consecutiveFailures === 1) {
                    // Optional: Show a "Connecting..." or "Retrying..." state instead of a hard error
                    console.log(`[useTaskPolling] First failure, waiting for next poll...`);
                }
            }
        }, 5000);

        return () => {
            console.log(`[useTaskPolling] Cleaning up polling for Task ${taskId}`);
            clearInterval(interval);
        };
    }, [taskId, fetchTaskStatus, isTerminalStatus, lookupData.length]);

    const submitOtp = async (otp: string) => {
        if (taskId === null) return;
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
