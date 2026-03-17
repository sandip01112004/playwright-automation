import { test, expect } from '../fixtures/auth.fixture';
import * as readlineSync from 'readline-sync';

// Helper: Prompt the user in the terminal to enter the Order Number
function promptOrderNo(): string {
    return readlineSync.question('\nEnter Order Number: ').trim();
}

test.beforeEach(async ({ dashboardPage }) => {
    // Handle post-login setup (close popups, verify dashboard URL)
    await dashboardPage.handlePostLoginSetup();
});

test('Create Shipment with Parameterized Order Number', async ({ dashboardPage }) => {
    // Use ORDER_NO env variable if provided, otherwise prompt interactively in terminal
    // Run with: ORDER_NO=your_order_no npx playwright test tests/create-shipment.spec.ts --headed
    const orderNo = process.env.ORDER_NO || promptOrderNo();

    if (!orderNo) {
        throw new Error('No Order Number provided. Either set ORDER_NO env variable or enter it when prompted.');
    }

    console.log(`\nStarting shipment creation for Order Number: ${orderNo}`);

    // Step 1: Search for the Order Number (includes clicking Orders tab)
    await dashboardPage.searchForOrder(orderNo);

    // Step 2: Open the shipment menu for the first row
    await dashboardPage.openShipmentMenu();

    // Step 3: Select "Create Shipment"
    await dashboardPage.selectCreateShipment();

    console.log('Successfully reached the Create Shipment step.');
});
