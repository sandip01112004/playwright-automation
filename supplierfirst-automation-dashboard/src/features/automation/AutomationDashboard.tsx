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
        // Support both 'id' (requested) and 'taskId' (legacy)
        const id = queryParams.get('id') || queryParams.get('taskId');
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
            let idValue = queryParams.get('taskId');

            // Clever Fallback: If no 'id=' or 'taskId=' key is found, check if the query string is just a number (e.g. ?167)
            if (!idValue) {
                const rawQuery = window.location.search.substring(1);
                if (/^\d+$/.test(rawQuery)) {
                    idValue = rawQuery;
                }
            }

            if (!idValue) {
                setUrlError(null);
                setTaskId(null);
            } else {
                const parsedId = parseInt(idValue, 10);
                if (isNaN(parsedId)) {
                    setUrlError(`Invalid Task ID: The ID provided ("${idValue}") is not a valid number.`);
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


    // Active Task Discovery (Live Trigger via SSE)
    React.useEffect(() => {
        console.log('[Dashboard] Initializing real-time SSE listener...');

        const unsubscribe = taskApi.subscribeToEvents((newTaskId: string) => {
            const parsedId = parseInt(newTaskId, 10);

            // Only navigate if it's a new task or we are currently idle
            if (!taskId || parsedId !== taskId) {
                console.log(`[SSE] New Task Triggered: ${newTaskId}. Navigating...`);

                // Update URL to match requested format: /taskid?id=[taskId]
                const newUrl = `/taskid?id=${newTaskId}`;
                window.history.pushState({ taskId: parsedId }, '', newUrl);

                // Update state to trigger useTaskPolling
                setTaskId(parsedId);
            } else {
                console.log(`[SSE] Already tracking Task ${newTaskId}. Skipping navigation.`);
            }
        });

        return () => {
            console.log('[Dashboard] Cleaning up SSE listener.');
            unsubscribe();
        };
    }, [taskId]);

    const handleReset = React.useCallback(() => {
        // Clear the URL query params
        window.history.replaceState({}, document.title, window.location.pathname);
        setTaskId(null);

        // Refresh the page to restore clean idle state
        window.location.reload();
    }, []);

    const { task, lookupData, logs, loading, error, isReconnecting, isPolling } = useTaskPolling(taskId);

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
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '1rem', color: 'rgba(255,255,255,0.6)' }}>
                    <div className="loader" style={{ width: '30px', height: '30px' }}></div>
                    <span style={{ fontSize: '0.8rem', letterSpacing: '0.5px' }}>Loading...</span>
                </div>
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
                <div className="automation-feature">
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
            <div className="automation-feature">
                <ErrorScreen
                    message={error}
                    scn={(task as any)?.tracking_reference || (task as any)?.scn}
                    onReset={handleReset}
                />
            </div>
        );
    }

    const renderContent = () => {
        // Essential guard: if task data or lookup mappings aren't ready, show a simple loading state
        if (!task || lookupData.length === 0 || loading) {
            return (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '1rem', color: 'rgba(255,255,255,0.6)' }}>
                    <div className="loader" style={{ width: '40px', height: '40px' }}></div>
                    <span style={{ fontSize: '0.9rem', letterSpacing: '0.5px' }}>Loading...</span>
                </div>
            );
        }

        const statusId = Number(task.status);

        // Helper to check status by string key (safe now because we checked lookupData.length)
        const isStatus = (key: string) => lookupData.some((l: any) => (l.value === key || l.name === key) && l.id === statusId);

        if (isStatus('processing') || isStatus('otp_provided')) {
            return <LoadingScreen message={
                isStatus('otp_provided')
                    ? 'OTP Submitted. continuing automation...'
                    : 'Automating SupplierFirst...'
            } />;
        }

        if (isStatus('awaiting_otp')) {
            return (
                <div className="otp-auto-fetch-container">
                    <OtpInputScreen
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
                <div style={{
                    marginTop: '40px',
                    fontSize: '0.7rem',
                    color: 'rgba(255,255,255,0.2)',
                    letterSpacing: '1px',
                    textTransform: 'uppercase',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                }}>
                    <span style={{ opacity: 0.5 }}>Task #{taskId}</span>
                    <span style={{ width: '3px', height: '3px', borderRadius: '50%', background: 'currentColor', opacity: 0.3 }}></span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: isPolling ? '#10b981' : '#64748b' }}></div>
                        {isPolling ? 'Live Sync Active' : 'Polling Suspended'}
                    </span>
                </div>
            )}
        </div>
    );
};

export default AutomationDashboard;