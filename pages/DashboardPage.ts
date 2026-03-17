import { Page, Locator, expect } from '@playwright/test';

export class DashboardPage {
    readonly page: Page;
    readonly closePopupButton: Locator;
    readonly shipmentText: Locator;
    readonly ordersTab: Locator;
    readonly ordersInProcessButton: Locator;
    readonly searchInput: Locator;
    readonly createShipmentOption: Locator;

    constructor(page: Page) {
        this.page = page;
        this.closePopupButton = page.locator("//em[@class='bi bi-x']");
        this.shipmentText = page.getByText('Shipment', { exact: true });
        this.ordersTab = page.getByText('Orders', { exact: true });
        this.ordersInProcessButton = page.getByRole('button', { name: /Orders In Process/i });
        this.searchInput = page.getByPlaceholder(/Search by Order Number, ARC No\./i);
        this.createShipmentOption = page.locator('.popover-body').getByText('Create Shipment');
    }

    async handlePostLoginSetup() {
        console.log('Waiting for dashboard to fully load...');

        // Step 1: Wait for HTML to load
        await this.page.waitForLoadState('load');

        // Step 2: Wait for all API/data calls to finish (production-style smart wait)
        await this.page.waitForLoadState('networkidle');

        console.log('Dashboard loaded. Handling popups...');

        // Popup 1 — longer timeout since page content loads slowly
        try {
            const popup = this.closePopupButton.first();
            await popup.waitFor({ state: 'visible' });
            await popup.click();
            await popup.waitFor({ state: 'hidden' });
            console.log('First popup closed.');
        } catch (e) {
            console.log('First popup not found or already closed');
        }

        // Popup 2
        try {
            const popup = this.closePopupButton.first();
            await popup.waitFor({ state: 'visible' });
            await popup.click();
            await popup.waitFor({ state: 'hidden' });
            console.log('Second popup closed.');
        } catch (e) {
            console.log('Second popup not found or already closed');
        }

        // Wait until the dashboard URL is reached
        await this.page.waitForURL('https://supplierfirst.ril.com/homepage/dashboard/orders/new-orders');
        console.log('Dashboard ready ✓');
    }

    async searchForOrder(orderNo: string) {
        const trimmedOrderNo = orderNo.trim();
        // Click on the Orders tab
        console.log('Clicking on Orders tab...');
        await this.ordersTab.waitFor({ state: 'visible' });
        await this.ordersTab.click({ force: true });

        // Click on "Orders In Process" button
        console.log('Clicking on "Orders In Process" button...');
        await this.ordersInProcessButton.waitFor({ state: 'attached' });
        await this.ordersInProcessButton.waitFor({ state: 'visible' });
        await this.ordersInProcessButton.click();

        // Wait for the page to be ready for search
        await expect(this.shipmentText).toBeVisible();

        // Perform search
        await this.searchInput.clear();
        await this.searchInput.fill(trimmedOrderNo);

        // Press Enter 
        console.log(`Pressing Enter to search for Order: ${trimmedOrderNo}...`);
        await this.searchInput.press('Enter');

        // Wait for search results and sorting
        console.log('Waiting for search results to stabilize (5 seconds)...');
        await this.page.waitForLoadState('networkidle');

        // Verify exactly one order-card is visible
        console.log('Verifying order-card count...');
        const orderCards = this.page.locator('order-card:visible');
        const count = await orderCards.count();

        if (count === 1) {
            console.log('Successfully found exactly one visible order-card.');
        } else {
            console.error(`ERROR: Expected 1 visible order-card, but found ${count}.`);
            if (count === 0) {
                const isNoData = await this.page.getByText('No Data Found...', { exact: false }).isVisible();
                if (isNoData) console.log('Site explicitly shows "No Data Found...".');
            }
            throw new Error(`Order search failed: expected 1 result, found ${count}.`);
        }
    }

    async openShipmentMenu() {
        console.log('Opening shipment menu from order-card...');
        const menuIcon = this.page.locator('order-card:visible').locator('em.bi.bi-three-dots.pointer.secondary-font').first();

        await expect(menuIcon).toBeVisible();
        await menuIcon.click();
        console.log('Successfully clicked the menu dots.');
    }

    async selectCreateShipment() {
        // Scope to visible popover to avoid strict mode errors with multiple rows
        const visibleOption = this.createShipmentOption.filter({ visible: true });
        await expect(visibleOption).toBeVisible();
        await visibleOption.hover();
        await visibleOption.click();
        console.log('Clicked "Create Shipment" successfully.');
    }
}
