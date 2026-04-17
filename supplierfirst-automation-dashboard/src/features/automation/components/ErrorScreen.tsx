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

            <div className="error-details-container">
                <p>{message || 'An unexpected error occurred during the automation process.'}</p>
            </div>

            {scn && (
                <div className="scn-box">
                    <span className="scn-label">Tracking Reference</span>
                    <div className="scn-value">{scn}</div>
                </div>
            )}
        </div>
    );
};

export default ErrorScreen;
