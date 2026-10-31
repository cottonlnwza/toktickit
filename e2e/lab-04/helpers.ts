import { expect, type Page } from "@playwright/test";
import {
  REQUESTER_PASSWORD,
  STAFF_PASSWORD,
  ADMIN_PASSWORD,
  expectNoHorizontalOverflow,
  loginAndNormalizePassword,
  logout,
} from "../lab-03/helpers.js";

export {
  REQUESTER_PASSWORD,
  STAFF_PASSWORD,
  ADMIN_PASSWORD,
  expectNoHorizontalOverflow,
  loginAndNormalizePassword,
  logout,
};

export async function createRequesterTicket(page: Page, summary: string) {
  await expect(page.getByRole("heading", { name: "Create Ticket" })).toBeVisible();
  await page.getByLabel("Category").selectOption({ label: "Hardware" });
  await page.getByLabel("Related System").selectOption({ label: "Corporate Laptop" });
  await page.getByLabel("Requested Priority").selectOption("HIGH");
  await page.getByLabel("Ticket Summary").fill(summary);
  await page.getByLabel(/^Description/).fill("Lab 4 end-to-end workflow verification ticket.");
  await page.getByRole("button", { name: "Submit Ticket" }).click();
  const success = page.getByRole("status").filter({ hasText: "Ticket created successfully" });
  await expect(success).toBeVisible();
  const ticketNumber = (await success.textContent())?.match(/TTK-\d{8}-\d{4}/)?.[0];
  expect(ticketNumber).toBeTruthy();
  return ticketNumber!;
}

export async function openStaffTicketBySummary(page: Page, summary: string, ticketNumber: string) {
  await expect(page.getByRole("heading", { name: "Ticket Queue" })).toBeVisible();
  await page.getByLabel("Search Tickets").fill(summary);
  await expect(page.getByText(summary).filter({ visible: true })).toBeVisible();
  await page.getByRole("button", { name: `Open Ticket ${ticketNumber}` }).filter({ visible: true }).click();
  await expect(page.getByRole("heading", { name: "Ticket Detail" })).toBeVisible();
}

export async function createActionFromStaffUi(page: Page, description: string, assigneeLabel = "IT Staff One") {
  await page.getByLabel(/Action Description/).fill(description);
  await page.getByLabel(/^Assignee/).selectOption({ label: `${assigneeLabel} (IT Staff)` });
  await page.getByRole("button", { name: "Create Action" }).click();
  await expect(page.getByText(description)).toBeVisible();
}
