import { Page, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { OTPSelectionPage } from '../pages/OTPSelectionPage';
import { OTPVerificationPage } from '../pages/OTPVerificationPage';
import { AutomationService } from './automation-service';
import { config } from './config';

/**
 * Performs a full login flow including OTP selection and verification.
 * 
 * This function handles:
 * 1. Navigation to the login page.
 * 2. Entering the supplier ID.
 * 3. Selecting the OTP delivery channel.
 * 4. Waiting for and verifying the OTP (via AutomationService).
 * 5. Capturing the resulting authentication token from browser storage.
 * 
 * It is designed to be used both in standalone setup tests and within fixtures
 * to ensure that authentication happens within the same browser context/window.
 * 
 * @param page - The Playwright Page object to use for the login.
 * @param automationService - The service used to update status and fetch OTP.
 * @returns The captured session data including username and token.
 */
export async function performFullLogin(page: Page, automationService: AutomationService) {
    const loginPage = new LoginPage(page);
    const otpSelectionPage = new OTPSelectionPage(page);
    const otpVerificationPage = new OTPVerificationPage(page);

    try {
        console.log(`[Auth] Starting login flow for Supplier ID: ${config.SUPPLIER_ID}`);

        // Optimization: Only navigate if NOT already on the login page
        const currentUrl = page.url();
        if (!currentUrl.includes('/user/login')) {
            console.log(`[Auth] Navigating to login page (Current: ${currentUrl})`);
            await loginPage.navigate();
        } else {
            console.log(`[Auth] Already on login page, skipping navigation.`);
        }

        await loginPage.enterLoginId(config.SUPPLIER_ID);

        // OTP Selection
        await expect(page).toHaveURL(/.*\/sendOTP/);
        // Note: Specific channel selection may need to be dynamic in the future
        // For now, we use the same logic as the original spec
        await otpSelectionPage.selectChannel('Mobile: +91 94*****329');
        await expect(page).toHaveURL(/.*\/verifyOTP;type=sms;screen=login/);

        // Awaiting User/System OTP
        console.log(`[Auth] Awaiting OTP...`);
        await automationService.updateTaskStatus('awaiting_otp'); // Awaiting OTP

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
            let username = '';
            try {
                const info = JSON.parse(raw);
                username = `${info.firstname || ''}${info.lastname || ''}`.trim().toLowerCase();
            } catch (e) {
                console.error('Failed to parse userInfo:', e);
            }

            return { username, token };
        });

        if (!sessionData.token) {
            throw new Error('Capture failed: tokenValue not found in storage after login.');
        }

        console.log(`[Auth] Login successful. Capturing token...`);

        // Save the token for subsequent uses
        await automationService.saveAutomationToken(sessionData.token);

        return sessionData;

    } catch (err: any) {
        console.error(`[Auth] Full login flow failed: ${err.message}`);
        throw err;
    }
}
