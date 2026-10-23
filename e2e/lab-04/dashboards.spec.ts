import { expect, test } from "@playwright/test";
import {
  ADMIN_PASSWORD,
  REQUESTER_PASSWORD,
  STAFF_PASSWORD,
  expectNoHorizontalOverflow,
  loginAndNormalizePassword,
  logout,
} from "./helpers.js";

test("E2E-03 matches Requester dashboard UI to authoritative metrics and protects role boundaries", async ({ page }) => {
  await loginAndNormalizePassword(page, "anong.student@example.test", REQUESTER_PASSWORD);
  const responsePromise = page.waitForResponse((response) => response.url().endsWith("/api/dashboards/requester") && response.status() === 200);
  await page.getByRole("link", { name: "Dashboard" }).click();
  const response = await responsePromise;
  const data = await response.json() as { metrics: { openTickets: number; waitingForRequester: number } };
  await expect(page.getByRole("heading", { name: "Requester Dashboard" })).toBeVisible();
  await expect(page.getByRole("link", { name: `Open Tickets ${data.metrics.openTickets}` })).toBeVisible();
  await expect(page.getByRole("link", { name: `Waiting for You ${data.metrics.waitingForRequester}` })).toBeVisible();
  await page.getByRole("link", { name: `Open Tickets ${data.metrics.openTickets}` }).click();
  await expect(page.getByRole("heading", { name: "My Tickets" })).toBeVisible();
  expect(page.url()).toContain("#my-tickets?scope=open");
  await expectNoHorizontalOverflow(page);

  const staffStatus = await page.evaluate(async () => {
    const response = await fetch("http://localhost:3000/api/dashboards/staff", { credentials: "include" });
    return response.status;
  });
  expect(staffStatus).toBe(403);
});

test("E2E-03 matches Staff/Admin dashboard metrics and current-user drill-down", async ({ page }) => {
  await loginAndNormalizePassword(page, "it.staff.one@example.test", STAFF_PASSWORD);
  const responsePromise = page.waitForResponse((response) => response.url().endsWith("/api/dashboards/staff") && response.status() === 200);
  await page.getByRole("link", { name: "Dashboard" }).click();
  const response = await responsePromise;
  const data = await response.json() as { metrics: { unassignedTickets: number; myTickets: number; myOpenActions: number } };
  await expect(page.getByRole("heading", { name: "IT Staff Dashboard" })).toBeVisible();
  await expect(page.getByRole("link", { name: `Unassigned Tickets ${data.metrics.unassignedTickets}` })).toBeVisible();
  await expect(page.getByRole("link", { name: `My Tickets ${data.metrics.myTickets}` })).toBeVisible();
  const actionsLink = page.getByRole("link", { name: `My Open Actions ${data.metrics.myOpenActions}` });
  await expect(actionsLink).toBeVisible();
  await actionsLink.click();
  await expect(page.locator("#my-actions")).toBeFocused();
  await expectNoHorizontalOverflow(page);
  await logout(page);

  await loginAndNormalizePassword(page, "admin@example.test", ADMIN_PASSWORD);
  await page.getByRole("link", { name: "Dashboard" }).click();
  await expect(page.getByRole("heading", { name: "IT Staff Dashboard" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("E2E-03 renders retryable dashboard safe failure", async ({ page }) => {
  let failDashboard = true;
  await page.context().route(/\/api\/dashboards\/requester(?:\?.*)?$/, async (route) => {
    if (failDashboard) {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "DASHBOARD_ERROR", message: "Unable to load dashboard." } }),
      });
      return;
    }
    await route.continue();
  });
  await loginAndNormalizePassword(page, "anong.student@example.test", REQUESTER_PASSWORD);
  await page.getByRole("link", { name: "Dashboard" }).click();
  await expect(page.getByRole("alert")).toContainText(/Unable to load Dashboard/);
  failDashboard = false;
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByRole("heading", { name: "Requester Dashboard" })).toBeVisible();
});
