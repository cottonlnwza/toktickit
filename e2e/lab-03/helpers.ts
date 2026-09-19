import { expect, type Page } from "@playwright/test";

export const INITIAL_PASSWORD = "Lab3-ChangeMe-2026";
export const REQUESTER_PASSWORD = "Lab3-E2E-Requester-2026";
export const STAFF_PASSWORD = "Lab3-E2E-Staff-2026";
export const ADMIN_PASSWORD = "Lab3-E2E-Admin-2026";

export async function expectNoHorizontalOverflow(page: Page) {
  const widths = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(widths.scrollWidth).toBeLessThanOrEqual(widths.clientWidth);
}

export async function loginAndNormalizePassword(
  page: Page,
  email: string,
  stablePassword: string,
) {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible();
  const emailInput = page.getByLabel("Email");
  const passwordInput = page.getByLabel("Password");
  await emailInput.fill(email);
  await passwordInput.fill(stablePassword);
  await page.getByRole("button", { name: "Sign In" }).click();

  const forcedChange = page.getByRole("heading", { name: "Change Password" });
  const loginAlert = page.getByRole("alert");
  const shell = page.getByRole("button", { name: "Logout" });
  async function waitForOutcome() {
    await Promise.race([
      forcedChange.waitFor({ state: "visible" }).catch(() => undefined),
      loginAlert.waitFor({ state: "visible" }).catch(() => undefined),
      shell.waitFor({ state: "visible" }).catch(() => undefined),
    ]);
  }
  await waitForOutcome();

  let currentPassword = stablePassword;
  if (await loginAlert.isVisible().catch(() => false)) {
    await passwordInput.fill(INITIAL_PASSWORD);
    await page.getByRole("button", { name: "Sign In" }).click();
    currentPassword = INITIAL_PASSWORD;
    await waitForOutcome();
  }

  if (await forcedChange.isVisible().catch(() => false)) {
    await page.getByLabel("Current / Initial Password").fill(currentPassword);
    await page.getByLabel("New Password", { exact: true }).fill(stablePassword);
    await page.getByLabel("Confirm New Password", { exact: true }).fill(stablePassword);
    await page.getByRole("button", { name: "Save Password" }).click();
  }

  await expect(page.getByRole("button", { name: "Logout" })).toBeVisible();
}

export async function logout(page: Page) {
  await page.getByRole("button", { name: "Logout" }).click();
  await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible();
}
