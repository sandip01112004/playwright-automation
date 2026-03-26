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
        const headers = { 'ngrok-skip-browser-warning': 'true' };

        // 1. Tell the dashboard we need an input
        await fetch(`${this.dashboardBaseUrl}/request-input/${name}`, { headers }).catch(err => {
            console.error(`[OTP Sync] Failed to request input ${name}:`, err instanceof Error ? err.message : err);
        });

        // 2. Poll until we get a value
        while (true) {
            try {
                const res = await fetch(`${this.dashboardBaseUrl}/get-input/${name}`, { headers });
                
                const contentType = res.headers.get('content-type') || '';
                if (contentType.includes('application/json')) {
                    const data = await res.json();
                    if (data && data.value) {
                        console.log(`Received '${name}': ${data.value}`);
                        return data.value;
                    }
                }
            } catch (err) {
                // Silently ignore polling errors to avoid crashing the test, just retry
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
