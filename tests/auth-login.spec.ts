import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { OTPSelectionPage } from '../pages/OTPSelectionPage';
import { OTPVerificationPage } from '../pages/OTPVerificationPage';
import { AutomationService } from '../utils/automation-service';
import { config } from '../utils/config';

test('Session Refresh: Login and Capture Tokens', async ({ page }) => {
    const taskId = Number(process.env.TASK_ID) || 1;
    const automationService = new AutomationService(taskId);

    const loginPage = new LoginPage(page);
    const otpSelectionPage = new OTPSelectionPage(page);
    const otpVerificationPage = new OTPVerificationPage(page);

    try {
        // Initial setup and reporting
        await automationService.updateTaskStatus(1296); // Processing

        await loginPage.navigate();
        await loginPage.enterLoginId(config.SUPPLIER_ID);

        // OTP Selection
        await expect(page).toHaveURL(/.*\/sendOTP/);
        // Note: Specific channel selection may need to be dynamic in the future
        await otpSelectionPage.selectChannel('Mobile: +91 94*****329');
        await expect(page).toHaveURL(/.*\/verifyOTP;type=sms;screen=login/);

        // Awaiting User/System OTP
        await automationService.updateTaskStatus(1297); // Awaiting OTP

        // Verification and Token Capture
        await otpVerificationPage.verify(automationService);

        // Wait for redirect to finish and for the network to stabilize
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000); // Buffer for slower redirects/storage writes

        const sessionData = await page.evaluate(() => {
            // Helper to check both local and session storage
            const getFromStorage = (key: string) => localStorage.getItem(key) || sessionStorage.getItem(key);

            const token = getFromStorage('tokenValue') || '';
            const raw = getFromStorage('userInfo') || '{}';
            const info = JSON.parse(raw);
            const username = `${info.firstname || ''}${info.lastname || ''}`.trim().toLowerCase();

            return { username, token };
        });

        if (!sessionData.token) {
            throw new Error('Capture failed: tokenValue not found in storage after login.');
        }

        // Directly patch the token for the SUPPLIER_NAME in .env
        await automationService.saveAutomationToken(sessionData.token);


    } catch (err: any) {
        console.error(`[Auth] Flow failed: ${err.message}`);
        await automationService.updateTaskStatus(1300, { error_message: err.message });
        throw err;
    }
});
