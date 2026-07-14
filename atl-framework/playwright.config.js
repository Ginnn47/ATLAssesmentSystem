import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 90000,
  retries: 0,
  workers: 1,
  globalSetup: "./tests/helpers/global-setup.js",
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "../Document Output/playwright-report" }],
  ],
  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    viewport: { width: 1366, height: 768 },
  },
  projects: [
    {
      name: "chromium",
      use: {
        browserName: "chromium",
      },
    },
  ],
});
