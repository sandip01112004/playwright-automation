import React from 'react';
import LoadingScreen from './components/LoadingScreen';
import OtpInputScreen from './components/OtpInputScreen';
import SuccessScreen from './components/SuccessScreen';
import ErrorScreen from './components/ErrorScreen';
import { useTaskPolling } from './hooks/useTaskPolling';
import './Automation.css';

const AutomationDashboard: React.FC = () => {
    // Get taskId from URL search parameters, default to 1
    const queryParams = new URLSearchParams(window.location.search);
    const taskId = parseInt(queryParams.get('taskId') || '1', 10);

    const { task, lookupData, logs, loading, error, submitOtp } = useTaskPolling(taskId);
    const scrollRef = React.useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom when logs update
    React.useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs]);

    if (loading && !task) {
        return (
            <div className="automation-feature">
                <LoadingScreen message="Initializing system connection..." />
            </div>
        );
    }

    if (error) {
        return (
            <div className="automation-feature">
                <ErrorScreen message={error} />
            </div>
        );
    }

    const renderContent = () => {
        if (!task) return <LoadingScreen message="Fetching task details..." />;

        const statusId = Number(task.status);

        // Helper to check status by string key
        const isStatus = (key: string) => lookupData.some((l: any) => (l.value === key || l.name === key) && l.id === statusId);

        if (isStatus('processing') || isStatus('otp_provided')) {
            return <LoadingScreen message={
                isStatus('otp_provided')
                    ? 'OTP Submitted. Resuming automation...'
                    : 'Automating SupplierFirst...'
            } />;
        }

        if (isStatus('awaiting_otp')) {
            return <OtpInputScreen onSubmit={submitOtp} />;
        }

        if (isStatus('completed')) {
            return <SuccessScreen />;
        }

        if (isStatus('failed')) {
            return <ErrorScreen message={task.error_message ?? undefined} />;
        }

        return <LoadingScreen message="Unknown state. Re-syncing..." />;
    };

    return (
        <div className="automation-feature">
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

            <div style={{ marginTop: '30px', fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)', letterSpacing: '1px' }}>
                Task ID: #{taskId} • Polling Active
            </div>
        </div>
    );
};

export default AutomationDashboard;
