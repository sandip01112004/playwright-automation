import React from 'react';

interface ErrorScreenProps {
    message?: string;
    scn?: string;
}

const ErrorScreen: React.FC<ErrorScreenProps> = ({ message, scn }) => {
    return (
        <div className="glass-card">
            <div className="status-badge error" style={{ background: 'rgba(231, 76, 60, 0.2)', color: '#e74c3c' }}>Failed</div>
            <h2>Automation Error</h2>
            <p>{message || 'An unexpected error occurred during the automation process.'}</p>
            {scn && (
                <div className="scn-box" style={{ borderColor: '#e74c3c', background: 'rgba(231, 76, 60, 0.1)' }}>
                    <div style={{ color: '#e74c3c', fontSize: '0.7rem', textTransform: 'uppercase', marginBottom: '8px' }}>Tracking Reference</div>
                    <div className="scn-value">{scn}</div>
                </div>
            )}
            <button
                onClick={() => window.location.reload()}
                className="retry-btn"
                style={{
                    marginTop: '20px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    color: 'white',
                    padding: '10px 20px',
                    borderRadius: '10px',
                    cursor: 'pointer'
                }}
            >
                Retry Process
            </button>
        </div>
    );
};

export default ErrorScreen;
