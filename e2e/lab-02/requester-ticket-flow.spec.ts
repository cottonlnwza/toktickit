import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

type Requester = { id: number; name: string; email: string };

async function selectFirstRequester(page: import("@playwright/test").Page) {
  const response = await page.request.get("http://127.0.0.1:3000/api/requesters");
  expect(response.ok()).toBeTruthy();
  const requesters = (await response.json()) as Requester[];
  expect(requesters.length).toBeGreaterThan(0);

  await page.goto("/");
  await page.locator("#requester-select").selectOption(String(requesters[0].id));
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText(`Requester: ${requesters[0].name}`)).toBeVisible();
  return requesters;
}

async function expectNoHorizontalOverflow(page: import("@playwright/test").Page) {
  const widths = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(widths.scrollWidth).toBeLessThanOrEqual(widths.clientWidth);
}

async function captureEvidence(
  page: import("@playwright/test").Page,
  area: "create-ticket" | "my-tickets" | "ticket-detail" | "responsive",
  projectName: string,
) {
  const path = join("artifacts", "lab-02", "screenshots", area, `${projectName}.png`);
  mkdirSync(dirname(path), { recursive: true });
  await page.screenshot({ path, fullPage: true });
}

test("requester creates, finds, opens, and manages an owned Ticket", async ({ page }, testInfo) => {
  const requesters = await selectFirstRequester(page);
  const unique = `${testInfo.project.name}-${Date.now()}`;
  const summary = `E2E support request ${unique}`;

  await page.getByLabel("Category").selectOption({ index: 1 });
  await page.getByLabel("Related System").selectOption({ index: 1 });
  await page.getByLabel("Requested Priority").selectOption("MEDIUM");
  await page.getByLabel("Ticket Summary").fill(summary);
  await page.getByLabel("Description").fill("This ticket verifies the complete requester workflow through Playwright.");
  await captureEvidence(page, "create-ticket", testInfo.project.name);
  await page.getByRole("button", { name: "Submit Ticket" }).click();

  const success = page.getByRole("status").filter({ hasText: "Ticket created successfully" });
  await expect(success).toBeVisible();
  const ticketNumber = (await success.textContent())?.match(/TTK-\d{8}-\d{4}/)?.[0];
  expect(ticketNumber).toBeTruthy();

  await page.getByRole("link", { name: "My Tickets" }).click();
  await page.getByRole("searchbox", { name: "Search Tickets" }).fill(summary);
  await expect(page.getByText(summary).filter({ visible: true })).toBeVisible();
  if (testInfo.project.name === "tablet" || testInfo.project.name === "mobile") {
    await expect(page.locator(".my-ticket-cards")).toBeVisible();
    await expect(page.getByRole("button", { name: `Open Ticket ${ticketNumber}` }).filter({ visible: true })).toBeVisible();
  }
  await captureEvidence(page, "my-tickets", testInfo.project.name);
  await page.getByRole("button", { name: `Open Ticket ${ticketNumber}` }).filter({ visible: true }).click();
  await expect(page.getByRole("heading", { name: "Ticket Detail" })).toBeVisible();

  await page.getByLabel("Add Attachment").setInputFiles({
    name: `evidence-${unique}.pdf`,
    mimeType: "application/pdf",
    buffer: Buffer.from("E2E attachment evidence"),
  });
  await expect(page.getByText(`evidence-${unique}.pdf`)).toBeVisible();
  const download = page.getByRole("link", { name: `Download evidence-${unique}.pdf` });
  await expect(download).toBeVisible();

  await page.getByRole("button", { name: `Remove evidence-${unique}.pdf` }).click();
  await page.getByLabel("Removal reason").fill("E2E soft-removal verification");
  await page.getByRole("button", { name: "Confirm removal" }).click();
  await expect(page.getByText(/Download unavailable/)).toBeVisible();
  await expect(download).toHaveCount(0);
  await captureEvidence(page, "ticket-detail", testInfo.project.name);

  if (requesters.length > 1) {
    const ticketResponse = await page.request.get(
      `http://127.0.0.1:3000/api/requesters/${requesters[1].id}/tickets?search=${ticketNumber}`,
    );
    expect(ticketResponse.ok()).toBeTruthy();
    const body = await ticketResponse.json();
    expect(body.items).toHaveLength(0);
  }

  await expectNoHorizontalOverflow(page);
  await captureEvidence(page, "responsive", testInfo.project.name);
});

test("ticket remains created when an attachment upload fails and retry does not recreate it", async ({ page }, testInfo) => {
  await selectFirstRequester(page);
  const unique = `partial-${testInfo.project.name}-${Date.now()}`;
  let createCalls = 0;
  let uploadCalls = 0;

  page.on("request", (request) => {
    if (request.method() === "POST" && /\/api\/tickets$/.test(request.url())) createCalls += 1;
  });
  await page.route("**/api/requesters/*/tickets/*/attachments", async (route) => {
    uploadCalls += 1;
    if (uploadCalls === 1) {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "ATTACHMENT_UPLOAD_ERROR", message: "Unable to upload Attachment." } }),
      });
      return;
    }
    await route.continue();
  });

  await page.getByLabel("Category").selectOption({ index: 1 });
  await page.getByLabel("Related System").selectOption({ index: 1 });
  await page.getByLabel("Ticket Summary").fill(`E2E partial upload ${unique}`);
  await page.getByLabel("Description").fill("The Ticket must remain saved while a failed attachment can be retried.");
  await page.getByLabel("Attachments").setInputFiles({
    name: `retry-${unique}.pdf`,
    mimeType: "application/pdf",
    buffer: Buffer.from("retry attachment"),
  });
  await page.getByRole("button", { name: "Submit Ticket" }).click();

  await expect(page.getByRole("status").filter({ hasText: "Ticket created successfully" })).toBeVisible();
  await expect(page.getByRole("button", { name: new RegExp(`Retry retry-${unique}\\.pdf`) })).toBeVisible();
  expect(createCalls).toBe(1);
  await page.getByRole("button", { name: new RegExp(`Retry retry-${unique}\\.pdf`) }).click();
  await expect(page.getByText(`retry-${unique}.pdf Uploaded`)).toBeVisible();
  expect(createCalls).toBe(1);
  expect(uploadCalls).toBe(2);
  await expectNoHorizontalOverflow(page);
});
