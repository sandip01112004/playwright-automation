import React, { useState, useEffect } from 'react';

interface OtpInputScreenProps {
    defaultOtp?: string;
}

const OtpInputScreen: React.FC<OtpInputScreenProps> = ({ defaultOtp = '' }) => {
    const [otp, setOtp] = useState(defaultOtp);

    useEffect(() => {
        setOtp(defaultOtp || '');
    }, [defaultOtp]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value.replace(/\D/g, ''); // Only digits
        if (value.length <= 6) {
            setOtp(value);
        }
    };

    return (
        <div className="glass-card">
            <div className="status-badge await">Action Required</div>
            <h2>Enter OTP</h2>
            <p>Please enter the verification code sent from the supplierfirst portal.</p>
            <form className="otp-form" onSubmit={(e) => e.preventDefault()}>
                <input
                    type="text"
                    placeholder="000000"
                    value={otp}
                    onChange={handleInputChange}
                    maxLength={6}
                    disabled={true}
                    autoFocus
                />
                {otp && (
                    <div style={{ marginTop: '15px', color: '#60a5fa', fontSize: '0.9rem', fontWeight: 500 }}>
                        <div className="pulse-dot tiny" style={{ display: 'inline-block', marginRight: '8px' }}></div>
                        OTP received. Proceeding automatically...
                    </div>
                )}
            </form>
        </div>
    );
};

export default OtpInputScreen;
