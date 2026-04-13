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
    const [isReconnecting, setIsReconnecting] = useState<boolean>(false);

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

                // Reset on success
                consecutiveFailures = 0;
                setError(null);
                setIsReconnecting(false);

                if (isTerminalStatus(data.status)) {
                    clearInterval(interval);
                }

                // Fetch logs
                const logData = await taskApi.getTaskLogs(taskId);
                setLogs(logData);

                // --- Automated OTP Retrieval Consolidation ---
                // The worker now polls the database directly for the OTP.
                // This block has been removed to prevent duplicate submissions and keep the code clean.
            } catch (err: any) {
                consecutiveFailures++;
                console.warn(`[useTaskPolling] Polling failure ${consecutiveFailures}`);

                const currentTask = taskRef.current;
                const statusId = currentTask ? Number(currentTask.status) : null;
                const awaitingOtpId = taskApi.getStatusId('awaiting_otp');
                const processingId = taskApi.getStatusId('processing');
                
                // Critical state check: be more tolerant if we are in processing, awaiting_otp, 
                // OR if we haven't successfully connected yet (task is null)
                const isCriticalState = statusId === awaitingOtpId || statusId === processingId || currentTask === null;
                const MAX_FAILURES = isCriticalState ? 30 : 5;

                if (consecutiveFailures >= 2) {
                    setIsReconnecting(true);
                }

                if (consecutiveFailures >= MAX_FAILURES) {
                    // Only show "Connection Lost" if we don't have a terminal result already
                    const isTaskFailed = currentTask && lookupData.some(l => 
                        String(l.value || l.name).toLowerCase() === 'failed' && l.id === Number(currentTask.status)
                    );

                    if (!isTaskFailed) {
                        console.error(`[useTaskPolling] Reached failure limit (${MAX_FAILURES}). Stopping polling.`);
                        setError('Connection to automation server lost. Please check your network and refresh.');
                        setIsReconnecting(false);
                    }
                    clearInterval(interval);
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

    return { task, lookupData, logs, loading, error, isReconnecting, submitOtp };
};
