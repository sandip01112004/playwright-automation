import { Page, Locator, expect } from '@playwright/test';

export class ShipmentFormPage {
    readonly page: Page;
    readonly uploadInput: Locator;
    readonly invoiceNumberInput: Locator;
    readonly invoiceDateInput: Locator;
    readonly invoiceAmountInput: Locator;
    readonly invoicingInstructionsLink: Locator;
    readonly invoicingInstructionsCheckbox: Locator;
    readonly invoiceDetailsAccordion: Locator;
    readonly supportedDocumentsAccordion: Locator;
    readonly deliveryDetailsUploadInput: Locator;

    constructor(page: Page) {
        this.page = page;
        this.uploadInput = page.locator("//input[@class='custom-file-input']");
        this.invoiceNumberInput = page.locator('input[formcontrolname="invNum"]');
        this.invoiceDateInput = page.locator('input[type="date"]');
        this.invoiceAmountInput = page.locator('input[formcontrolname="invAmt"]');
        this.invoicingInstructionsLink = page.locator('a:has-text("Click here to view \\"Invoicing Instructions\\"")');
        this.invoicingInstructionsCheckbox = page.locator('input[formcontrolname="invInst"]');
        this.invoiceDetailsAccordion = page.locator("//*[contains(@id, 'supplierInvoiceDetailsScroll')]//em[contains(@class, 'bi-chevron')]");
        this.supportedDocumentsAccordion = page.locator("//*[contains(@id, 'supportedDocumentDetailsScroll')]//em[contains(@class, 'bi-chevron')]");
        this.deliveryDetailsUploadInput = page.locator('input.custom-file-input1');
    }

    async uploadInvoiceCopy(filePath: string) {
        console.log(`Uploading invoice: ${filePath}`);
        await this.page.waitForURL('**/asn/asnform', { timeout: 15000 }).catch(() => { });
        await this.uploadInput.setInputFiles(filePath);
    }

    async uploadDeliveryDetails(filePath: string) {
        console.log(`Uploading delivery details: ${filePath}`);
        await this.deliveryDetailsUploadInput.setInputFiles(filePath);
    }

    // Fills the rest of the invoice details.
    async fillInvoiceDetails(details: { invoiceNumber: string, date: string, amount: number | string, deliveryDetailsPath?: string }) {
        await this.invoiceNumberInput.fill(details.invoiceNumber);
        await this.invoiceDateInput.fill(details.date);
        await this.invoiceAmountInput.fill(details.amount.toString());

        // Click "Invoicing Instructions" link — opens in a new tab
        const [popup] = await Promise.all([
            this.page.waitForEvent('popup'),
            this.invoicingInstructionsLink.click()
        ]);

        // Wait for it to load, then close and return to main tab
        await popup.waitForLoadState('networkidle');
        await popup.close();

        await this.page.bringToFront();
        await this.invoicingInstructionsCheckbox.check({ force: true });

        // Close the invoice details accordion and enlarge the supported documents accordion
        await this.invoiceDetailsAccordion.scrollIntoViewIfNeeded();
        await this.invoiceDetailsAccordion.click();

        await this.supportedDocumentsAccordion.scrollIntoViewIfNeeded();
        await this.supportedDocumentsAccordion.click();

        // Upload delivery details if path is provided
        if (details.deliveryDetailsPath) {
            await this.uploadDeliveryDetails(details.deliveryDetailsPath);
        }

        console.log('Invoice details filled successfully. Waiting for 5 seconds...');
        await this.page.waitForTimeout(5000);
    }
}
