import React, { useState } from 'react';

interface OtpInputScreenProps {
    onSubmit: (otp: string) => Promise<void>;
}

const OtpInputScreen: React.FC<OtpInputScreenProps> = ({ onSubmit }) => {
    const [otp, setOtp] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (otp.length < 4) return;
        setSubmitting(true);
        try {
            await onSubmit(otp);
        } catch (err) {
            setSubmitting(false);
        }
    };

    return (
        <div className="glass-card">
            <div className="status-badge await">Action Required</div>
            <h2>Enter OTP</h2>
            <p>Please enter the verification code sent to the supplier portal.</p>
            <form onSubmit={handleSubmit} className="otp-form">
                <input
                    type="text"
                    placeholder="000000"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    maxLength={6}
                    disabled={submitting}
                />
                <button type="submit" disabled={submitting || otp.length < 4}>
                    {submitting ? 'Submitting...' : 'Verify OTP'}
                </button>
            </form>
        </div>
    );
};

export default OtpInputScreen;
