import { expect, test } from "@playwright/test";
import {
  ADMIN_PASSWORD,
  REQUESTER_PASSWORD,
  STAFF_PASSWORD,
  createActionFromStaffUi,
  createRequesterTicket,
  expectNoHorizontalOverflow,
  loginAndNormalizePassword,
  logout,
  openStaffTicketBySummary,
} from "./helpers.js";

test("E2E-01 completes Actions Taken create/edit/reassign/start/complete/cancel and Requester read-only flow", async ({ page }, testInfo) => {
  const suffix = `${testInfo.project.name}-${Date.now()}`;
  const summary = `Lab4 Actions E2E ${suffix}`;

  await loginAndNormalizePassword(page, "anong.student@example.test", REQUESTER_PASSWORD);
  const ticketNumber = await createRequesterTicket(page, summary);
  await logout(page);

  await loginAndNormalizePassword(page, "it.staff.one@example.test", STAFF_PASSWORD);
  await openStaffTicketBySummary(page, summary, ticketNumber);
  await page.getByRole("button", { name: "Claim Ticket" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Ticket claimed" })).toBeVisible();

  const actionDescription = `Inspect endpoint logs ${suffix}`;
  await createActionFromStaffUi(page, actionDescription);
  let card = page.getByText(actionDescription).first().locator("xpath=ancestor::article[1]");
  await card.getByRole("button", { name: /Edit \/ Reassign/ }).click();
  await page.getByLabel(/Action Description/).fill(`${actionDescription} updated`);
  await page.getByLabel(/^Assignee/).selectOption({ label: "IT Staff Two (IT Staff)" });
  await page.getByRole("button", { name: "Save Action" }).click();
  await expect(page.getByText(`${actionDescription} updated`)).toBeVisible();

  card = page.getByText(`${actionDescription} updated`).first().locator("xpath=ancestor::article[1]");
  await expect(card.getByRole("button", { name: "Complete" })).toHaveCount(0);
  await card.getByRole("button", { name: /Edit \/ Reassign/ }).click();
  await page.getByLabel(/^Assignee/).selectOption({ label: "IT Staff One (IT Staff)" });
  await page.getByRole("button", { name: "Save Action" }).click();

  card = page.getByText(`${actionDescription} updated`).first().locator("xpath=ancestor::article[1]");
  await card.getByRole("button", { name: "Start" }).click();
  await expect(card.getByText("In Progress")).toBeVisible();
  const completeDialog = (dialog: import("@playwright/test").Dialog) => dialog.type() === "prompt"
    ? dialog.accept(`Completed result ${suffix}`)
    : dialog.accept();
  page.on("dialog", completeDialog);
  await card.getByRole("button", { name: "Complete" }).click();
  await expect(card.getByText("Completed", { exact: true })).toBeVisible();
  page.off("dialog", completeDialog);
  await expect(card.getByRole("button", { name: /Edit \/ Reassign/ })).toHaveCount(0);

  const cancelledDescription = `Cancelled duplicate action ${suffix}`;
  await createActionFromStaffUi(page, cancelledDescription);
  const cancelledCard = page.getByText(cancelledDescription).first().locator("xpath=ancestor::article[1]");
  page.once("dialog", (dialog) => dialog.accept());
  await cancelledCard.getByRole("button", { name: "Cancel" }).click();
  await expect(cancelledCard.getByText("Cancelled")).toBeVisible();
  await expect(cancelledCard.getByRole("button", { name: "Cancel" })).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
  await logout(page);

  await loginAndNormalizePassword(page, "anong.student@example.test", REQUESTER_PASSWORD);
  await page.getByRole("link", { name: "My Tickets" }).click();
  await page.getByRole("searchbox", { name: "Search Tickets" }).fill(summary);
  await page.getByRole("button", { name: `Open Ticket ${ticketNumber}` }).filter({ visible: true }).click();
  await expect(page.getByText(`${actionDescription} updated`)).toBeVisible();
  await expect(page.getByText(cancelledDescription)).toBeVisible();
  await expect(page.getByText(/Recorded service-desk work for this Ticket\. This information is read-only\./)).toBeVisible();
  await expect(page.getByRole("button", { name: "Create Action" })).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});

test("E2E-01 rejects an inactive Action assignee and protects Staff Action APIs from Requesters", async ({ page }, testInfo) => {
  const suffix = `${testInfo.project.name}-${Date.now()}`;
  const summary = `Lab4 inactive assignee ${suffix}`;

  await loginAndNormalizePassword(page, "anong.student@example.test", REQUESTER_PASSWORD);
  await createRequesterTicket(page, summary);
  await logout(page);

  await loginAndNormalizePassword(page, "admin@example.test", ADMIN_PASSWORD);
  const inactiveResponsePromise = page.waitForResponse((response) => response.url().includes("/api/admin/users?search=inactive.it.staff") && response.request().method() === "GET");
  await page.getByLabel("Search Users").fill("inactive.it.staff@example.test");
  const inactiveResponse = await inactiveResponsePromise;
  expect(inactiveResponse.status()).toBe(200);
  const inactiveUsers = await inactiveResponse.json() as Array<{ id: number; email: string; isActive: boolean }>;
  const inactive = inactiveUsers.find((user) => user.email === "inactive.it.staff@example.test");
  expect(inactive?.isActive).toBe(false);
  await logout(page);

  await loginAndNormalizePassword(page, "it.staff.one@example.test", STAFF_PASSWORD);
  const auth = await page.context().request.get("http://localhost:3000/api/auth/me");
  const { csrfToken } = await auth.json() as { csrfToken: string };
  const queue = await page.context().request.get(`http://localhost:3000/api/staff/tickets?search=${encodeURIComponent(summary)}`);
  const queueBody = await queue.json() as { items: Array<{ id: number }> };
  expect(queueBody.items).toHaveLength(1);
  const ticketId = queueBody.items[0].id;
  const detailResponse = await page.context().request.get(`http://localhost:3000/api/staff/tickets/${ticketId}`);
  expect(detailResponse.status()).toBe(200);
  const ticket = await detailResponse.json() as { id: number; version: number };
  const rejected = await page.context().request.post(`http://localhost:3000/api/staff/tickets/${ticket.id}/actions`, {
    headers: { Origin: "http://localhost:5173", "X-CSRF-Token": csrfToken },
    data: {
      expectedTicketVersion: ticket.version,
      clientRequestId: crypto.randomUUID(),
      actionDescription: "Attempt inactive assignment",
      assigneeId: inactive!.id,
      followUpRequired: false,
    },
  });
  expect(rejected.status()).toBe(409);
  expect((await rejected.json()).error?.code).toBe("INACTIVE_ASSIGNEE");
  await page.context().clearCookies();
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible();

  await loginAndNormalizePassword(page, "anong.student@example.test", REQUESTER_PASSWORD);
  const requesterWrite = await page.context().request.post(`http://localhost:3000/api/staff/tickets/${ticket.id}/actions`, {
    headers: { Origin: "http://localhost:5173" },
    data: { expectedTicketVersion: ticket.version, clientRequestId: crypto.randomUUID(), actionDescription: "Forbidden", followUpRequired: false },
  });
  expect(requesterWrite.status()).toBe(403);
});
