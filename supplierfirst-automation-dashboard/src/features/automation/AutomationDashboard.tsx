import React from 'react';
import LoadingScreen from './components/LoadingScreen';
import OtpInputScreen from './components/OtpInputScreen';
import SuccessScreen from './components/SuccessScreen';
import ErrorScreen from './components/ErrorScreen';
import { useTaskPolling } from './hooks/useTaskPolling';
import { taskApi } from './services/taskApi';
import './Automation.css';

const AutomationDashboard: React.FC = () => {
    // 1. Task State Tracking
    const [taskId, setTaskId] = React.useState<number | null>(() => {
        const queryParams = new URLSearchParams(window.location.search);
        const id = queryParams.get('taskId');
        return id ? parseInt(id, 10) : null;
    });

    // 2. Prevent Re-discovery of handled tasks
    const handledTaskIds = React.useRef<Set<string>>(new Set());

    // Mark current task as handled once it becomes active
    React.useEffect(() => {
        if (taskId) {
            handledTaskIds.current.add(taskId.toString());
        }
    }, [taskId]);

    const [urlError, setUrlError] = React.useState<string | null>(null);

    // Listen for URL changes
    React.useEffect(() => {
        const handleUrlChange = () => {
            const queryParams = new URLSearchParams(window.location.search);
            const idValue = queryParams.get('taskId');

            if (!idValue) {
                setUrlError(null);
                setTaskId(null);
            } else {
                const parsedId = parseInt(idValue, 10);
                if (isNaN(parsedId)) {
                    setUrlError('Invalid Task ID: The taskId provided is not a valid number.');
                    setTaskId(null);
                } else {
                    setUrlError(null);
                    setTaskId(parsedId);
                }
            }
        };

        handleUrlChange();
        window.addEventListener('popstate', handleUrlChange);
        return () => window.removeEventListener('popstate', handleUrlChange);
    }, []);

    // Active Task Discovery (Polls when idle)
    const fetchInitialData = React.useCallback(async () => {
        try {
            await taskApi.getLookupData('automation_status');
        } catch (err) {
            console.error('Error fetching lookup data:', err);
        }
    }, []);

    // Fetch lookup data only when a task becomes active
    React.useEffect(() => {
        if (taskId) {
            fetchInitialData();
        }
    }, [taskId, fetchInitialData]);

    // Active Task Discovery (Polls continuously to detect restarts or new tasks)
    React.useEffect(() => {
        const discoveryInterval = setInterval(async () => {
            const active = await taskApi.getActiveTask();
            if (!active || !active.taskId) return;

            // Optimization: Wake up if task is STARTING
            // We focus on STARTING because trigger-api sets it to STARTING only at the beginning of a flow
            const isStarting = active.status === 'STARTING';
            const isNewTask = !taskId || active.taskId.toString() !== taskId.toString();

            if (isStarting || isNewTask) {
                // Only "wake up" if we haven't already handled this specific STARTING event for this task
                // We use a combination of taskId and a 'recomputing' flag if needed, 
                // but for now, just setting the taskId will trigger a refresh in useTaskPolling if taskId changes.
                // If taskId is the same, we need to manually force a refresh or rely on useTaskPolling.

                if (isNewTask || !handledTaskIds.current.has(`${active.taskId}_${active.status}`)) {
                    console.log(`[Discovery] ${isNewTask ? 'New' : 'Restarted'} task detected: ${active.taskId} (Status: ${active.status}). Waking up...`);

                    // Mark as handled for this specific status
                    handledTaskIds.current.add(`${active.taskId}_${active.status}`);

                    const newUrl = `${window.location.pathname}?taskId=${active.taskId}`;
                    window.history.pushState({}, '', newUrl);

                    // If taskId is the same, we need to force useTaskPolling to restart.
                    // The easiest way is to briefly set taskId to null then back, 
                    // or better: let useTaskPolling handle status transitions from terminal to active.

                    if (!isNewTask) {
                        // Force a reload if it's a restart of the same task to ensure all hooks reset
                        window.location.reload();
                    } else {
                        setTaskId(parseInt(active.taskId, 10));
                    }
                }
            }
        }, Number(process.env.REACT_APP_DISCOVERY_INTERVAL || 3000));

        return () => clearInterval(discoveryInterval);
    }, [taskId]);

    const handleReset = React.useCallback(async () => {
        // Clear the URL query params
        window.history.replaceState({}, document.title, window.location.pathname);
        setTaskId(null);

        // Signal the Trigger API to reset its memory
        try {
            const TRIGGER_API_URL = process.env.REACT_APP_TRIGGER_API_URL || 'http://localhost:3001';
            const SECRET_KEY = process.env.REACT_APP_SCN_API_SECRET_KEY || '';
            await fetch(`${TRIGGER_API_URL}/api/reset`, {
                method: 'POST',
                headers: { 'x-api-key': SECRET_KEY }
            });
        } catch (err) {
            console.warn('[Dashboard] API Reset failed:', err);
        }

        // Refresh the page to restore clean idle state
        window.location.reload();
    }, []);

    const { task, lookupData, logs, loading, error, isReconnecting, submitOtp } = useTaskPolling(taskId);

    // Auto-reset to Idle when task is finished
    React.useEffect(() => {
        if (!taskId || !task || !lookupData.length) return;

        const statusId = Number(task.status);
        const isFinished = lookupData.some(l =>
            String(l.value || l.name).toLowerCase() === 'completed' && l.id === statusId
        );

        if (isFinished) {
            console.log(`[Dashboard] Task ${taskId} completed. Returning to Idle in 3 seconds...`);
            const timer = setTimeout(() => {
                window.history.pushState({}, '', window.location.pathname);
                setTaskId(null);
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [task, taskId, lookupData]);

    const scrollRef = React.useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom when logs update
    React.useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs]);

    // Handle Idle State (No Task ID)
    if (!taskId) {
        return (
            <div className="automation-feature">
                <div className="glass-card" style={{ maxWidth: '500px' }}>
                    <div className="status-badge" style={{ marginBottom: '32px' }}>System Ready</div>
                    <div style={{ position: 'relative', width: '80px', height: '80px', margin: '0 auto 32px' }}>
                        <div style={{
                            width: '100%', height: '100%',
                            borderRadius: '50%', background: 'rgba(59, 130, 246, 0.1)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            <div className="pulse-dot"></div>
                        </div>
                    </div>
                    <h2>Waiting for Trigger</h2>
                    <p>
                        The automation system is currently idle and listening for external API triggers from BFC.
                    </p>
                    <div style={{ marginTop: '10px', padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                        <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Endpoint Active</div>
                        <code style={{ fontSize: '0.85rem', color: '#60a5fa' }}>
                            POST /api/trigger
                        </code>
                    </div>

                    <div style={{ marginTop: '20px' }}>
                        <button
                            onClick={handleReset}
                            style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '0.75rem', textDecoration: 'underline' }}
                        >
                            Reset Discovery State
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (urlError) {
        return (
            <div className="automation-feature">
                <ErrorScreen message={urlError} onReset={handleReset} />
            </div>
        );
    }

    if (loading && !task) {
        return (
            <div className="automation-feature">
                <LoadingScreen message="Initializing system connection..." />
            </div>
        );
    }

    // Error Priority: If a polling error occurs, check if we already have a task failure first
    if (error) {
        // If we have task data AND it's already in a failed status, prefer showing that specific error
        const isTaskFailed = task && lookupData.some(l =>
            String(l.value || l.name).toLowerCase() === 'failed' && l.id === Number(task.status)
        );

        if (isTaskFailed) {
            return (
                <div className="dashboard-container">
                    <ErrorScreen
                        message={task.error_message || error}
                        scn={(task as any)?.tracking_reference || (task as any)?.scn}
                        onReset={handleReset}
                    />
                </div>
            );
        }

        // Otherwise show the polling error (e.g. "Connection lost")
        return (
            <div className="dashboard-container">
                <ErrorScreen
                    message={error}
                    scn={(task as any)?.tracking_reference || (task as any)?.scn}
                    onReset={handleReset}
                />
            </div>
        );
    }

    const renderContent = () => {
        // Essential guard: if task data or lookup mappings aren't ready, keep loading
        if (!task || lookupData.length === 0) {
            return <LoadingScreen message="Syncing with automation server..." />;
        }

        const statusId = Number(task.status);

        // Helper to check status by string key (safe now because we checked lookupData.length)
        const isStatus = (key: string) => lookupData.some((l: any) => (l.value === key || l.name === key) && l.id === statusId);

        if (isStatus('processing') || isStatus('otp_provided')) {
            return <LoadingScreen message={
                isStatus('otp_provided')
                    ? 'OTP Submitted. Resuming automation...'
                    : 'Automating SupplierFirst...'
            } />;
        }

        if (isStatus('awaiting_otp')) {
            return (
                <div className="otp-auto-fetch-container">
                    <OtpInputScreen
                        onSubmit={submitOtp}
                        defaultOtp={task?.otp || ''}
                    />
                    <div className="auto-fetch-status">
                        <div className="pulse-dot tiny"></div>
                        <span>Currently fetching OTP automatically from BFC...</span>
                    </div>
                </div>
            );
        }

        if (isStatus('completed')) {
            return <SuccessScreen />;
        }

        if (isStatus('failed')) {
            return <ErrorScreen message={task.error_message ?? undefined} onReset={handleReset} />;
        }

        return <LoadingScreen message="Unknown state. Re-syncing..." />;
    };

    return (
        <div className="automation-feature">
            {isReconnecting && (
                <div className="reconnecting-banner">
                    <div className="pulse-dot tiny orange"></div>
                    Connection unstable. Retrying...
                </div>
            )}
            {renderContent()}

            {/* Live Log Terminal */}
            {logs.length > 0 && (
                <div className="log-terminal">
                    <div className="log-header">Live Automation Logs</div>
                    <div className="log-body" ref={scrollRef}>
                        {logs.map((log, i) => (
                            <div key={i} className="log-line">
                                <span className="log-timestamp">{new Date().toLocaleTimeString()}</span>
                                <span className="log-text">{log}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Footer Status Bar - Show for any valid task ID */}
            {taskId !== null && (
                <div style={{ marginTop: '30px', fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)', letterSpacing: '1px' }}>
                    Task ID: #{taskId} • Polling Active
                </div>
            )}
        </div>
    );
};

export default AutomationDashboard;
