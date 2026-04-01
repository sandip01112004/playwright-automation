import React from 'react';

const SuccessScreen: React.FC = () => {
    return (
        <div className="glass-card">
            <div className="status-badge success">Completed</div>
            <h2>Task Finished</h2>
            <p>The automation has been completed successfully. You can now close this window or return to the main portal.</p>
        </div>
    );
};

export default SuccessScreen;
