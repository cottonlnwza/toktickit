import { defineConfig, devices } from "@playwright/test";
import { getLab3E2EDatabaseUrl } from "./e2e/lab-03/database.js";

const e2eDatabaseUrl = getLab3E2EDatabaseUrl();

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/lab-03/global-setup.ts",
  outputDir: "test-results",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      command: "npm run dev --prefix server",
      url: "http://localhost:3000/api/health",
      reuseExistingServer: false,
      timeout: 120_000,
      env: { ...process.env, DATABASE_URL: e2eDatabaseUrl, FRONTEND_ORIGIN: "http://localhost:5173" },
    },
    {
      command: "npm run dev --prefix client -- --host localhost",
      url: "http://localhost:5173",
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "tablet", use: { ...devices["Desktop Chrome"], viewport: { width: 820, height: 1180 } } },
    { name: "mobile", use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } } },
  ],
});
