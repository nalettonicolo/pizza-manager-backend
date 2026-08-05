import { defineConfig, devices } from "@playwright/test"

const baseURL = process.env.E2E_BASE_URL || "https://pizzamanager.it"

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
})
