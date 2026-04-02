import { Page, Locator } from '@playwright/test';
import { AutomationService } from '../utils/automation-service';

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

        // Click the first box to ensure focus
        await this.page.locator('input[formcontrolname="input1"]').click();

        // Use individual key presses to ensure all events (keydown, keypress, keyup) fire correctly
        for (let i = 0; i < 6; i++) {
            await this.page.keyboard.press(otp.charAt(i));
            await this.page.waitForTimeout(100); // Small delay to mimic human speed
        }
    }

    /**
     * Handles OTP verification using AutomationService.
     */
    async verify(automationService: AutomationService) {
        // Fetch OTP from the new API system
        const otp = await automationService.waitForOtp();
        await this.fillOTP(otp);

        // Wait for the button to be enabled/clickable
        await this.verifyButton.waitFor({ state: 'visible' });
        await this.verifyButton.click();

        // Wait until the URL no longer contains 'verifyOTP', meaning a successful login or redirect
        await this.page.waitForURL((url) => !url.href.includes('verifyOTP'), { timeout: 60000 });
    }
}
