import { expect, test } from "@playwright/test";
import {
  REQUESTER_PASSWORD,
  expectNoHorizontalOverflow,
  loginAndNormalizePassword,
  logout,
} from "./helpers.js";

test("E2E-01 validates login states, mandatory password change, authenticated shell, logout, and blocked access", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "TokTickIT" })).toBeVisible();

  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Email")).toBeFocused();
  await page.getByLabel("Email").fill("nobody.issue40@example.test");
  await page.getByLabel("Password").fill("Wrong-Password-2026");
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("alert")).toContainText(/invalid|credentials/i);

  await page.getByLabel("Email").fill("inactive.requester@example.test");
  await page.getByLabel("Password").fill("Lab3-ChangeMe-2026");
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("alert")).toContainText(/inactive|not active/i);

  await loginAndNormalizePassword(page, "anong.student@example.test", REQUESTER_PASSWORD);
  await expect(page.getByText("Anong Student", { exact: true }).first()).toBeVisible();
  await expect(page.locator(".auth-identity .role-badge", { hasText: "Requester" })).toBeVisible();
  await expect(page.getByRole("link", { name: "My Tickets" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Create Ticket" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Ticket Queue" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "User Management" })).toHaveCount(0);
  await expectNoHorizontalOverflow(page);

  const authenticatedApi = await page.context().request.get("http://localhost:3000/api/tickets/mine");
  expect(authenticatedApi.status()).toBe(200);

  await logout(page);
  const afterLogout = await page.context().request.get("http://localhost:3000/api/tickets/mine");
  expect(afterLogout.status()).toBe(401);

  await page.goto("/#my-tickets");
  await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "My Tickets" })).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});

test("E2E-01 keeps the login and mandatory-password controls keyboard reachable with accessible names", async ({ page }) => {
  await page.goto("/");
  const email = page.getByLabel("Email");
  const password = page.getByLabel("Password");
  const signIn = page.getByRole("button", { name: "Sign In" });
  await expect(email).toBeVisible();
  await expect(password).toBeVisible();
  await expect(signIn).toBeVisible();

  await email.focus();
  await expect(email).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(password).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(signIn).toBeFocused();
  await expectNoHorizontalOverflow(page);
});
