import React from 'react';

const SuccessScreen: React.FC = () => {
    return (
        <div className="glass-card">
            <div className="status-badge success" style={{ background: 'rgba(46, 204, 113, 0.2)', color: '#2ecc71' }}>Completed</div>
            <h2>Success!</h2>
            <p>Automation task has been completed successfully.</p>
        </div>
    );
};

export default SuccessScreen;
