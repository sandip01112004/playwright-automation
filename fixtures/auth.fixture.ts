import { test as base, Page, expect } from '@playwright/test';
export { expect };
import * as dotenv from 'dotenv';
import * as path from 'path';
import { execSync } from 'child_process';
import { AutomationService } from '../utils/AutomationService';

dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });

/**
 * Helper: inject fresh tokens into browser storage and navigate to base URL.
 */
async function injectTokensAndReload(page: Page, baseUrl: string) {
    const supplierName = process.env.SUPPLIER_NAME || 'harish Iyer';
    const apiToken = await AutomationService.getAutomationToken(1295, supplierName);

    if (!apiToken) {
        throw new Error(`[Auth] Failed to fetch automation token for: ${supplierName}`);
    }

    // Ensure tokens are injected on every page load
    await page.context().addInitScript(({ token }) => {
        localStorage.setItem('tokenValue', token);
        localStorage.setItem('user_info', JSON.stringify({ token }));
        sessionStorage.setItem('tokenValue', token);
    }, { token: apiToken });

    await page.goto(baseUrl);
    await page.waitForLoadState('networkidle');
}

export const test = base.extend<{ page: Page }>({
    page: async ({ browser }, use) => {
        const context = await browser.newContext();
        const page = await context.newPage();
        const baseUrl = process.env.BASE_URL!;

        // Step 1: Initial navigation & token injection
        await injectTokensAndReload(page, baseUrl);

        // Step 2: Detect if redirected to login (session expired)
        let isLoginRequired = false;
        try {
            await Promise.race([
                page.waitForURL(/.*\/login/i, { timeout: 10000 }),
                page.waitForURL(/.*\/dashboard/i, { timeout: 10000 })
            ]);
            isLoginRequired = page.url().includes('/login');
        } catch {
            isLoginRequired = page.url().includes('/login');
        }

        if (isLoginRequired) {
            const isHeadless = process.env.HEADLESS === 'true';
            const headedFlag = isHeadless ? '' : '--headed';

            console.log(`[Auth] Session required. Launching interactive login flow...`);

            try {
                execSync(`npx playwright test tests/auth-login.spec.ts ${headedFlag}`, {
                    cwd: path.resolve(__dirname, '..'),
                    stdio: 'inherit',
                    env: { ...process.env, DASHBOARD_URL: process.env.DASHBOARD_URL || 'http://localhost:5000' }
                });
            } catch (error) {
                throw new Error('[Auth] Background login (auth-login.spec.ts) failed or cancelled.');
            }

            // Sync and re-inject fresh tokens
            dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });
            await injectTokensAndReload(page, baseUrl);
        }

        // Global Session Timeout Handlers
        page.on('dialog', async dialog => {
            if (dialog.message().toLowerCase().includes('session')) {
                await dialog.accept().catch(() => { });
            }
        });

        const sessionInterval = setInterval(async () => {
            try {
                const popup = page.getByText(/Session Timeout/i);
                if (await popup.isVisible().catch(() => false)) {
                    await page.getByRole('button', { name: 'Continue' }).click().catch(() => { });
                }
            } catch (e) { /* Ignore navigation errors */ }
        }, 15000);

        try {
            await use(page);
        } finally {
            clearInterval(sessionInterval);
            await context.close();
        }
    },
});
