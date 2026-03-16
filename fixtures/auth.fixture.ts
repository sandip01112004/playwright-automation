import { test as base, Page, expect } from '@playwright/test';
export { expect };
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../.env') });

export const test = base.extend({
    page: async ({ browser }, use) => {

        if (!process.env.AUTH_TOKEN ||
            !process.env.REFRESH_TOKEN ||
            !process.env.DOMAIN_NAME) {
            throw new Error('Required auth environment variables (AUTH_TOKEN, REFRESH_TOKEN, DOMAIN_NAME) are missing');
        }

        const tokenExpiry = process.env.TOKEN_EXPIRY || '0'; // Default to '0' if missing

        const context = await browser.newContext();
        const page = await context.newPage();
        const baseUrl = `https://${process.env.DOMAIN_NAME}`;

        // Use addInitScript to automatically run on every new page navigation
        await page.addInitScript(() => {
            window.addEventListener('DOMContentLoaded', () => {
                document.body.style.zoom = "70%";
            });
        });

        // Step 1: Navigate to the site (storage is domain-specific)
        await page.goto(baseUrl);
        await page.waitForLoadState('domcontentloaded');

        // Step 2: Inject tokens into BOTH localStorage and sessionStorage
        await page.evaluate(({ authToken, refreshToken, tokenExpiry }) => {
            // localStorage
            localStorage.setItem('tokenValue', authToken);
            localStorage.setItem('authTokenExpiry', tokenExpiry);
            localStorage.setItem('user_info', JSON.stringify({
                token: authToken,
                refreshToken: refreshToken,
            }));

            // sessionStorage
            sessionStorage.setItem('tokenValue', authToken);
        }, {
            authToken: process.env.AUTH_TOKEN!,
            refreshToken: process.env.REFRESH_TOKEN!,
            tokenExpiry: tokenExpiry
        });

        // Step 3: Reload — app reads tokens and treats you as logged in
        await page.reload();
        await page.waitForLoadState('networkidle');

        // Apply zoom immediately in the current page in case it's already loaded
        await page.evaluate(() => {
            if (document.body) {
                document.body.style.zoom = "70%";
            }
        });

        await use(page);

        // Cleanup context after test
        await context.close();
    },
});

