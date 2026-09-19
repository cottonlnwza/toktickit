import { expect, test } from "@playwright/test";
import {
  ADMIN_PASSWORD,
  STAFF_PASSWORD,
  expectNoHorizontalOverflow,
  loginAndNormalizePassword,
  logout,
} from "./helpers.js";

test("E2E-03 completes Administrator list/search/create/edit/activation/password and safety workflow", async ({ page }, testInfo) => {
  const unique = `${testInfo.project.name}-${Date.now()}`;
  const createdEmail = `issue40.${unique}@example.test`;
  const initialPassword = "Issue40-Initial-2026";
  const resetPassword = "Issue40-Reset-2026";

  await loginAndNormalizePassword(page, "admin@example.test", ADMIN_PASSWORD);
  await expect(page.getByRole("heading", { name: "User Management" })).toBeVisible();
  await expect(page.getByLabel("Search Users")).toBeVisible();
  await expect(page.getByLabel("Role Filter")).toBeVisible();
  await expect(page.getByRole("button", { name: "Delete User" })).toHaveCount(0);

  await page.getByLabel("Search Users").fill("admin@example.test");
  await page.getByLabel("Role Filter").selectOption("ADMINISTRATOR");
  await expect(page.getByText("admin@example.test").filter({ visible: true })).toBeVisible();
  const adminContainer = page.getByText("admin@example.test").filter({ visible: true }).first().locator("xpath=ancestor::*[self::tr or self::article][1]");
  await adminContainer.getByRole("button", { name: "Edit" }).click();
  await expect(page.getByRole("heading", { name: "Edit User" })).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByLabel("Active").uncheck();
  await page.getByRole("button", { name: "Save User" }).click();
  await expect(page.getByRole("alert")).toContainText(/cannot deactivate your own/i);
  await page.getByRole("button", { name: "Close" }).click();

  await page.getByLabel("Search Users").fill("");
  await page.getByLabel("Role Filter").selectOption("");
  await page.getByRole("button", { name: "Create User" }).click();
  await page.getByLabel(/^Name$/).fill(`Issue 40 User ${unique}`);
  await page.getByLabel(/^Email$/).fill(createdEmail);
  await page.getByLabel(/^Role$/).selectOption("REQUESTER");
  await page.getByLabel("Initial Password").fill(initialPassword);
  await page.getByRole("button", { name: "Create User" }).last().click();
  await expect(page.getByRole("status").filter({ hasText: "User created successfully" })).toBeVisible();

  await page.getByLabel("Search Users").fill(createdEmail);
  await expect(page.getByText(createdEmail).filter({ visible: true })).toBeVisible();
  const createdContainer = page.getByText(createdEmail).filter({ visible: true }).first().locator("xpath=ancestor::*[self::tr or self::article][1]");
  await createdContainer.getByRole("button", { name: "Edit" }).click();
  await page.getByLabel(/^Role$/).selectOption("IT_STAFF");
  await page.getByRole("button", { name: "Save User" }).click();
  await expect(page.getByRole("status").filter({ hasText: "User updated successfully" })).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByLabel("Active").uncheck();
  await page.getByRole("button", { name: "Save User" }).click();
  await expect(page.getByRole("status").filter({ hasText: "User updated successfully" })).toBeVisible();
  await page.getByLabel("Active").check();
  await page.getByRole("button", { name: "Save User" }).click();
  await expect(page.getByRole("status").filter({ hasText: "User updated successfully" })).toBeVisible();

  await page.getByLabel("Set New Initial Password").fill(resetPassword);
  await page.getByRole("button", { name: "Apply New Initial Password" }).click();
  await expect(page.getByRole("status").filter({ hasText: "must change it at next login" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await logout(page);

  await loginAndNormalizePassword(page, "it.staff.one@example.test", STAFF_PASSWORD);
  await page.goto("/#user-management");
  await expect(page.getByRole("alert")).toContainText(/Forbidden.*not permitted/i);
  await expect(page.getByText(createdEmail)).toHaveCount(0);
  const directApi = await page.context().request.get("http://localhost:3000/api/admin/users");
  expect(directApi.status()).toBe(403);
  expect(await directApi.text()).not.toContain(createdEmail);
  await expectNoHorizontalOverflow(page);
});

test("E2E-03 keeps Administrator controls accessible by name and keyboard focus", async ({ page }) => {
  await loginAndNormalizePassword(page, "admin@example.test", ADMIN_PASSWORD);
  const search = page.getByLabel("Search Users");
  const filter = page.getByLabel("Role Filter");
  const create = page.getByRole("button", { name: "Create User" });
  await expect(search).toBeVisible();
  await expect(filter).toBeVisible();
  await expect(create).toBeVisible();
  await search.focus();
  await expect(search).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(filter).toBeFocused();
  await expectNoHorizontalOverflow(page);
});
