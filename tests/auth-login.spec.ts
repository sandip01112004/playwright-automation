import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { OTPSelectionPage } from '../pages/OTPSelectionPage';
import { OTPVerificationPage } from '../pages/OTPVerificationPage';
import { WebsiteAApi } from '../utils/website-a-api';
import * as dotenv from 'dotenv';

dotenv.config();

test('Session Refresh: Login and Capture Tokens', async ({ page }) => {
    const taskId = 1;
    const websiteA = new WebsiteAApi(taskId);

    const loginPage = new LoginPage(page);
    const otpSelectionPage = new OTPSelectionPage(page);
    const otpVerificationPage = new OTPVerificationPage(page);

    console.log(`Starting session refresh flow for Task ${taskId}...`);

    try {
        // Step 0: Report Processing
        await websiteA.updateTaskStatus('1296');

        await loginPage.navigate();
        await loginPage.enterLoginId(process.env.LOGIN_ID || '');

        // Handle OTP selection
        await expect(page).toHaveURL(/.*\/sendOTP/);
        await otpSelectionPage.selectChannel('Mobile: +91 94*****329');
        await expect(page).toHaveURL(/.*\/verifyOTP;type=sms;screen=login/);

        // Step 1: Report Awaiting OTP
        await websiteA.updateTaskStatus('1297');

        // Step 2: Handle OTP verification
        await otpVerificationPage.verify(websiteA);
        console.log('Successfully reached dashboard. Capturing tokens...');

        const sessionData = await page.evaluate(() => {
            const token = localStorage.getItem('tokenValue') || '';
            const userInfoRaw = localStorage.getItem('userInfo') || localStorage.getItem('user_info') || '{}';
            const userInfo = JSON.parse(userInfoRaw);

            // Concatenate firstname and lastname for username
            const firstName = userInfo.firstname || '';
            const lastName = userInfo.lastname || '';
            const username = `${firstName} ${lastName}`.trim() || 'unknown';

            return { username, token };
        });

        if (sessionData.token) {
            console.log(`Saving token for user: ${sessionData.username}`);
            await websiteA.saveAutomationToken(
                sessionData.username,
                sessionData.token
            );
            console.log('Session refresh complete. Token saved to API.');
        } else {
            throw new Error('Failed to capture token from localStorage.');
        }

    } catch (err: any) {
        console.error(`[Auth Login] Failed: ${err.message}`);
        await websiteA.updateTaskStatus('1300', { error_message: err.message });
        throw err;
    }
});
