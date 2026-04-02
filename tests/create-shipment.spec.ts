import { test, expect } from '../fixtures/auth.fixture';
import { ExternalApiService } from '../utils/external-api';
import { DashboardPage } from '../pages/DashboardPage';
import { ShipmentFormPage } from '../pages/ShipmentFormPage';
import { AutomationService } from '../utils/AutomationService';
import * as fs from 'fs';
import * as path from 'path';

test('Full Shipment Creation: API Data + UI Automation', async ({ page }) => {
    const taskId = Number(process.env.TASK_ID) || 1; // Default to task ID 1 as requested
    const automationService = new AutomationService(taskId);

    const dashboardPage = new DashboardPage(page);
    const shipmentFormPage = new ShipmentFormPage(page);
    const apiService = new ExternalApiService();


    try {

        // Clear docs folder to ensure we're using fresh files
        const docsDir = path.resolve(process.cwd(), 'data/docs');
        if (fs.existsSync(docsDir)) {
            fs.readdirSync(docsDir).forEach(file => fs.unlinkSync(path.join(docsDir, file)));
        }

        // Handle Post-Login Setup
        await dashboardPage.handlePostLoginSetup();

        await test.step('Step 1: Find Order by Order ID', async () => {
            await dashboardPage.navigateToOrdersInProcess();

            // PRIORITY: Use order_id directly from the trigger payload (Correction per user)
            const orderId = automationService.payload?.order_id;

            if (!orderId) {
                throw new Error('Missing "order_id" in trigger payload. Please provide it to start searching.');
            }

            console.log(`[Automation] Searching for Order ID: ${orderId}`);
            await dashboardPage.performSearch(orderId.toString());
        });

        await test.step('Step 2: Create Shipment and Complete Form', async () => {
            await dashboardPage.openShipmentMenu();
            await dashboardPage.selectCreateShipment();

            // PRIORITY: Use the trigger payload directly (fresh from POST request)
            // Note: We removed getTask() refresh here because it might overwrite fresh trigger URLs with stale backend data.
            const payload = automationService.payload;
            if (!payload?.invoice || !payload?.delivery) {
                throw new Error('Invoice or Delivery data missing in trigger payload.');
            }


            const deliveryMedia = payload.delivery.delivery_media?.[0];
            if (!deliveryMedia) {
                throw new Error('No delivery media found in payload.');
            }


            const invoiceUrl = payload.invoice.presigned_url;
            const invoiceNumber = payload.invoice.invoice_number;
            const invoiceAmount = payload.invoice.total_amount;
            const invoiceDate = payload.invoice.created_at.split('T')[0];

            const deliveryUrl = deliveryMedia.presigned_url;
            const getFileNameWithExtension = (url: string, defaultExt: string = '.pdf') => {
                const pathname = new URL(url).pathname;
                const fileName = pathname.split('/').pop() || 'document';
                const hasExtension = /\.[a-zA-Z0-9]+$/.test(fileName);
                return hasExtension ? fileName : `${fileName}${defaultExt}`;
            };

            const invoiceFileName = getFileNameWithExtension(invoiceUrl);
            const deliveryFileName = getFileNameWithExtension(deliveryUrl);

            const quantityKg = parseFloat(payload.delivery.quantity);
            const quantityMt = quantityKg / 1000;

            const [invoicePath, deliveryPath] = await Promise.all([
                apiService.downloadFile(invoiceUrl, invoiceFileName),
                apiService.downloadFile(deliveryUrl, deliveryFileName)
            ]);

            await shipmentFormPage.completeShipmentForm({
                invoicePath: invoicePath,
                invoiceNumber: invoiceNumber,
                date: invoiceDate,
                amount: invoiceAmount,
                deliveryDetailsPath: deliveryPath,
                quantityMt: quantityMt
            });
        });

        // Step 3: Report Completion
        await automationService.updateTaskStatus(1299); // completed
        console.log('\n--- Automation completed successfully ✓ ---');

    } catch (err: any) {
        console.error(`\n--- Automation Failed: ${err.message} ---`);
        // Report Failure to your API
        await automationService.updateTaskStatus(1300, { error_message: err.message });
        throw err; // Ensure Playwright marks the test as failed
    }
});
