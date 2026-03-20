import { Page, Locator, expect } from '@playwright/test';

export class ShipmentFormPage {
    readonly page: Page;
    readonly uploadInput: Locator;
    readonly invoiceNumberInput: Locator;
    readonly invoiceDateInput: Locator;
    readonly invoiceAmountInput: Locator;
    readonly paymentInvoiceCheckbox: Locator;
    readonly invoicingInstructionsLink: Locator;
    readonly invoicingInstructionsCheckbox: Locator;
    readonly invoiceDetailsAccordion: Locator;
    readonly supportedDocumentsAccordion: Locator;
    readonly deliveryDetailsUploadInput: Locator;
    readonly documentTypeDropdown: Locator;
    readonly itemDetailsAccordion: Locator;
    readonly offeredQtyInput: Locator;
    readonly addItemsButton: Locator;
    readonly selectAllCheckbox: Locator;
    readonly doneButton: Locator;
    readonly addItemCard: Locator;
    readonly firstItemCheckbox: Locator;
    readonly transportDetailsAccordion: Locator;
    readonly transportModeDropdown: Locator;
    readonly transporterNameInput: Locator;
    readonly arrivalDateInput: Locator;
    readonly sameAsInvoiceCheckbox: Locator;

    constructor(page: Page) {
        this.page = page;
        this.uploadInput = page.locator("//input[@class='custom-file-input']");
        this.invoiceNumberInput = page.locator('input[formcontrolname="invNum"]');
        this.invoiceDateInput = page.locator('input[type="date"]');
        this.invoiceAmountInput = page.locator('input[formcontrolname="invAmt"]');
        this.paymentInvoiceCheckbox = page.locator('input[formcontrolname="paymInv"]');
        this.invoicingInstructionsLink = page.locator('a:has-text("Click here to view \\"Invoicing Instructions\\"")');
        this.invoicingInstructionsCheckbox = page.locator('input[formcontrolname="invInst"]');
        this.invoiceDetailsAccordion = page.locator("//*[contains(@id, 'supplierInvoiceDetailsScroll')]//em[contains(@class, 'bi-chevron')]");
        this.supportedDocumentsAccordion = page.locator("//*[contains(@id, 'supportedDocumentDetailsScroll')]//em[contains(@class, 'bi-chevron')]");
        this.deliveryDetailsUploadInput = page.locator("//input[@class='custom-file-input1']");
        this.documentTypeDropdown = page.locator('select[formcontrolname="documentType"]');
        this.itemDetailsAccordion = page.locator("//*[contains(@id, 'itemDetailsScroll')]//em[contains(@class, 'bi-chevron')]");
        this.offeredQtyInput = page.locator('input[formcontrolname="offeredQty"]');
        this.addItemsButton = page.getByRole('button', { name: 'Add Items' });
        this.selectAllCheckbox = page.getByLabel('Select All', { exact: true });
        this.doneButton = page.getByText('Done', { exact: true });
        this.addItemCard = page.locator(".custom-card.pointer.pe-4.ng-star-inserted");
        this.firstItemCheckbox = page.locator('input.rt-pos').first();
        this.transportDetailsAccordion = page.locator("//accordian[@id='transportDetailsScroll']//em[contains(@class, 'bi-chevron')]");
        this.transportModeDropdown = page.locator("div[class='dropdown__btn'] span");
        this.transporterNameInput = page.locator('input[formcontrolname="transporterName"]');
        this.arrivalDateInput = page.locator("//date[@formcontrolname='arrivalDt']//input[@placeholder='All Time']");
        this.sameAsInvoiceCheckbox = page.getByLabel('Same as Invoice No. and Invoice Date');
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
    async fillInvoiceDetails(details: {
        invoiceNumber: string,
        date: string,
        amount: number | string,
        deliveryDetailsPath?: string,
        quantityMt?: number | string
    }) {
        // Verify that the invoice number field is visible before filling it.
        // This confirms the file upload completed and the form is ready.
        // Wait for the invoice number field to be visible after upload
        // This confirms the upload was successful and form is interactive
        await this.invoiceNumberInput.scrollIntoViewIfNeeded();
        await this.invoiceNumberInput.waitFor({ state: 'visible', timeout: 45000 });

        // Small additional wait to ensure the field is truly ready for input
        await this.page.waitForTimeout(1000);

        await this.invoiceNumberInput.click();
        await this.invoiceNumberInput.fill(details.invoiceNumber);
        await this.invoiceDateInput.fill(details.date);
        await this.invoiceAmountInput.fill(details.amount.toString());

        // Check "Submitting payment invoice..." if available
        if (await this.paymentInvoiceCheckbox.isVisible()) {
            await this.paymentInvoiceCheckbox.check();
        }

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
            // Select "Others" from document type dropdown
            await this.documentTypeDropdown.selectOption('OTHERS');
        }

        // Close Supported Document Details and open Item Details
        await this.supportedDocumentsAccordion.scrollIntoViewIfNeeded();
        await this.supportedDocumentsAccordion.click();

        await this.itemDetailsAccordion.scrollIntoViewIfNeeded();
        await this.itemDetailsAccordion.click();

        // Add Items flow
        await this.addItemsButton.click();

        await this.addItemCard.first().waitFor({ state: 'visible' });

        await this.selectAllCheckbox.waitFor({ state: 'visible' });
        await this.selectAllCheckbox.check();

        // Verify first item card checkbox is checked
        await this.firstItemCheckbox.waitFor({ state: 'visible' });
        await expect(this.firstItemCheckbox).toBeChecked();

        await this.doneButton.click();

        // Fill offered quantity if provided (must be integer as per user request)
        if (details.quantityMt !== undefined) {
            const intQty = Math.round(Number(details.quantityMt));
            await this.offeredQtyInput.waitFor({ state: 'visible' });
            await this.offeredQtyInput.fill(intQty.toString());
        }

        // Close Item Details accordion
        await this.itemDetailsAccordion.scrollIntoViewIfNeeded();
        await this.itemDetailsAccordion.click();

        // Open Transport Details accordion
        await this.transportDetailsAccordion.scrollIntoViewIfNeeded();
        await this.transportDetailsAccordion.click();
    }

    async fillTransportDetails(transporterName: string = 'Bfcsupply') {
        // Select "Road" from dropdown
        await this.transportModeDropdown.scrollIntoViewIfNeeded();
        await this.transportModeDropdown.click();

        // Wait for the dropdown expansion and click 'Road'
        // Using a more flexible locator to handle potential variations in the dropdown structure
        const roadOption = this.page.locator('span:has-text("Road"), .dropdown-item:has-text("Road"), .dropdown__btn span:has-text("Road")').first();
        await roadOption.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {
            console.warn('Road option not visible, trying to click by text directly...');
        });
        await roadOption.click({ force: true });

        // Fill transporter name
        await this.transporterNameInput.fill(transporterName);

        // Fill today's date
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        await this.arrivalDateInput.fill(today);

        // Check "Same as Invoice No. and Invoice Date"
        // Wait for it to be visible and add a small buffer for the state to settle
        await this.sameAsInvoiceCheckbox.waitFor({ state: 'visible', timeout: 10000 });
        await this.page.waitForTimeout(2000);

        // Use force check as it might be 'disabled' in the DOM but clickable in reality or vice versa
        await this.sameAsInvoiceCheckbox.check();
    }
}
