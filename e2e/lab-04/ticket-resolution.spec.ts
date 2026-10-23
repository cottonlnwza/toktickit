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

test("E2E-02 rejects a stale Ticket revision without overwriting newer state", async ({ page }, testInfo) => {
  const suffix = `${testInfo.project.name}-${Date.now()}`;
  const summary = `Lab4 stale E2E ${suffix}`;

  await loginAndNormalizePassword(page, "anong.student@example.test", REQUESTER_PASSWORD);
  const ticketNumber = await createRequesterTicket(page, summary);
  await logout(page);

  await loginAndNormalizePassword(page, "it.staff.one@example.test", STAFF_PASSWORD);
  await openStaffTicketBySummary(page, summary, ticketNumber);
  const ticketId = Number(page.url().match(/#staff-ticket-(\d+)/)?.[1]);
  expect(ticketId).toBeGreaterThan(0);

  const claimRequestPromise = page.waitForRequest((request) => request.url().endsWith(`/api/staff/tickets/${ticketId}/claim`) && request.method() === "POST");
  const claimResponsePromise = page.waitForResponse((response) => response.url().endsWith(`/api/staff/tickets/${ticketId}/claim`) && response.status() === 200);
  await page.getByRole("button", { name: "Claim Ticket" }).click();
  const claimRequest = await claimRequestPromise;
  const claimResponse = await claimResponsePromise;
  const csrfToken = claimRequest.headers()["x-csrf-token"];
  const claimed = await claimResponse.json() as { version: number };
  expect(csrfToken).toBeTruthy();

  const externalMutation = await page.evaluate(async ({ id, csrf, expectedTicketVersion }) => {
    const response = await fetch(`http://localhost:3000/api/staff/tickets/${id}/it-priority`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
      body: JSON.stringify({ itPriority: "URGENT", expectedTicketVersion }),
    });
    return { status: response.status, body: await response.json() as { version?: number } };
  }, { id: ticketId, csrf: csrfToken, expectedTicketVersion: claimed.version });
  expect(externalMutation.status).toBe(200);

  await page.getByLabel("Status Transition").selectOption("OPEN");
  await page.getByRole("button", { name: "Apply Status" }).click();
  await expect(page.getByRole("alert")).toContainText(/Ticket changed before this update.*Refresh the Ticket Detail/i);

  const authoritative = await page.evaluate(async (id) => {
    const response = await fetch(`http://localhost:3000/api/staff/tickets/${id}`, { credentials: "include" });
    return response.json() as Promise<{ currentStatus: string; itPriority: string; version: number }>;
  }, ticketId);
  expect(authoritative.currentStatus).toBe("NEW");
  expect(authoritative.itPriority).toBe("URGENT");
  expect(authoritative.version).toBe(externalMutation.body.version);
});
