import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import {
  ADMIN_PASSWORD,
  REQUESTER_PASSWORD,
  STAFF_PASSWORD,
  expectNoHorizontalOverflow,
  loginAndNormalizePassword,
  logout,
} from "./helpers.js";

type EvidenceArea =
  | "authentication"
  | "requester-create-ticket"
  | "requester-my-tickets"
  | "requester-ticket-detail"
  | "staff-queue"
  | "staff-ticket-detail"
  | "user-management";

async function captureEvidence(page: Page, testInfo: TestInfo, area: EvidenceArea) {
  await expectNoHorizontalOverflow(page);
  const directory = resolve(process.cwd(), "artifacts", "lab-03", "screenshots", area);
  mkdirSync(directory, { recursive: true });
  await page.screenshot({
    path: resolve(directory, `${testInfo.project.name}.png`),
    fullPage: true,
    animations: "disabled",
  });
}

test("Issue 9 captures required responsive visual evidence", async ({ page }, testInfo) => {
  const suffix = `${testInfo.project.name}-visual`;
  const summary = `Issue 9 visual audit ${suffix}`;
  const attachmentName = `issue9-${suffix}.pdf`;
  const requesterComment = `Requester visual evidence ${suffix}`;
  const staffPublicComment = `Staff public visual evidence ${suffix}`;
  const internalNote = `Internal visual evidence ${suffix}`;

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "TokTickIT" })).toBeVisible();
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByText("Email is required.")).toBeVisible();
  await expect(page.getByText("Password is required.")).toBeVisible();
  await captureEvidence(page, testInfo, "authentication");

  await loginAndNormalizePassword(page, "anong.student@example.test", REQUESTER_PASSWORD);
  await expect(page.getByRole("button", { name: "Change Password" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Logout" })).toBeVisible();
  await page.getByRole("button", { name: "Change Password" }).click();
  await expect(page.getByRole("heading", { name: "Change Password" })).toBeVisible();
  await expect(page.getByText(/12-128 characters/i)).toBeVisible();
  await expect(page.getByLabel("Current / Initial Password")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("heading", { name: "Create Ticket" })).toBeVisible();
  await expect(page.getByText("Anong Student", { exact: true }).first()).toBeVisible();
  await expect(page.locator(".auth-identity .role-badge", { hasText: "Requester" })).toBeVisible();
  await page.getByLabel("Category").selectOption({ label: "Hardware" });
  await page.getByLabel("Related System").selectOption({ label: "Corporate Laptop" });
  await page.getByLabel("Requested Priority").selectOption("HIGH");
  await page.getByLabel("Ticket Summary").fill(summary);
  await page.getByLabel(/^Description/).fill("Responsive visual-audit Ticket with authenticated identity, Attachment controls, and readable field grouping.");
  await page.getByLabel("Attachments").setInputFiles({
    name: attachmentName,
    mimeType: "application/pdf",
    buffer: Buffer.from("Issue 9 visual evidence"),
  });
  await expect(page.getByText(attachmentName)).toBeVisible();
  await captureEvidence(page, testInfo, "requester-create-ticket");

  await page.getByRole("button", { name: "Submit Ticket" }).click();
  const created = page.getByRole("status").filter({ hasText: "Ticket created successfully" });
  await expect(created).toBeVisible();
  const ticketNumber = (await created.textContent())?.match(/TTK-\d{8}-\d{4}/)?.[0];
  expect(ticketNumber).toBeTruthy();

  await page.getByRole("link", { name: "My Tickets" }).click();
  await expect(page.getByRole("heading", { name: "My Tickets" })).toBeVisible();
  await page.getByRole("searchbox", { name: "Search Tickets" }).fill(summary);
  await expect(page.getByText(summary).filter({ visible: true })).toBeVisible();
  await expect(page.getByLabel("Priority filter")).toBeVisible();
  await expect(page.getByLabel("Status filter")).toBeVisible();
  await captureEvidence(page, testInfo, "requester-my-tickets");

  await page.getByRole("button", { name: `Open Ticket ${ticketNumber}` }).filter({ visible: true }).click();
  await expect(page.getByRole("heading", { name: "Ticket Detail" })).toBeVisible();
  await expect(page.getByText(attachmentName)).toBeVisible();
  await page.getByRole("textbox", { name: "Public Comment", exact: true }).fill(requesterComment);
  await page.getByRole("button", { name: "Post Comment" }).click();
  await expect(page.getByText(requesterComment)).toBeVisible();
  await expect(page.getByRole("button", { name: /Problem Appears Resolved/ })).toBeVisible();
  await captureEvidence(page, testInfo, "requester-ticket-detail");
  await logout(page);

  await loginAndNormalizePassword(page, "it.staff.one@example.test", STAFF_PASSWORD);
  await expect(page.getByRole("heading", { name: "Ticket Queue" })).toBeVisible();
  await page.getByLabel("Search Tickets").fill(summary);
  await expect(page.getByText(summary).filter({ visible: true })).toBeVisible();
  await expect(page.getByLabel("Requested Priority")).toBeVisible();
  await expect(page.getByLabel("IT Priority")).toBeVisible();
  await captureEvidence(page, testInfo, "staff-queue");

  await page.getByRole("button", { name: `Open Ticket ${ticketNumber}` }).filter({ visible: true }).click();
  await expect(page.getByRole("heading", { name: "Ticket Detail" })).toBeVisible();
  await page.getByRole("button", { name: "Claim Ticket" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Ticket claimed" })).toBeVisible();
  await page.getByLabel("IT Priority").selectOption("URGENT");
  await expect(page.getByRole("status").filter({ hasText: "IT Priority updated" })).toBeVisible();
  await page.getByLabel("Status Transition").selectOption("OPEN");
  await page.getByRole("button", { name: "Apply Status" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Status updated" })).toBeVisible();
  await page.getByRole("textbox", { name: "Public Comment", exact: true }).fill(staffPublicComment);
  await page.getByRole("button", { name: "Post Public Comment" }).click();
  await expect(page.getByText(staffPublicComment)).toBeVisible();
  await page.getByRole("textbox", { name: "Internal Note", exact: true }).fill(internalNote);
  await page.getByRole("button", { name: "Add Internal Note" }).click();
  await expect(page.getByText(internalNote)).toBeVisible();
  await expect(page.getByText(/Internal - not visible to Requester/i)).toBeVisible();
  await expect(page.getByRole("link", { name: "Download" })).toBeVisible();
  await captureEvidence(page, testInfo, "staff-ticket-detail");
  await logout(page);

  await loginAndNormalizePassword(page, "admin@example.test", ADMIN_PASSWORD);
  await expect(page.getByRole("heading", { name: "User Management" })).toBeVisible();
  await expect(page.locator(".auth-identity .role-badge", { hasText: "Administrator" })).toBeVisible();
  await expect(page.getByLabel("Search Users")).toBeVisible();
  await expect(page.getByLabel("Role Filter")).toBeVisible();
  await expect(page.getByRole("button", { name: "Delete User" })).toHaveCount(0);
  await page.getByRole("button", { name: "Create User" }).click();
  await expect(page.getByRole("heading", { name: "Create User" })).toBeVisible();
  await expect(page.getByLabel("Initial Password")).toBeVisible();
  await captureEvidence(page, testInfo, "user-management");
});
