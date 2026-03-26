import { test, expect } from '../fixtures/auth.fixture';
import { ExternalApiService } from '../utils/external-api';
import { DashboardPage } from '../pages/DashboardPage';
import { ShipmentFormPage } from '../pages/ShipmentFormPage';
import * as readlineSync from 'readline-sync';
import * as fs from 'fs';
import * as path from 'path';

const dashboardUrl = process.env.DASHBOARD_URL || 'http://localhost:5000';

async function promptRemote(name: string): Promise<string> {
    const headers = { 'ngrok-skip-browser-warning': 'true' };
    console.log(`\n[SYNC] Requesting ${name} from Remote Dashboard (${dashboardUrl})...`);

    // Notify server we need input
    await fetch(`${dashboardUrl}/request-input/${name}`, { headers }).catch((err) => { 
        console.error(`[SYNC] Failed to notify dashboard of request for ${name}:`, err instanceof Error ? err.message : err);
    });

    // Poll until received
    while (true) {
        try {
            const res = await fetch(`${dashboardUrl}/get-input/${name}`, { headers }).catch(() => null);
            if (res && res.ok) {
                const contentType = res.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                    const data = await res.json();
                    if (data.value) {
                        console.log(`[SYNC] Received ${name}: ${data.value}`);
                        return data.value;
                    }
                } else {
                    const text = await res.text();
                    if (text.includes('<!DOCTYPE')) {
                        console.error(`[SYNC] Error: Received HTML instead of JSON from Dashboard. If using ngrok, ensure you bypass the browser warning.`);
                    }
                }
            }
        } catch (err) {
            console.error(`[SYNC] Polling error:`, err instanceof Error ? err.message : err);
        }
        await new Promise(resolve => setTimeout(resolve, 3000));
    }
}

async function promptOrderNo(): Promise<string> {
    const envVal = process.env.ORDER_NO;
    if (envVal) return envVal.trim();

    if (process.env.RUN_MODE === 'remote') {
        return await promptRemote('ORDER_NO');
    }

    return readlineSync.question('\nEnter Order Number to Search: ').trim();
}

async function promptDeliveryIdRemote(): Promise<string> {
    const envVal = process.env.DELIVERY_ID;
    if (envVal) return envVal.trim();

    if (process.env.RUN_MODE === 'remote') {
        return await promptRemote('DELIVERY_ID');
    }

    return readlineSync.question('Enter Delivery ID to call APIs: ').trim();
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
        const orderNo = await promptOrderNo();
        await dashboardPage.performSearch(orderNo);
    });

    await test.step('Step 2: Create Shipment and Complete Form', async () => {
        await dashboardPage.openShipmentMenu();
        await dashboardPage.selectCreateShipment();

        // Fetch data and download files after the click
        const testDeliveryId = await promptDeliveryIdRemote();
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
