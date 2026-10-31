import { expect, test } from "@playwright/test";
import {
  REQUESTER_PASSWORD,
  STAFF_PASSWORD,
  expectNoHorizontalOverflow,
  loginAndNormalizePassword,
  openStaffTicketBySummary,
} from "./helpers.js";

function collectRuntimeErrors(page: import("@playwright/test").Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

test("VIS-01 captures and verifies the Staff Dashboard", async ({ page }, testInfo) => {
  await loginAndNormalizePassword(page, "it.staff.one@example.test", STAFF_PASSWORD);
  const runtimeErrors = collectRuntimeErrors(page);
  await page.getByRole("link", { name: "Dashboard" }).click();
  await expect(page.getByRole("heading", { name: "IT Staff Dashboard" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
  await expectNoHorizontalOverflow(page);

  const metric = page.getByRole("link", { name: /Unassigned Tickets/ });
  await metric.focus();
  const focusStyle = await metric.evaluate((element) => {
    const style = getComputedStyle(element);
    return { outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth, boxShadow: style.boxShadow };
  });
  expect(focusStyle.outlineStyle !== "none" || focusStyle.outlineWidth !== "0px" || focusStyle.boxShadow !== "none").toBe(true);

  await page.screenshot({ path: `artifacts/lab-04/screenshots/staff-dashboard/${testInfo.project.name}.png`, fullPage: true });
  expect(runtimeErrors).toEqual([]);
});

test("VIS-02 captures and verifies the Requester Dashboard", async ({ page }, testInfo) => {
  await loginAndNormalizePassword(page, "anong.student@example.test", REQUESTER_PASSWORD);
  const runtimeErrors = collectRuntimeErrors(page);
  await page.getByRole("link", { name: "Dashboard" }).click();
  await expect(page.getByRole("heading", { name: "Requester Dashboard" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("link", { name: /Open Tickets/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Waiting for You/ })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: `artifacts/lab-04/screenshots/requester-dashboard/${testInfo.project.name}.png`, fullPage: true });
  expect(runtimeErrors).toEqual([]);
});

test("VIS-03 captures Actions Taken plus conditional validation and long-form responsive content", async ({ page }, testInfo) => {
  await loginAndNormalizePassword(page, "it.staff.two@example.test", STAFF_PASSWORD);
  const runtimeErrors = collectRuntimeErrors(page);
  await openStaffTicketBySummary(page, "Dock display flickers", "LAB3-0003");
  await expect(page.getByRole("heading", { name: "Actions Taken" })).toBeVisible();
  await expect(page.getByText("Inspect dock cable and display connection.")).toBeVisible();
  await expect(page.getByText("Prepare replacement display cable.")).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.getByLabel(/Follow-Up Required/).selectOption("yes");
  await page.getByRole("button", { name: "Create Action" }).click();
  const followUp = page.getByLabel(/Follow-up Note/);
  await expect(followUp).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByText(/Follow-up Note is required/)).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.screenshot({ path: `artifacts/lab-04/screenshots/actions-taken/${testInfo.project.name}.png`, fullPage: true });
  expect(runtimeErrors).toEqual([]);
});
