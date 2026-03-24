import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { OTPSelectionPage } from '../pages/OTPSelectionPage';
import { OTPVerificationPage } from '../pages/OTPVerificationPage';
import { updateEnv } from '../utils/env-utils';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

test('Session Refresh: Login and Capture Tokens', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const otpSelectionPage = new OTPSelectionPage(page);
    const otpVerificationPage = new OTPVerificationPage(page);

    console.log('Starting session refresh flow...');

    await loginPage.navigate();
    await loginPage.enterLoginId(process.env.LOGIN_ID || '');

    // Handle OTP selection
    await expect(page).toHaveURL(/.*\/sendOTP/);
    await otpSelectionPage.selectChannel('Mobile: +91 94*****329');
    await expect(page).toHaveURL(/.*\/verifyOTP;type=sms;screen=login/);

    // Handle OTP verification (manual or remote auto-fill)
    await otpVerificationPage.verify();
    console.log('Successfully reached dashboard. Capturing tokens...');

    const tokens = await page.evaluate(() => {
        const authToken = localStorage.getItem('tokenValue') || '';

        // Try both camelCase and snake_case for the key
        const userDataRaw = localStorage.getItem('userInfo') || localStorage.getItem('user_info') || '{}';
        const userData = JSON.parse(userDataRaw);

        // Try both camelCase and snake_case for the property
        const refreshToken = userData.refreshToken || userData.refresh_token || '';

        // Decode expiry directly from the JWT token's payload 
        let expiry = '';
        try {
            const payload = JSON.parse(atob(authToken.split('.')[1]));
            if (payload.exp) {
                expiry = new Date(payload.exp * 1000).toISOString();
            }
        } catch {
            expiry = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
        }

        return {
            AUTH_TOKEN: authToken,
            REFRESH_TOKEN: refreshToken,
            TOKEN_EXPIRY: expiry,
        };
    });


    if (tokens.AUTH_TOKEN) {
        console.log('Tokens captured. Updating .env file...');
        updateEnv(tokens);
        console.log('Session refresh complete. All parameters are updated in .env.');
    } else {
        throw new Error('Failed to capture tokens from localStorage.');
    }
});
