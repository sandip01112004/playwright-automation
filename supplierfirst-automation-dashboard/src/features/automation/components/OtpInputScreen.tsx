import React, { useState, useEffect } from 'react';

interface OtpInputScreenProps {
    onSubmit: (otp: string, skipOtpUpdate?: boolean) => Promise<void>;
    defaultOtp?: string;
}

const OtpInputScreen: React.FC<OtpInputScreenProps> = ({ onSubmit, defaultOtp = '' }) => {
    const [otp, setOtp] = useState(defaultOtp);
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e?: React.FormEvent, overrideOtp?: string, isAuto?: boolean) => {
        if (e) e.preventDefault();
        const finalOtp = overrideOtp || otp;
        if (finalOtp.length < 4 || submitting) return;

        setSubmitting(true);
        try {
            await onSubmit(finalOtp, isAuto);
        } catch (err) {
            setSubmitting(false);
        }
    };

    useEffect(() => {
        if (defaultOtp && defaultOtp.length === 6 && !submitting) {
            setOtp(defaultOtp);
            console.log('[OtpInputScreen] Automated OTP detected. Triggering auto-verify...');
            handleSubmit(undefined, defaultOtp, true);
        } else if (defaultOtp) {
            setOtp(defaultOtp);
        }
    }, [defaultOtp, submitting]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value.replace(/\D/g, ''); // Only digits
        if (value.length <= 6) {
            setOtp(value);
            // Auto-submit if 6 digits are reached
            if (value.length === 6 && !submitting) {
                handleSubmit(undefined, value);
            }
        }
    };

    return (
        <div className="glass-card">
            <div className="status-badge await">Action Required</div>
            <h2>Enter OTP</h2>
            <p>Please enter the verification code sent from the supplierfirst portal.</p>
            <form onSubmit={handleSubmit} className="otp-form">
                <input
                    type="text"
                    placeholder="000000"
                    value={otp}
                    onChange={handleInputChange}
                    maxLength={6}
                    disabled={submitting}
                    autoFocus
                />
                <button type="submit" disabled={submitting || otp.length < 4}>
                    {submitting ? 'Verifying...' : 'Verify OTP'}
                </button>
            </form>
        </div>
    );
};

export default OtpInputScreen;
