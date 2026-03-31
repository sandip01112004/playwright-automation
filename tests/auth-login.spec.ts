import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { OTPSelectionPage } from '../pages/OTPSelectionPage';
import { OTPVerificationPage } from '../pages/OTPVerificationPage';
import { AutomationService } from '../utils/AutomationService';
import * as dotenv from 'dotenv';

dotenv.config();

test('Session Refresh: Login and Capture Tokens', async ({ page }) => {
    const taskId =  1;
    const automationService = new AutomationService(taskId);

    const loginPage = new LoginPage(page);
    const otpSelectionPage = new OTPSelectionPage(page);
    const otpVerificationPage = new OTPVerificationPage(page);

    try {
        // Initial setup and reporting
        await automationService.updateTaskStatus(1296); // Processing

        await loginPage.navigate();
        await loginPage.enterLoginId(process.env.LOGIN_ID || '');

        // OTP Selection
        await expect(page).toHaveURL(/.*\/sendOTP/);
        // Note: Specific channel selection may need to be dynamic in the future
        await otpSelectionPage.selectChannel('Mobile: +91 94*****329');
        await expect(page).toHaveURL(/.*\/verifyOTP;type=sms;screen=login/);

        // Awaiting User/System OTP
        await automationService.updateTaskStatus(1297); // Awaiting OTP

        // Verification and Token Capture
        await otpVerificationPage.verify(automationService);

        const sessionData = await page.evaluate(() => {
            const token = localStorage.getItem('tokenValue') || '';
            const userInfoRaw = localStorage.getItem('userInfo') || '{}';
            const userInfo = JSON.parse(userInfoRaw);
            const username = `${userInfo.firstname || ''} ${userInfo.lastname || ''}`.trim() || 'unknown';
            return { username, token };
        });

        if (!sessionData.token) {
            throw new Error('Capture failed: tokenValue not found in localStorage.');
        }

        await automationService.saveAutomationToken(sessionData.username, sessionData.token);
        console.log(`[Auth] Session refreshed for user: ${sessionData.username}`);

    } catch (err: any) {
        console.error(`[Auth] Flow failed: ${err.message}`);
        await automationService.updateTaskStatus(1300, { error_message: err.message });
        throw err;
    }
});
