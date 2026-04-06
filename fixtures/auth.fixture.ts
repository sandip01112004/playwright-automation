import { test as base, Page, expect } from '@playwright/test';
export { expect };
import * as path from 'path';
import { AutomationService } from '../utils/automation-service';
import { AutomationPayload } from '../types/automation';
import { config } from '../utils/config';
import { performFullLogin } from '../utils/auth-helpers';

/**
 * Helper: Inject fresh tokens into browser storage and navigate to base URL.
 * @param page - Playwright Page object
 * @param baseUrl - The base URL to navigate to after injection
 */
async function injectTokensAndReload(page: Page, baseUrl: string) {
    await test.step('Inject & Verify Auth Tokens', async () => {
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
    });
}

/**
 * Extended Playwright test with automatic authentication handling.
 * Provides a 'page' fixture that is pre-authenticated and handles session expiry.
 */
export const test = base.extend<{ page: Page, payload: AutomationPayload }>({
    /**
     * Extracts and decodes the automation payload from environment variables.
     */
    payload: async ({ }, use) => {
        const encoded = process.env.TASK_PAYLOAD;
        if (!encoded) {
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

    /**
     * Provides a pre-authenticated Page object.
     * Automatically handles token injection, session validation, and interactive login if needed.
     */
    page: async ({ browser, payload }, use) => {
        const context = await browser.newContext();
        const page = await context.newPage();
        const baseUrl = config.BASE_URL;
        const taskId = payload.task_id || 1;
        const automationService = new AutomationService(taskId);

        // 1. Initialize Task Status
        await test.step('Initialize Task Status', async () => {
            console.log(`[Auth] Initializing Task ${taskId} status to 'processing'...`);
            await automationService.updateTaskStatus('processing').catch(err => {
                console.error(`[Auth] Failed to reset task status: ${err.message}`);
            });
        });

        // 2. Initial Authentication Setup
        await injectTokensAndReload(page, baseUrl);

        // 3. Detect & Handle Expired Session
        await test.step('Validate & Handle Session State', async () => {
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
                console.log(`[Auth] Session expired or invalid. Performing automated login...`);
                await test.step('Unified Login Flow', async () => {
                    await performFullLogin(page, automationService);
                });

                // Sync and re-inject fresh tokens
                config.refresh();
                console.log(`[Auth] Login successful. Re-injecting fresh session tokens...`);
                await injectTokensAndReload(page, baseUrl);
            }
        });

        // 4. Attach Global Session Watchers
        await test.step('Attach Global Session Watchers', async () => {
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

            // Clean up interval on context close
            page.on('close', () => clearInterval(sessionInterval));
        });

        try {
            await use(page);
        } finally {
            await context.close();
        }
    },
});
