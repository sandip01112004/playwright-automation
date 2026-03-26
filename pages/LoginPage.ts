import { Page, Locator } from '@playwright/test';

export class LoginPage {
    readonly page: Page;
    readonly loginIdInput: Locator;
    readonly loginButton: Locator;

    constructor(page: Page) {
        this.page = page;
        this.loginIdInput = page.getByRole('textbox', { name: /Supplier ID/i }).or(page.locator('#loginID'));
        this.loginButton = page.getByRole('button', { name: 'Login' });
    }

    async navigate() {
        await this.page.goto('/user/login');
    }

    async enterLoginId(supportId: string | number) {
        await this.loginIdInput.fill(supportId.toString());
        await this.loginButton.click();
    }
}
