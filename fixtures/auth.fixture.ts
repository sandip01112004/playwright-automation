import { test as base, Page, expect } from '@playwright/test';
export { expect };
import * as dotenv from 'dotenv';
import * as path from 'path';
import { execSync } from 'child_process';

dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });

// Helper: inject auth tokens into localStorage/sessionStorage using addInitScript (more robust)
async function injectTokensAndReload(page: Page, baseUrl: string) {
    const authToken = process.env.AUTH_TOKEN!;
    const refreshToken = process.env.REFRESH_TOKEN!;

    // Step 1: Add a script that runs on every page load to ensure tokens are always present
    await page.context().addInitScript(({ authToken, refreshToken }) => {
        localStorage.setItem('tokenValue', authToken);
        localStorage.setItem('user_info', JSON.stringify({ token: authToken, refreshToken }));
        sessionStorage.setItem('tokenValue', authToken);
    }, { authToken, refreshToken });

    // Step 2: Navigate and wait for loading to complete
    await page.goto(baseUrl);
    await page.waitForLoadState('networkidle');
}

export const test = base.extend({
    page: async ({ browser }, use) => {

        if (!process.env.AUTH_TOKEN ||
            !process.env.REFRESH_TOKEN ||
            !process.env.DOMAIN_NAME) {
            throw new Error('Required auth environment variables (AUTH_TOKEN, REFRESH_TOKEN, DOMAIN_NAME) are missing');
        }

        const context = await browser.newContext();
        const page = await context.newPage();
        const baseUrl = process.env.BASE_URL!;

        // Inject zoom on every page navigation via addInitScript
        // await page.addInitScript(() => {
        //     window.addEventListener('DOMContentLoaded', () => {
        //         document.body.style.zoom = "70%";
        //     });
        // });


        // Step 1: Initial navigation & injection
        await injectTokensAndReload(page, baseUrl);

        // Step 2: Check for redirect to login page or presence of login elements
        // This is more robust than just checking the URL
        console.log('[Fixture] Checking if login is required...');
        let isLoginRequired = false;
        try {
            // Wait for either the login URL or the login input box to appear
            await Promise.race([
                page.waitForURL(/.*\/login/i, { timeout: 8000 }),
                page.getByRole('textbox', { name: /Supplier ID/i }).waitFor({ state: 'visible', timeout: 8000 }),
                page.waitForSelector('#loginID', { timeout: 8000 })
            ]);
            isLoginRequired = true;
        } catch (e) {
            // If neither appears, we might be on the dashboard already
            const currentUrl = page.url();
            const supplierIdVisible = await page.getByRole('textbox', { name: /Supplier ID/i }).isVisible().catch(() => false);
            if (currentUrl.includes('/login') || supplierIdVisible || await page.locator('#loginID').isVisible()) {
                isLoginRequired = true;
            }
        }

        if (isLoginRequired) {
            const runMode = process.env.RUN_MODE || 'local';
            console.log(`[Fixture] Login REQUIRED (URL: ${page.url()}). Launching auth-login spec...`);

            // Run auth-login — blocks until OTP is entered and tokens are saved to .env
            // Use the 'env' option for cross-platform environment variable support
            const authEnv = { 
                ...process.env, 
                RUN_MODE: runMode,
                // Ensure DASHBOARD_URL is passed through if it exists
                DASHBOARD_URL: process.env.DASHBOARD_URL || 'http://localhost:5000'
            };

            try {
                execSync(`npx playwright test tests/auth-login.spec.ts --headed`, {
                    cwd: path.resolve(__dirname, '..'),
                    stdio: 'inherit',
                    env: authEnv
                });
            } catch (error) {
                console.error('[Fixture] auth-login.spec.ts failed or was interrupted.');
                throw error;
            }

            // Reload .env with fresh tokens
            dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });
            console.log('[Fixture] Fresh tokens loaded from .env. Re-injecting...\n');

            // Re-inject fresh tokens and reload
            await injectTokensAndReload(page, baseUrl);
        } else {
            console.log('[Fixture] Login not required, proceeding to test.');
        }

        // Step 3: Handle Session Timeout Popups Globally (UI modals & Native Dialogs)
        page.on('dialog', async dialog => {
            if (dialog.message().toLowerCase().includes('session')) {
                console.log(`[Fixture] Auto-accepting native dialog: ${dialog.message()}`);
                await dialog.accept();
            }
        });

        const sessionInterval = setInterval(async () => {
            try {
                const popup = page.getByText(/Session Timeout/i);
                if (await popup.isVisible().catch(() => false)) {
                    console.log('[Fixture] Session Timeout detected in UI. Clicking Continue...');
                    await page.getByRole('button', { name: 'Continue' }).click().catch(() => { });
                }
            } catch (e) { /* Ignore during navigation */ }
        }, 10000); // Check every 10 seconds

        // URL is expected — proceed with the test normally
        try {
            await use(page);
        } finally {
            clearInterval(sessionInterval);
        }

        await context.close();
    },
});
