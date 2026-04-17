import React from 'react';

interface ErrorScreenProps {
    message?: string;
    scn?: string;
    onReset?: () => void;
}

const ErrorScreen: React.FC<ErrorScreenProps> = ({ message, scn, onReset }) => {
    return (
        <div className="glass-card">
            <div className="status-badge error">Failed</div>
            <h2>Automation Error</h2>
            <p>{message || 'An unexpected error occurred during the automation process.'}</p>
            {scn && (
                <div className="scn-box">
                    <span className="scn-label">Tracking Reference</span>
                    <div className="scn-value">{scn}</div>
                </div>
            )}

            {onReset && (
                <div style={{ marginTop: '2rem' }}>
                    <button className="reset-button" onClick={onReset}>
                        Return to Idle State
                    </button>
                    <p style={{ fontSize: '0.8rem', opacity: 0.6, marginTop: '0.5rem' }}>
                        This will clear the current task and reset the dashboard.
                    </p>
                </div>
            )}
        </div>
    );
};

export default ErrorScreen;
