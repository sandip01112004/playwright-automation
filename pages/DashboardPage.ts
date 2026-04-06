import { Page, Locator, expect } from '@playwright/test';

export class DashboardPage {
    readonly page: Page;
    readonly closePopupButton: Locator;
    readonly ordersTab: Locator;
    readonly ordersInProcessButton: Locator;
    readonly searchInput: Locator;
    readonly menuIcon: Locator;
    readonly createShipmentOption: Locator;


    constructor(page: Page) {
        this.page = page;
        this.closePopupButton = page.locator("//em[@class='bi bi-x']");
        this.ordersTab = page.getByText('Orders', { exact: true });
        this.ordersInProcessButton = page.getByRole('button', { name: /Orders In Process/i });
        this.searchInput = page.getByRole('textbox', { name: 'Search by Order Number, ARC No.' });
        this.menuIcon = page.locator('order-card:visible').locator('em.bi.bi-three-dots.pointer.secondary-font');
        this.createShipmentOption = page.locator('.popover-body').getByText('Create Shipment');
    }

    /**
     * Handles post-login setup by waiting for the page to load and dismissing common popups.
     * @param maxPopups - Maximum number of popups to handle (default 1)
     */
    async handlePostLoginSetup(maxPopups: number = 2) {
        await this.page.waitForLoadState('load');
        await this.page.waitForLoadState('networkidle');

        // Dismiss common dashboard popups if they appear
        for (let i = 0; i < maxPopups; i++) {
            try {
                const popup = this.closePopupButton.first();
                // Wait up to 5 seconds for the popup close button to be visible
                await popup.waitFor({ state: 'visible', timeout: 5000 });
                console.log(`Closing dashboard popup ${i + 1}...`);
                await popup.click();
                // Ensure it's hidden before continuing/finishing
                await popup.waitFor({ state: 'hidden', timeout: 3000 });
            } catch (error) {
                // If it doesn't appear or closing fails, we assume no more popups are present
                break;
            }
        }

        console.log(`[Dashboard] Popup handling complete. Current URL: ${this.page.url()}`);

        // Use a more flexible URL wait (regex) to handle variations
        await this.page.waitForURL(/.*\/homepage\/dashboard/, { timeout: 15000 }).catch(() => {
            console.warn(`[Dashboard] URL did not match exactly, but continuing anyway. Current: ${this.page.url()}`);
        });
    }

    /**
     * Navigates to the "Orders In Process" section.
     */
    async navigateToOrdersInProcess() {
        await this.ordersTab.waitFor({ state: 'visible' });
        await this.ordersTab.click();

        await this.ordersInProcessButton.scrollIntoViewIfNeeded();
        await this.ordersInProcessButton.waitFor({ state: 'visible' });
        await this.ordersInProcessButton.click();
    }

    /**
     * Performs a search using an Order Number.
     * @param orderNo - The order number to search for.
     */
    async performSearch(orderNo: string) {
        const trimmedOrderNo = orderNo.trim();
        await this.searchInput.waitFor({ state: 'visible' });
        await this.searchInput.click();
        await this.searchInput.fill('');
        await this.searchInput.fill(trimmedOrderNo);
        await this.page.keyboard.press('Enter');

        await this.page.waitForLoadState('networkidle');

        const orderCards = this.page.locator('order-card:visible');
        const count = await orderCards.count();

        if (count === 1) {
            console.log(`Order "${trimmedOrderNo}" found`);
        } else {
            if (count === 0) {
                const isNoData = await this.page.getByText('No Data Found...', { exact: false }).isVisible();
                if (isNoData) console.error('Site shows "No Data Found..." for the given order.');
            }
            throw new Error(`Order search failed: expected 1 result, found ${count}.`);
        }
    }

    /**
     * Opens the action menu for the first visible order.
     */
    async openShipmentMenu() {
        const menuIcon = this.menuIcon.first();
        await expect(menuIcon).toBeVisible();
        await menuIcon.click();
    }

    /**
     * Selects the "Create Shipment" option from the menu and waits for the form to load.
     */
    async selectCreateShipment() {
        const visibleOption = this.createShipmentOption.filter({ visible: true });
        await visibleOption.hover();

        await Promise.all([
            this.page.waitForURL('**/asn/asnform'),
            visibleOption.click()
        ]);
    }
}
