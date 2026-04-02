import { Page, Locator, expect } from '@playwright/test';

export class ShipmentFormPage {
    readonly page: Page;


    // --- Section 1: Supplier Invoice Details ---
    readonly uploadInput: Locator;
    readonly invoiceNumberInput: Locator;
    readonly invoiceDateInput: Locator;
    readonly invoiceAmountInput: Locator;
    readonly paymentInvoiceCheckbox: Locator;
    readonly invoicingInstructionsLink: Locator;
    readonly invoicingInstructionsCheckbox: Locator;
    readonly invoiceDetailsAccordion: Locator;

    // --- Section 2: Supporting Document Details ---
    readonly supportedDocumentsAccordion: Locator;
    readonly deliveryDetailsUploadInput: Locator;
    readonly documentTypeDropdown: Locator;

    // --- Section 3: Item Details ---
    readonly itemDetailsAccordion: Locator;
    readonly offeredQtyInput: Locator;
    readonly addItemsButton: Locator;
    readonly selectAllCheckbox: Locator;
    readonly doneButton: Locator;
    readonly addItemCard: Locator;
    readonly firstItemCheckbox: Locator;

    // --- Section 4: Transport Details ---
    readonly transportDetailsAccordion: Locator;
    readonly transportModeDropdown: Locator;
    readonly transporterNameInput: Locator;
    readonly arrivalDateInput: Locator;
    readonly sameAsInvoiceCheckbox: Locator;

    constructor(page: Page) {
        this.page = page;


        // --- Section 1: Supplier Invoice Details ---
        this.uploadInput = page.locator("//input[@class='custom-file-input']");
        this.invoiceNumberInput = page.locator('input[formcontrolname="invNum"]');
        this.invoiceDateInput = page.locator('input[type="date"]');
        this.invoiceAmountInput = page.locator('input[formcontrolname="invAmt"]');
        this.paymentInvoiceCheckbox = page.locator('input[formcontrolname="paymInv"]');
        this.invoicingInstructionsLink = page.locator('a:has-text("Click here to view \\"Invoicing Instructions\\"")');
        this.invoicingInstructionsCheckbox = page.locator('input[formcontrolname="invInst"]');
        this.invoiceDetailsAccordion = page.locator("//*[contains(@id, 'supplierInvoiceDetailsScroll')]//em[contains(@class, 'bi-chevron')]");

        // --- Section 2: Supporting Document Details ---
        this.supportedDocumentsAccordion = page.locator("//*[contains(@id, 'supportedDocumentDetailsScroll')]//em[contains(@class, 'bi-chevron')]");
        this.deliveryDetailsUploadInput = page.locator("//input[@class='custom-file-input1']");
        this.documentTypeDropdown = page.locator('select[formcontrolname="documentType"]');

        // --- Section 3: Item Details ---
        this.itemDetailsAccordion = page.locator("//*[contains(@id, 'itemDetailsScroll')]//em[contains(@class, 'bi-chevron')]");
        this.offeredQtyInput = page.locator('input[formcontrolname="offeredQty"]');
        this.addItemsButton = page.getByRole('button', { name: 'Add Items' });
        this.selectAllCheckbox = page.getByLabel('Select All', { exact: true });
        this.doneButton = page.getByText('Done', { exact: true });
        this.addItemCard = page.locator(".custom-card.pointer.pe-4.ng-star-inserted");
        this.firstItemCheckbox = page.locator('input.rt-pos').first();

        // --- Section 4: Transport Details ---
        this.transportDetailsAccordion = page.locator("//accordian[@id='transportDetailsScroll']//em[contains(@class, 'bi-chevron')]");
        this.transportModeDropdown = page.locator("div[class='dropdown__btn'] span");
        this.transporterNameInput = page.locator('input[formcontrolname="transporterName"]');
        this.arrivalDateInput = page.locator("//date[@formcontrolname='arrivalDt']//input[@placeholder='All Time']");
        this.sameAsInvoiceCheckbox = page.getByLabel('Same as Invoice No. and Invoice Date');
    }


    //--- Section 1: Supplier Invoice ---

