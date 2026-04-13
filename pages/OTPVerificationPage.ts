import { Page, Locator } from '@playwright/test';
import { AutomationService } from '../utils/automation-service';
import { config } from '../utils/config';

export class OTPVerificationPage {
    readonly page: Page;
    readonly verifyButton: Locator;

    constructor(page: Page) {
        this.page = page;
        this.verifyButton = page.getByRole('button', { name: 'Continue' });
    }

    /**
     * Fills the 6-digit OTP into the input fields with a small delay.
     */
    async fillOTP(otp: string) {
        otp = otp.trim().replace(/\D/g, ''); // Ensure only digits and trimmed
        if (otp.length !== 6) throw new Error(`OTP must be 6 digits, received: "${otp}"`);

        console.log(`[UI] Filling OTP digits individually...`);

        for (let i = 0; i < 6; i++) {
            const index = i + 1;
            const selector = `input[formcontrolname="input${index}"]`;

            // Focus and TYPE each digit for maximum event coverage (keyup, input, change)
            const input = this.page.locator(selector);
            await input.click({ timeout: 5000 });
            await input.pressSequentially(otp.charAt(i), { delay: 50 });

            // Small delay to ensure the UI processes the input
            await this.page.waitForTimeout(50);
        }

        // Final safety check: Blur the last input to trigger any remaining events
        await this.page.locator('input[formcontrolname="input6"]').blur();
        await this.page.waitForTimeout(500);
    }

    /**
     * Handles OTP verification using AutomationService.
     */
    async verify(automationService: AutomationService) {
        // Fetch OTP from the new API system
        const otp = await automationService.waitForOtp();
        await this.fillOTP(otp);

        // Wait for the button and ensure it is enabled
        await this.verifyButton.waitFor({ state: 'visible' });

        console.log(`[Auth] OTP filled. Clicking Continue...`);
        // Use force: true to bypass any potential overlays and ensure the click registers
        await this.verifyButton.click({ force: true });

        // Watch for results: Success (URL change) or Failure (Error message on screen)
        try {
            await Promise.all([
                // Success path
                this.page.waitForURL((url) => !url.href.includes('verifyOTP'), {
                    timeout: config.WAIT_TIMEOUT,
                    waitUntil: 'load'
                }),

            ]);
        } catch (err: any) {
            // If it's the portal error we threw, re-throw it
            if (err.message.includes('Portal Error')) throw err;

            // Otherwise, it was probably a URL timeout
            if (err.message.includes('timeout')) {
                throw new Error('Login Timeout: The page did not redirect after OTP submission. It might be slow or the record was not processed.');
            }
            throw err;
        }
    }
}
