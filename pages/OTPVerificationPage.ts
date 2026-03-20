import { Page, Locator } from '@playwright/test';

export class OTPVerificationPage {
    readonly page: Page;
    readonly verifyButton: Locator;

    constructor(page: Page) {
        this.page = page;
        this.verifyButton = page.getByRole('button', { name: 'Continue' });
    }

    async waitForManualOTP() {
        console.log('Waiting for manual OTP entry and manual click on Continue...');
        // Wait until the URL no longer contains 'verifyOTP', meaning a manual navigation happened
        await this.page.waitForURL((url) => !url.href.includes('verifyOTP'), { timeout: 300000 });
    }

    async verify() {
        // This is now handled manually by the user, but we keep the method for flexibility
        // await this.verifyButton.click();
    }
}
