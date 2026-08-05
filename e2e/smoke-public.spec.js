import { test, expect } from "@playwright/test"

test.describe("Smoke pubblico hosting", () => {
  test("home SaaS risponde 200 e contiene bundle Vite", async ({ page }) => {
    const res = await page.goto("/")
    expect(res?.status()).toBeLessThan(400)
    await expect(page.locator("body")).toBeVisible()
    const html = await page.content()
    expect(html).toMatch(/\/assets\/index-[A-Za-z0-9_-]+\.js/)
  })

  test("pagina contatti caricabile", async ({ page }) => {
    const res = await page.goto("/contatti")
    expect(res?.status()).toBeLessThan(400)
    await expect(page.locator("body")).toBeVisible()
  })

  test("login caricabile", async ({ page }) => {
    const res = await page.goto("/login")
    expect(res?.status()).toBeLessThan(400)
    await expect(page.locator("body")).toBeVisible()
    await expect(page.locator('input[type="email"], input[name="email"], input[type="text"]').first()).toBeVisible({
      timeout: 15_000,
    })
  })

  test("privacy caricabile", async ({ page }) => {
    const res = await page.goto("/privacy")
    expect(res?.status()).toBeLessThan(400)
    await expect(page.locator("body")).toBeVisible()
  })

  test("negozio caricabile", async ({ page }) => {
    const res = await page.goto("/negozio")
    expect(res?.status()).toBeLessThan(400)
    await expect(page.locator("body")).toBeVisible()
  })
})
