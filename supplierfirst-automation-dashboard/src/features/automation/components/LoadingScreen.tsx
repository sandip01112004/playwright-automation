import React from 'react';

interface LoadingScreenProps {
    message?: string;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ message = 'Automating tasks, please wait...' }) => {
    return (
        <div className="glass-card">
            <div className="status-badge loading">Processing</div>
            <div className="loader"></div>
            <h2>Please Wait</h2>
            <p>{message}</p>
        </div>
    );
};

export default LoadingScreen;
