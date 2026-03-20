import { test, expect } from '../fixtures/auth.fixture';
import { ExternalApiService } from '../utils/external-api';
import { DashboardPage } from '../pages/DashboardPage';
import { ShipmentFormPage } from '../pages/ShipmentFormPage';
import * as readlineSync from 'readline-sync';
import * as fs from 'fs';
import * as path from 'path';

function promptOrderNo(): string {
    return readlineSync.question('\nEnter Order Number to Search: ').trim();
}

function promptDeliveryId(): string {
    return readlineSync.question('Enter Delivery ID to call APIs: ').trim();
}

test.beforeEach(async ({ page }) => {
    const dashboardPage = new DashboardPage(page);
    await dashboardPage.handlePostLoginSetup();
});

interface InvoiceData {
    invoiceNumber: string;
    date: string;
    amount: number | string;
    url: string;
}

test('Full Shipment Creation: API Data + UI Automation', async ({ page }) => {
    const dashboardPage = new DashboardPage(page);
    const shipmentFormPage = new ShipmentFormPage(page);
    const apiService = new ExternalApiService();

    let invoiceData: InvoiceData;
    let downloadedFilePath: string;

    // Clear docs folder to ensure we're using fresh files
    const docsDir = path.resolve(process.cwd(), 'docs');
    if (fs.existsSync(docsDir)) {
        fs.readdirSync(docsDir).forEach(file => fs.unlinkSync(path.join(docsDir, file)));
    }

    await test.step('Step 1: Find Order by Order ID', async () => {
        await dashboardPage.navigateToOrdersInProcess();
        const orderNo = promptOrderNo();
        await dashboardPage.performSearch(orderNo);
    });

    await test.step('Step 2: Create Shipment and Complete Form', async () => {
        await dashboardPage.openShipmentMenu();
        await dashboardPage.selectCreateShipment();

        // Fetch data and download files after the click
        const testDeliveryId = promptDeliveryId();
        let deliveryData;
        try {
            [invoiceData, deliveryData] = await Promise.all([
                apiService.getInvoiceDetails(testDeliveryId),
                apiService.getDeliveryDetails(testDeliveryId)
            ]);
        } catch (error) {
            console.error('Failed to fetch API data:', error instanceof Error ? error.message : error);
            test.skip(true, 'External API unavailable');
            return;
        }

        const invoiceFileName = new URL(invoiceData.url).pathname.split('/').pop() || 'invoice.pdf';
        const deliveryFileName = deliveryData.displayFileName || (new URL(deliveryData.url).pathname.split('/').pop()) || 'delivery.pdf';

        const [invoicePath, deliveryPath] = await Promise.all([
            apiService.downloadFile(invoiceData.url, invoiceFileName),
            apiService.downloadFile(deliveryData.url, deliveryFileName)
        ]);

        await shipmentFormPage.completeShipmentForm({
            invoicePath: invoicePath,
            invoiceNumber: invoiceData.invoiceNumber,
            date: invoiceData.date,
            amount: invoiceData.amount,
            deliveryDetailsPath: deliveryPath,
            quantityMt: deliveryData.quantityMt
        });
    });

    console.log('\n--- Automation completed successfully ✓ ---');
});
