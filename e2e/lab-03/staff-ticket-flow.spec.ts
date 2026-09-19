import { expect, test } from "@playwright/test";
import {
  REQUESTER_PASSWORD,
  STAFF_PASSWORD,
  expectNoHorizontalOverflow,
  loginAndNormalizePassword,
  logout,
} from "./helpers.js";

test("E2E-02 preserves Requester flow and completes Queue-to-Detail Staff operations", async ({ page }, testInfo) => {
  const suffix = `${testInfo.project.name}-${Date.now()}`;
  const summary = `Issue40 integrated ticket ${suffix}`;
  const attachmentName = `issue40-${suffix}.pdf`;
  const requesterComment = `Requester E2E comment ${suffix}`;
  const staffComment = `Staff public update ${suffix}`;
  const internalNote = `Private diagnostic note ${suffix}`;

  await loginAndNormalizePassword(page, "anong.student@example.test", REQUESTER_PASSWORD);
  await expect(page.getByRole("heading", { name: "Create Ticket" })).toBeVisible();
  await page.getByLabel("Category").selectOption({ label: "Hardware" });
  await page.getByLabel("Related System").selectOption({ label: "Corporate Laptop" });
  await page.getByLabel("Requested Priority").selectOption("HIGH");
  await page.getByLabel("Ticket Summary").fill(summary);
  await page.getByLabel(/^Description/).fill("This Issue 40 E2E Ticket validates the integrated authenticated Requester and IT Staff workflow.");
  await page.getByLabel("Attachments").setInputFiles({
    name: attachmentName,
    mimeType: "application/pdf",
    buffer: Buffer.from("Issue 40 E2E Attachment evidence"),
  });
  await page.getByRole("button", { name: "Submit Ticket" }).click();
  const created = page.getByRole("status").filter({ hasText: "Ticket created successfully" });
  await expect(created).toBeVisible();
  const ticketNumber = (await created.textContent())?.match(/TTK-\d{8}-\d{4}/)?.[0];
  expect(ticketNumber).toBeTruthy();

  await page.getByRole("link", { name: "My Tickets" }).click();
  await page.getByRole("searchbox", { name: "Search Tickets" }).fill(summary);
  await expect(page.getByText(summary).filter({ visible: true })).toBeVisible();
  await page.getByRole("button", { name: `Open Ticket ${ticketNumber}` }).filter({ visible: true }).click();
  await expect(page.getByRole("heading", { name: "Ticket Detail" })).toBeVisible();
  await expect(page.getByText(attachmentName)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Public Comments" })).toBeVisible();
  await expect(page.getByText(/Internal Notes/i)).toHaveCount(0);
  await page.getByRole("textbox", { name: "Public Comment", exact: true }).fill(requesterComment);
  await page.getByRole("button", { name: "Post Comment" }).click();
  await expect(page.getByText(requesterComment)).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await logout(page);

  await loginAndNormalizePassword(page, "it.staff.one@example.test", STAFF_PASSWORD);
  await expect(page.getByRole("heading", { name: "Ticket Queue" })).toBeVisible();
  await page.getByLabel("Search Tickets").fill(summary);
  await expect(page.getByText(summary).filter({ visible: true })).toBeVisible();
  await page.getByRole("button", { name: `Open Ticket ${ticketNumber}` }).filter({ visible: true }).click();
  await expect(page.getByRole("heading", { name: "Ticket Detail" })).toBeVisible();
  await expect(page.getByText(attachmentName)).toBeVisible();
  await expect(page.getByText(requesterComment)).toBeVisible();
  await expect(page.getByText(/Internal - not visible to Requester/i)).toBeVisible();

  await page.getByRole("button", { name: "Claim Ticket" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Ticket claimed" })).toBeVisible();
  await expect(page.getByLabel("Owner")).not.toHaveValue("");

  await page.getByLabel("IT Priority").selectOption("URGENT");
  await expect(page.getByRole("status").filter({ hasText: "IT Priority updated" })).toBeVisible();
  await expect(page.getByLabel("Requested Priority")).toHaveValue("HIGH");
  await expect(page.getByLabel("Requested Priority")).toBeDisabled();

  await page.getByLabel("Status Transition").selectOption("OPEN");
  await page.getByRole("button", { name: "Apply Status" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Status updated" })).toBeVisible();

  await page.getByRole("textbox", { name: "Public Comment", exact: true }).fill(staffComment);
  await page.getByRole("button", { name: "Post Public Comment" }).click();
  await expect(page.getByText(staffComment)).toBeVisible();

  await page.getByRole("textbox", { name: "Internal Note", exact: true }).fill(internalNote);
  await page.getByRole("button", { name: "Add Internal Note" }).click();
  await expect(page.getByText(internalNote)).toBeVisible();
  await expect(page.getByRole("link", { name: "Download" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await logout(page);

  await loginAndNormalizePassword(page, "anong.student@example.test", REQUESTER_PASSWORD);
  await page.getByRole("link", { name: "My Tickets" }).click();
  await page.getByRole("searchbox", { name: "Search Tickets" }).fill(summary);
  await page.getByRole("button", { name: `Open Ticket ${ticketNumber}` }).filter({ visible: true }).click();
  await expect(page.getByText(staffComment)).toBeVisible();
  await expect(page.getByText(internalNote)).toHaveCount(0);
  await expect(page.getByText(attachmentName)).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("E2E-02 protects Staff APIs from Requester direct access", async ({ page }) => {
  await loginAndNormalizePassword(page, "anong.student@example.test", REQUESTER_PASSWORD);
  const response = await page.context().request.get("http://localhost:3000/api/staff/tickets");
  expect(response.status()).toBe(403);
  const body = await response.text();
  expect(body).not.toMatch(/passwordHash|tokenHash|csrfTokenHash|storagePath/i);
});
