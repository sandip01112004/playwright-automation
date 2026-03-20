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
    try {
        await expect(page).toHaveURL(/.*\/user\/otpSelection/, { timeout: 10000 });
        await otpSelectionPage.selectChannel('Mobile Number');
    } catch (e) {
        console.log('OTP Selection page did not appear or was skipped.');
    }

    // Wait for manual OTP and navigation to dashboard
    await otpVerificationPage.waitForManualOTP();
    await page.waitForURL(/.*\/homepage\/dashboard/, { timeout: 60000 });

    console.log('Successfully reached dashboard. Capturing tokens...');

    const tokens = await page.evaluate(() => {
        const user_info = JSON.parse(localStorage.getItem('user_info') || '{}');
        let expiry = localStorage.getItem('authTokenExpiry');

        if (!expiry) {
            // Default to 8 hours if no expiry found in storage
            const eightHoursLater = new Date(Date.now() + 8 * 60 * 60 * 1000);
            expiry = eightHoursLater.toISOString();
        }

        return {
            AUTH_TOKEN: localStorage.getItem('tokenValue') || '',
            REFRESH_TOKEN: user_info.refreshToken || '',
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
