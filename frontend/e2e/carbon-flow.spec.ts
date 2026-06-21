import { test, expect } from "@playwright/test";

test.describe("CarboNudge Core Journey", () => {
  test("should allow logging a transit activity and verifying the dashboard", async ({ page }) => {
    // 1. Navigate to /log
    await page.goto("/log");

    // Verify page title / heading
    await expect(page.getByRole("heading", { name: "Log an Activity" })).toBeVisible();

    // 2. Select "Transit" category (should be selected by default, but let's click to be sure)
    const transitBtn = page.locator("#category-transit");
    await expect(transitBtn).toBeVisible();
    await transitBtn.click();

    // 3. Select Transit type: "Car"
    const activitySelect = page.locator("#activity-type");
    await expect(activitySelect).toBeVisible();
    await activitySelect.selectOption("Car");

    // 4. Enter distance value
    const quantityInput = page.locator("#activity-value");
    await expect(quantityInput).toBeVisible();
    await quantityInput.fill("15");

    // 5. Verify the CO₂ preview appears
    const previewContainer = page.locator("text=Estimated CO₂ Impact");
    await expect(previewContainer).toBeVisible();

    // Verify math: 15 * 0.192 = 2.88
    const previewValue = page.locator("text=2.88");
    await expect(previewValue).toBeVisible();

    // 6. Click "Log Activity"
    const submitBtn = page.getByRole("button", { name: "Log Activity" });
    await expect(submitBtn).toBeVisible();
    await submitBtn.click();

    // 7. Verify success state
    const successMsg = page.locator("text=Activity logged successfully!");
    await expect(successMsg).toBeVisible();

    // 8. Navigate to dashboard
    await page.goto("/dashboard");

    // Verify Overview header renders
    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  });
});
