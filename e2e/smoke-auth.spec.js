import { test, expect } from "@playwright/test"

/**
 * Scaffold autenticato: SKIP senza E2E_STAFF_EMAIL / E2E_STAFF_PASSWORD.
 * Non esegue pagamenti Stripe.
 */
test.describe("Smoke autenticato (opzionale)", () => {
  test("login staff → area operativa o admin", async ({ page }) => {
    const email = process.env.E2E_STAFF_EMAIL?.trim()
    const password = process.env.E2E_STAFF_PASSWORD?.trim()
    test.skip(!email || !password, "Impostare E2E_STAFF_EMAIL e E2E_STAFF_PASSWORD")

    await page.goto("/login")
    await page.locator('input[type="email"], input[name="email"]').first().fill(email)
    await page.locator('input[type="password"], input[name="password"]').first().fill(password)
    await page.getByRole("button", { name: /accedi|login|entra/i }).first().click()

    await expect(page).not.toHaveURL(/\/login$/, { timeout: 30_000 })
    const path = new URL(page.url()).pathname
    expect(
      path.startsWith("/operative") ||
        path.startsWith("/admin") ||
        path.startsWith("/superadmin") ||
        path.includes("ingresso"),
    ).toBeTruthy()
  })
})
