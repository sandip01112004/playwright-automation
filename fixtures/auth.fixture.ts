import { test as base, Page, expect } from '@playwright/test';
export { expect };
import * as dotenv from 'dotenv';
import * as path from 'path';
import { execSync } from 'child_process';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Helper: inject auth tokens into localStorage/sessionStorage and reload
async function injectTokensAndReload(page: Page, baseUrl: string) {
    await page.goto(baseUrl);
    await page.waitForLoadState('domcontentloaded');
    await page.evaluate(({ authToken, refreshToken }) => {
        localStorage.setItem('tokenValue', authToken);
        localStorage.setItem('user_info', JSON.stringify({ token: authToken, refreshToken }));
        sessionStorage.setItem('tokenValue', authToken);
    }, {
        authToken: process.env.AUTH_TOKEN!,
        refreshToken: process.env.REFRESH_TOKEN!,
    });
    await page.reload();
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

        // Step 2: Check for redirect to login page (Token expired/invalid)
        // We wait a few seconds to give the app time to process the reload and decide if it needs a login
        try {
            await page.waitForURL(/.*\/login/, { timeout: 6000 });
        } catch (e) {
            // No redirect to login occurred, we stay on dashboardURL
        }

        const currentUrl = page.url();
        if (currentUrl.includes('/login')) {
            const runMode = process.env.RUN_MODE || 'local';
            const dashboardUrl = process.env.DASHBOARD_URL ? `DASHBOARD_URL=${process.env.DASHBOARD_URL} ` : '';

            console.log(`[Fixture] Token rejected (URL: ${currentUrl}). Launching auth-login (Mode: ${runMode})...`);

            // Run auth-login — blocks until OTP is entered and tokens are saved to .env
            execSync(`${dashboardUrl}RUN_MODE=${runMode} npx playwright test tests/auth-login.spec.ts --headed`, {
                cwd: path.resolve(__dirname, '..'),
                stdio: 'inherit',
            });

            // Reload .env with fresh tokens
            dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });
            console.log('Fresh tokens loaded. Re-injecting and continuing...\n');

            // Re-inject fresh tokens and reload using the same helper
            await injectTokensAndReload(page, baseUrl);
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
