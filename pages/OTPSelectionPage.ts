import type { Page, Locator } from '@playwright/test';

export class OTPSelectionPage {
    readonly page: Page;
    readonly continueButton: Locator;

    constructor(page: Page) {
        this.page = page;
        this.continueButton = page.getByRole('button', { name: 'Continue' });
    }

    async selectChannel(text: string) {
        await this.page.getByText(text, { exact: true }).click();
        await this.continueButton.click();
    }
}