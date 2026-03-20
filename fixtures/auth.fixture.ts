import { test as base, Page, expect } from '@playwright/test';
export { expect };
import * as dotenv from 'dotenv';
import * as path from 'path';
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

        // Inject zoom on every page navigation via addInitScript
        // await page.addInitScript(() => {
        //     window.addEventListener('DOMContentLoaded', () => {
        //         document.body.style.zoom = "70%";
        //     });
        // });

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

        await use(page);

        await context.close();
    },
});