    async fillSupplierInvoiceSection(filePath: string, invoiceNumber: string, date: string, amount: number | string) {
        // Initial upload
        await this.page.waitForURL('**/asn/asnform', { timeout: 15000 }).catch(() => { });
        await this.uploadInput.waitFor({ state: 'attached', timeout: 30000 });
        await this.uploadInput.setInputFiles(filePath);

        // Dispatch events to ensure UI/framework detects the change
        await this.uploadInput.dispatchEvent('change');
        await this.uploadInput.dispatchEvent('input');


        // Fill fields
        await this.invoiceNumberInput.scrollIntoViewIfNeeded();
        await this.invoiceNumberInput.waitFor({ state: 'visible', timeout: 45000 });
        await this.invoiceNumberInput.fill(invoiceNumber);
        await this.invoiceDateInput.fill(date);
        await this.invoiceAmountInput.fill(amount.toString());

        if (await this.paymentInvoiceCheckbox.isVisible()) {
            await this.paymentInvoiceCheckbox.check();
        }

        const [popup] = await Promise.all([
            this.page.waitForEvent('popup'),
            this.invoicingInstructionsLink.click()
        ]);
        await popup.waitForLoadState('networkidle');
        await popup.close();

        await this.page.bringToFront();
        await this.invoicingInstructionsCheckbox.check();

        // Close Section
        await this.invoiceDetailsAccordion.click();
    }

    // --- Section 2: Supporting Documents ---
    async fillSupportingDocumentsSection(deliveryDetailsPath?: string) {
        await this.supportedDocumentsAccordion.click();

        if (deliveryDetailsPath) {
            await this.deliveryDetailsUploadInput.setInputFiles(deliveryDetailsPath);
            await this.deliveryDetailsUploadInput.dispatchEvent('change');
            await this.deliveryDetailsUploadInput.dispatchEvent('input');
            await this.documentTypeDropdown.selectOption('OTHERS');
        }

        // Close Section
        await this.supportedDocumentsAccordion.click();
    }


    //--- Section 3: Item Details ---
    async fillItemDetailsSection(quantityMt?: number | string) {
        await this.itemDetailsAccordion.click();

        await this.addItemsButton.click();
        await this.addItemCard.first().waitFor({ state: 'visible' });
        await this.selectAllCheckbox.waitFor({ state: 'visible' });
        await this.selectAllCheckbox.check();

        await this.firstItemCheckbox.waitFor({ state: 'visible' });
        await expect(this.firstItemCheckbox).toBeChecked();

        await this.doneButton.click();

        if (quantityMt !== undefined) {
            const qty = Number(quantityMt);
            await this.offeredQtyInput.waitFor({ state: 'visible' });
            await this.offeredQtyInput.fill(qty.toString());
        }

        // Close Section
        await this.itemDetailsAccordion.click();
    }

    //--- Section 4: Transportation Details ---
    async fillTransportationSection(transporterName: string = 'Bfcsupply') {
        await this.transportDetailsAccordion.click();

        await this.transportModeDropdown.scrollIntoViewIfNeeded();
        await this.transportModeDropdown.click();

        const roadOption = this.page.locator('span:has-text("Road"), .dropdown-item:has-text("Road"), .dropdown__btn span:has-text("Road")').first();
        await roadOption.waitFor({ state: 'visible', timeout: 5000 }).catch(() => { });
        await roadOption.click({ force: true });

        await this.transporterNameInput.fill(transporterName);

        const today = new Date().toISOString().split('T')[0] ?? '';
        await this.arrivalDateInput.fill(today);

        await this.sameAsInvoiceCheckbox.waitFor({ state: 'visible', timeout: 10000 });
        await this.sameAsInvoiceCheckbox.check();
    }


    //-- Orchestrates the completion of all 4 form sections.

    async completeShipmentForm(details: {
        invoicePath: string,
        invoiceNumber: string,
        date: string,
        amount: number | string,
        deliveryDetailsPath?: string,
        quantityMt?: number | string,
        transporterName?: string
    }) {
        await this.fillSupplierInvoiceSection(details.invoicePath, details.invoiceNumber, details.date, details.amount);
        await this.fillSupportingDocumentsSection(details.deliveryDetailsPath);
        await this.fillItemDetailsSection(details.quantityMt);
        await this.fillTransportationSection(details.transporterName);
    }
}
