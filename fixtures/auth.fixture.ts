import { test as base, Page, expect } from '@playwright/test';
export { expect };
import * as path from 'path';
import * as dotenv from 'dotenv';
import { execSync } from 'child_process';
import { AutomationService } from '../utils/automation-service';
import { AutomationPayload } from '../types/automation';
import { config } from '../utils/config';

/**
 * Helper: inject fresh tokens into browser storage and navigate to base URL.
 */
async function injectTokensAndReload(page: Page, baseUrl: string) {
    const supplierName = config.SUPPLIER_NAME;
    const targetSystemId = config.TARGET_SYSTEM_ID;
    const apiToken = await AutomationService.getAutomationToken(targetSystemId, supplierName);

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

export const test = base.extend<{ page: Page, payload: AutomationPayload }>({
    payload: async ({ }, use) => {
        const encoded = process.env.TASK_PAYLOAD;
        if (!encoded) {
            // Default/Fallback for local testing if needed
            await use({} as AutomationPayload);
            return;
        }

        try {
            const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
            const parsed = JSON.parse(decoded) as AutomationPayload;
            await use(parsed);
        } catch (error) {
            console.error(`[Fixture] Failed to parse TASK_PAYLOAD: ${error}`);
            await use({} as AutomationPayload);
        }
    },
    page: async ({ browser, payload }, use) => {
        const context = await browser.newContext();
        const page = await context.newPage();
        const baseUrl = config.BASE_URL;
        const taskId = payload.task_id || 1;
        const automationService = new AutomationService(taskId);

        // Reset status to 1296 (Processing) at the very start of the fixture
        await automationService.updateTaskStatus(1296).catch(err => {
            console.error(`[Auth] Failed to reset task status: ${err.message}`);
        });

        // Step 1: Initial token injection
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
            console.log(`[Auth] Session expired or missing. Launching interactive login flow...`);
            const isHeadless = process.env.HEADLESS === 'true';
            const headedFlag = isHeadless ? '' : '--headed';

            try {
                execSync(`npx playwright test tests/auth-login.spec.ts ${headedFlag}`, {
                    cwd: path.resolve(__dirname, '..'),
                    stdio: 'inherit',
                    env: { ...process.env, TASK_ID: taskId.toString(), DASHBOARD_URL: process.env.DASHBOARD_URL || 'http://localhost:5000' }
                });
            } catch (error) {
                throw new Error('[Auth] Background login (auth-login.spec.ts) failed or cancelled.');
            }

            // Sync and re-inject fresh tokens
            config.refresh();
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
