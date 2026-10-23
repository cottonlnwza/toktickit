import { expect, test } from "@playwright/test";
import {
  REQUESTER_PASSWORD,
  STAFF_PASSWORD,
  createActionFromStaffUi,
  createRequesterTicket,
  expectNoHorizontalOverflow,
  loginAndNormalizePassword,
  logout,
  openStaffTicketBySummary,
} from "./helpers.js";

test("E2E-02 enforces current-cycle resolution evidence and reopen isolation", async ({ page }, testInfo) => {
  const suffix = `${testInfo.project.name}-${Date.now()}`;
  const summary = `Lab4 resolution E2E ${suffix}`;

  await loginAndNormalizePassword(page, "anong.student@example.test", REQUESTER_PASSWORD);
  const ticketNumber = await createRequesterTicket(page, summary);
  await logout(page);

  await loginAndNormalizePassword(page, "it.staff.one@example.test", STAFF_PASSWORD);
  await openStaffTicketBySummary(page, summary, ticketNumber);
  await page.getByRole("button", { name: "Claim Ticket" }).click();
  await page.getByLabel("Status Transition").selectOption("OPEN");
  await page.getByRole("button", { name: "Apply Status" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Status updated" })).toBeVisible();

  const firstAction = `Resolve initial cycle ${suffix}`;
  await createActionFromStaffUi(page, firstAction);
  let card = page.getByText(firstAction).first().locator("xpath=ancestor::article[1]");
  const firstCompleteDialog = (dialog: import("@playwright/test").Dialog) => dialog.type() === "prompt"
    ? dialog.accept(`Resolved cycle one ${suffix}`)
    : dialog.accept();
  page.on("dialog", firstCompleteDialog);
  await card.getByRole("button", { name: "Complete" }).click();
  await expect(card.getByText("Completed", { exact: true })).toBeVisible();
  page.off("dialog", firstCompleteDialog);

  await page.getByLabel("Status Transition").selectOption("RESOLVED");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Apply Status" }).click();
  await expect(page.getByText("Resolved", { exact: true }).first()).toBeVisible();

  await page.getByLabel("Status Transition").selectOption("REOPENED");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Apply Status" }).click();
  await expect(page.getByText(/Current workflow cycle: 2/)).toBeVisible();
  card = page.getByText(firstAction).first().locator("xpath=ancestor::article[1]");
  await expect(card.getByText(/Cycle 1 - Historical/)).toBeVisible();

  await page.getByLabel("Status Transition").selectOption("RESOLVED");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Apply Status" }).click();
  await expect(page.getByRole("alert")).toContainText(/Resolve is blocked until the current workflow cycle has at least one completed Action/i);

  const secondAction = `Resolve reopened cycle ${suffix}`;
  await createActionFromStaffUi(page, secondAction);
  const secondCard = page.getByText(secondAction).first().locator("xpath=ancestor::article[1]");
  const secondCompleteDialog = (dialog: import("@playwright/test").Dialog) => dialog.type() === "prompt"
    ? dialog.accept(`Resolved cycle two ${suffix}`)
    : dialog.accept();
  page.on("dialog", secondCompleteDialog);
  await secondCard.getByRole("button", { name: "Complete" }).click();
  await expect(secondCard.getByText("Completed", { exact: true })).toBeVisible();
  page.off("dialog", secondCompleteDialog);
  await page.getByLabel("Status Transition").selectOption("RESOLVED");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Apply Status" }).click();
  await expect(page.getByText("Resolved", { exact: true }).first()).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
