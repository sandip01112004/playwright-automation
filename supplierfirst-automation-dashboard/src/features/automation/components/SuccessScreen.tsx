import React from 'react';

interface SuccessScreenProps {
    scn?: string;
}

const SuccessScreen: React.FC<SuccessScreenProps> = ({ scn }) => {
    return (
        <div className="glass-card">
            <div className="status-badge success" style={{ background: 'rgba(46, 204, 113, 0.2)', color: '#2ecc71' }}>Completed</div>
            <h2>Success!</h2>
            <p>Automation task has been completed successfully.</p>
            <div className="scn-box">
                <div style={{ color: '#2ecc71', fontSize: '0.7rem', textTransform: 'uppercase', marginBottom: '8px' }}>SCN Number</div>
                <div className="scn-value">{scn || 'N/A'}</div>
            </div>
        </div>
    );
};

export default SuccessScreen;
