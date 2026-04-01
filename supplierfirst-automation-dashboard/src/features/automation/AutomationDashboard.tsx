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

    const { task, loading, error, submitOtp } = useTaskPolling(taskId);

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

        const status = Number(task.status);
        switch (status) {
            case 1296: // processing
            case 1298: // otp_provided
                return <LoadingScreen message={
                    (status === 1298)
                        ? 'OTP Submitted. Resuming automation...'
                        : 'Automating Website B...'
                } />;

            case 1297: // awaiting_otp
                return <OtpInputScreen onSubmit={submitOtp} />;

            case 1299: // completed
                return <SuccessScreen />;

            case 1300: // failed
                return <ErrorScreen message={task.error_message ?? undefined} />;

            default:
                return <LoadingScreen message="Unknown state. Re-syncing..." />;
        }
    };

    return (
        <div className="automation-feature">
            {renderContent()}
            <div style={{ marginTop: '30px', fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)', letterSpacing: '1px' }}>
                Task ID: #{taskId} • Polling Active
            </div>
        </div>
    );
};

export default AutomationDashboard;
