import { test, expect } from '../fixtures/auth.fixture';
import { FileService } from '../utils/file-service';
import { DashboardPage } from '../pages/DashboardPage';
import { ShipmentFormPage } from '../pages/ShipmentFormPage';
import { AutomationService } from '../utils/automation-service';
import * as fs from 'fs';
import * as path from 'path';

test('Full Shipment Creation: API Data + UI Automation', async ({ page, payload }) => {
    const taskId = payload.task_id;
    console.log(`[Test] Starting Full Shipment Creation for Task ID: ${taskId}`);
    const automationService = new AutomationService(taskId);

    const dashboardPage = new DashboardPage(page);
    const shipmentFormPage = new ShipmentFormPage(page);
    const fileService = new FileService();

    // Create a unique directory for this task's documents
    const taskDocsDir = path.join('data/docs', taskId.toString());
    const absoluteTaskDocsDir = path.resolve(process.cwd(), taskDocsDir);

    try {
        // Handle Post-Login Setup 
        console.log('[Test] Entering handlePostLoginSetup...');
        await dashboardPage.handlePostLoginSetup();
        console.log('[Test] handlePostLoginSetup complete.');

        await test.step('Step 1: Find Order by Order ID', async () => {
            await dashboardPage.navigateToOrdersInProcess();

            // PRIORITY: Use order_id directly from the trigger payload
            const orderId = automationService.payload?.order_id;

            if (!orderId) {
                throw new Error('Missing "order_id" in trigger payload. Please provide it to start searching.');
            }

            console.log(`[Step 1] Searching for Order ID: ${orderId}`);
            await dashboardPage.performSearch(orderId.toString());
        });

        await test.step('Step 2: Create Shipment and Complete Form', async () => {
            console.log('[Step 2] Found Order. Opening Create Shipment menu...');
            await dashboardPage.openShipmentMenu();
            await dashboardPage.selectCreateShipment();

            // PRIORITY: Use the trigger payload directly 
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

            // Safety guard for missing created_at date
            const rawDate = payload.invoice.created_at || new Date().toISOString();
            const invoiceDate = rawDate.split('T')[0];

            const deliveryUrl = deliveryMedia.presigned_url;
            const getFileNameWithExtension = (url: string, defaultExt: string = '.pdf') => {
                const pathname = new URL(url).pathname;
                const fileName = pathname.split('/').pop() || 'document';
                const hasExtension = /\.[a-zA-Z0-9]+$/.test(fileName);
                return hasExtension ? fileName : `${fileName}${defaultExt}`;
            };

            const invoiceFileName = getFileNameWithExtension(invoiceUrl);
            const deliveryFileName = getFileNameWithExtension(deliveryUrl);

            console.log(`[Step 2] Downloading Documents:
   - Invoice: ${invoiceFileName}
   - Delivery: ${deliveryFileName}`);

            const [invoicePath, deliveryPath] = await Promise.all([
                fileService.downloadFile(invoiceUrl, invoiceFileName, taskDocsDir),
                fileService.downloadFile(deliveryUrl, deliveryFileName, taskDocsDir)
            ]);

            const quantityKg = parseFloat(payload.delivery.quantity);
            const quantityMt = quantityKg / 1000;

            console.log('[Step 2] Filling out the shipment form details...');
            await shipmentFormPage.completeShipmentForm({
                invoicePath: invoicePath,
                invoiceNumber: invoiceNumber,
                date: invoiceDate,
                amount: invoiceAmount,
                deliveryDetailsPath: deliveryPath,
                quantityMt: quantityMt
            });
        });

        await test.step('Step 3: Update Task Status', async () => {
            console.log('[Step 3] Submitting task completion status: completed');
            await automationService.updateTaskStatus('completed');
        });

        console.log(`[Test] Task ${taskId} finished successfully.`);

    } catch (error: any) {
        console.error(`[Test] Automation Failed: ${error.message} ---`);

        // Update task status to failed on error
        try {
            await automationService.updateTaskStatus('failed', error.message);
        } catch (statusError) {
            console.error('[Test] Failed to update failure status:', statusError);
        }

        throw error;
    } finally {
        // Cleanup task-specific directory
        try {
            if (fs.existsSync(absoluteTaskDocsDir)) {
                console.log(`[Test] Cleaning up documents in ${taskDocsDir}...`);
                const files = fs.readdirSync(absoluteTaskDocsDir);
                for (const file of files) {
                    fs.unlinkSync(path.join(absoluteTaskDocsDir, file));
                }
                fs.rmdirSync(absoluteTaskDocsDir);
            }
        } catch (cleanupError) {
            console.error('[Test] Failed to clean up task directory:', cleanupError);
        }
    }
});
