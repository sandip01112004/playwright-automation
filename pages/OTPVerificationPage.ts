import { Page, Locator } from '@playwright/test';

export class OTPVerificationPage {
    readonly page: Page;
    readonly verifyButton: Locator;
    private dashboardBaseUrl: string = process.env.DASHBOARD_URL || 'http://localhost:5000';

    constructor(page: Page) {
        this.page = page;
        this.verifyButton = page.getByRole('button', { name: 'Continue' });
    }

    /**
     * Polls the remote dashboard for a value.
     */
    private async getRemoteInput(name: string): Promise<string> {
        console.log(`Requesting '${name}' from remote dashboard...`);

        // 1. Tell the dashboard we need an input
        await this.page.request.get(`${this.dashboardBaseUrl}/request-input/${name}`);

        // 2. Poll until we get a value
        while (true) {
            const res = await this.page.request.get(`${this.dashboardBaseUrl}/get-input/${name}`);
            const data = await res.json();

            if (data.value) {
                console.log(`Received '${name}': ${data.value}`);
                return data.value;
            }

            // Wait 2 seconds before polling again
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
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
        // This is much safer than .fill() for Angular/React apps
        for (let i = 0; i < 6; i++) {
            await this.page.keyboard.press(otp[i]);
            await this.page.waitForTimeout(100); // Small delay to mimic human speed
        }
    }

    // async waitForManualOTP() {
    //     console.log('Waiting for manual OTP entry and manual click on Continue...');
    //     // Wait until the URL no longer contains 'verifyOTP', meaning a manual navigation happened
    //     await this.page.waitForURL((url) => !url.href.includes('verifyOTP'), { timeout: 300000 });
    // }

    /**
     * Handles OTP verification based on the run mode.
     */
    async verify() {
        // Always fetch OTP from the dashboard
        const otp = await this.getRemoteInput('OTP');
        await this.fillOTP(otp);

        // Wait for the button to be enabled/clickable
        await this.page.waitForTimeout(1000);
        await this.verifyButton.waitFor({ state: 'visible' });
        await this.verifyButton.click();

        // Wait until the URL no longer contains 'verifyOTP', meaning a successful login or redirect
        await this.page.waitForURL((url) => !url.href.includes('verifyOTP'), { timeout: 60000 });

        /*
        // Manual input path (Currently disabled)
        if (process.env.RUN_MODE !== 'remote') {
            await this.waitForManualOTP();
        }
        */
    }
}
