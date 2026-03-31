import { test, expect } from '../fixtures/auth.fixture';
import { ExternalApiService } from '../utils/external-api';
import { DashboardPage } from '../pages/DashboardPage';
import { ShipmentFormPage } from '../pages/ShipmentFormPage';
import { WebsiteAApi } from '../utils/website-a-api';
import * as fs from 'fs';
import * as path from 'path';

test('Full Shipment Creation: API Data + UI Automation', async ({ page }) => {
    const taskId = Number(process.env.TASK_ID) || 1; // Default to task ID 1 as requested
    const websiteA = new WebsiteAApi(taskId);

    const dashboardPage = new DashboardPage(page);
    const shipmentFormPage = new ShipmentFormPage(page);
    const apiService = new ExternalApiService();

    let invoiceData: any;

    try {
        // Step 0: Report Processing
        await websiteA.updateTaskStatus('1296'); // processing

        // Clear docs folder to ensure we're using fresh files
        const docsDir = path.resolve(process.cwd(), 'docs');
        if (fs.existsSync(docsDir)) {
            fs.readdirSync(docsDir).forEach(file => fs.unlinkSync(path.join(docsDir, file)));
        }

        // Handle Post-Login Setup
        await dashboardPage.handlePostLoginSetup();

        await test.step('Step 1: Find Order by Order ID', async () => {
            await dashboardPage.navigateToOrdersInProcess();
            // Polling for ORDER_NUMBER from your dashboard/API
            const orderNo = await websiteA.waitForInput('order_number');
            await dashboardPage.performSearch(orderNo);
        });

        await test.step('Step 2: Create Shipment and Complete Form', async () => {
            await dashboardPage.openShipmentMenu();
            await dashboardPage.selectCreateShipment();

            // Polling for DELIVERY_ID from your dashboard/API
            const testDeliveryId = await websiteA.waitForInput('delivery_id');

            let deliveryData;
            try {
                [invoiceData, deliveryData] = await Promise.all([
                    apiService.getInvoiceDetails(testDeliveryId),
                    apiService.getDeliveryDetails(testDeliveryId)
                ]);
            } catch (error) {
                console.error('Failed to fetch API data:', error instanceof Error ? error.message : error);
                throw new Error(`External API unavailable for Delivery ID: ${testDeliveryId}`);
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

        // Step 3: Report Completion
        await websiteA.updateTaskStatus('1299'); // completed
        console.log('\n--- Automation completed successfully ✓ ---');

    } catch (err: any) {
        console.error(`\n--- Automation Failed: ${err.message} ---`);
        // Report Failure to your API
        await websiteA.updateTaskStatus('1300', { error_message: err.message });
        throw err; // Ensure Playwright marks the test as failed
    }
});
