import { test, expect } from '../fixtures/auth.fixture';

test.beforeEach(async ({ dashboardPage }) => {
    // Handle post-login setup (close popups, verify dashboard URL)
    await dashboardPage.handlePostLoginSetup();
});

test('Create Shipment with Parameterized Order Number', async ({ dashboardPage }) => {
    // Retrieve Order Number from environment variable
    const orderNo = process.env.ORDER_NO;

    if (!orderNo) {
        throw new Error('ORDER_NO environment variable is missing. Run with: ORDER_NO=your_order_no npx playwright test tests/create-shipment.spec.ts');
    }

    console.log(`Starting shipment creation for Order Number: ${orderNo}`);

    // Step 1: Search for the Order Number (includes clicking Orders tab)
    await dashboardPage.searchForOrder(orderNo);

    // Step 2: Open the shipment menu for the first row
    await dashboardPage.openShipmentMenu();

    // Step 3: Select "Create Shipment"
    await dashboardPage.selectCreateShipment();

    console.log('Successfully reached the Create Shipment step.');
});
