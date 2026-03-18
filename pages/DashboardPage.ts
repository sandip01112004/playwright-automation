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

    async handlePostLoginSetup() {
        await this.page.waitForLoadState('load');
        await this.page.waitForLoadState('networkidle');

        // Dismiss up to 2 popups
        for (let i = 0; i < 2; i++) {
            try {
                const popup = this.closePopupButton.first();
                await popup.waitFor({ state: 'visible' });
                await popup.click();
                await popup.waitFor({ state: 'hidden' });
            } catch {
                break;
            }
        }

        await this.page.waitForURL('https://supplierfirst.ril.com/homepage/dashboard/orders/new-orders');
        console.log('Dashboard ready ✓');
    }

    async navigateToOrdersInProcess() {
        await this.ordersTab.waitFor({ state: 'visible' });
        await this.ordersTab.click();

        await this.ordersInProcessButton.scrollIntoViewIfNeeded();
        await this.ordersInProcessButton.waitFor({ state: 'visible' });
        await this.ordersInProcessButton.click();

        console.log('Orders In Process view ready ✓');
    }

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
            console.log(`Order "${trimmedOrderNo}" found ✓`);
        } else {
            if (count === 0) {
                const isNoData = await this.page.getByText('No Data Found...', { exact: false }).isVisible();
                if (isNoData) console.error('Site shows "No Data Found..." for the given order.');
            }
            throw new Error(`Order search failed: expected 1 result, found ${count}.`);
        }
    }

    async openShipmentMenu() {
        const menuIcon = this.menuIcon.first();
        await expect(menuIcon).toBeVisible();
        await menuIcon.click();
    }

    async selectCreateShipment() {
        const visibleOption = this.createShipmentOption.filter({ visible: true });
        await visibleOption.hover();

        await Promise.all([
            this.page.waitForURL('**/asn/asnform'),
            visibleOption.click()
        ]);

        console.log('Navigated to ASN Form ✓');
    }
}
