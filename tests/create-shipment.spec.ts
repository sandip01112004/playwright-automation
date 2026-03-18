import { test, expect } from '../fixtures/auth.fixture';
import { ExternalApiService } from '../utils/external-api';
import * as readlineSync from 'readline-sync';

function promptOrderNo(): string {
    return readlineSync.question('\nEnter Order Number to Search: ').trim();
}

test.beforeEach(async ({ dashboardPage }) => {
    await dashboardPage.handlePostLoginSetup();
});

interface InvoiceData {
    invoiceNumber: string;
    date: string;
    amount: number | string;
    url: string;
}

test('Full Shipment Creation: API Data + UI Automation', async ({ dashboardPage, shipmentFormPage }) => {
    const apiService = new ExternalApiService();
    const testDeliveryId = process.env.DELIVERY_ID!;
    console.log(`\n--- Starting Automation | DeliveryID: ${testDeliveryId} ---`);

    let invoiceData: InvoiceData;
    let downloadedFilePath: string;

    await test.step('Step 1: Find Order by Order ID', async () => {
        const orderNo = promptOrderNo();
        await dashboardPage.navigateToOrdersInProcess();
        await dashboardPage.performSearch(orderNo);
    });

    await test.step('Step 2: Create Shipment and Complete Form', async () => {
        await dashboardPage.openShipmentMenu();
        await dashboardPage.selectCreateShipment();

        // Fetch data and download files after the click
        console.log('Fetching API data and downloading files...');
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

        await shipmentFormPage.uploadInvoiceCopy(invoicePath);
        await shipmentFormPage.fillInvoiceDetails({
            invoiceNumber: invoiceData.invoiceNumber,
            date: invoiceData.date,
            amount: invoiceData.amount,
            deliveryDetailsPath: deliveryPath
        });
    });

    console.log('\n--- Automation completed successfully ✓ ---');
});
