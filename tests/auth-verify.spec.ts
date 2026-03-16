import { test, expect } from '../fixtures/auth.fixture';

test('Verify Authentication Bypass', async ({ page }) => {
    const dashboardUrl = `https://${process.env.DOMAIN_NAME}/dashboard`; 

    // Verify we are on the dashboard page
    await expect(page).toHaveURL(/.*\/homepage\/dashboard/);

    const currentUrl = page.url();
    console.log('Successfully bypassed login.');
});

// test('Click Icon Section', async ({ page }) => {
//     // Navigate to dashboard if not already there (though fixture usually handles base URL)
//     await page.goto(`https://${process.env.DOMAIN_NAME}/homepage/dashboard`);

//     // Locate and click the icon section
//     const iconSection = page.locator("//div[@class='icon-section']");
//     await expect(iconSection).toBeVisible();
//     await iconSection.click();

//     console.log('Successfully clicked the icon section.');
// });
