import { describe, it, expect } from "vitest"
import {
  QUAD_REPARTI_TEST_EMAIL,
  isQuadRepartiTestEmail,
  canAccessQuadReparti,
} from "@/constants/quadRepartiTest"
import { getOperativeHomePathForStaff } from "@/constants/operativeRoutes"

describe("quadRepartiTest", () => {
  it("riconosce pizzaioli e pizzaiolo @pizzamanager.it", () => {
    expect(isQuadRepartiTestEmail(QUAD_REPARTI_TEST_EMAIL)).toBe(true)
    expect(isQuadRepartiTestEmail("pizzaioli@pizzamanager.it")).toBe(true)
    expect(isQuadRepartiTestEmail("Pizzaiolo@PizzaManager.it")).toBe(true)
    expect(isQuadRepartiTestEmail("pizzaiolo2@pizzamanager.it")).toBe(true)
    expect(isQuadRepartiTestEmail("pizzaioli3@pizzamanager.it")).toBe(true)
  })

  it("non apre le 4 schermate a tenant o altri account", () => {
    expect(isQuadRepartiTestEmail("pizzaiolo@pizzeria.it")).toBe(false)
    expect(isQuadRepartiTestEmail("admin@pizzamanager.it")).toBe(false)
    expect(isQuadRepartiTestEmail("cassa@pizzamanager.it")).toBe(false)
    expect(isQuadRepartiTestEmail("")).toBe(false)
    expect(isQuadRepartiTestEmail(null)).toBe(false)
  })

  it("consente accesso a Super Admin, account test e demo", () => {
    expect(canAccessQuadReparti({ email: "pizzaioli@pizzamanager.it", ruolo: "pizzaiolo" })).toBe(true)
    expect(canAccessQuadReparti({ email: "pizzaiolo@pizzamanager.it", ruolo: "pizzaiolo" })).toBe(true)
    expect(canAccessQuadReparti({ email: "admin@pizzamanager.it", ruolo: "superadmin" })).toBe(true)
    expect(canAccessQuadReparti({ email: "staff@locale.it", ruolo: "pizzaiolo", inDemo: true })).toBe(true)
    expect(canAccessQuadReparti({ email: "staff@locale.it", ruolo: "pizzaiolo" })).toBe(false)
  })

  it("dopo login l'account test pizzaiolo va all'ingresso 4 schermate", () => {
    expect(getOperativeHomePathForStaff("pizzaiolo", "pizzaioli@pizzamanager.it")).toBe(
      "/operative/pizzaiolo-ingresso",
    )
    expect(getOperativeHomePathForStaff("pizzaiolo", "pizzaiolo@pizzamanager.it")).toBe(
      "/operative/pizzaiolo-ingresso",
    )
    expect(getOperativeHomePathForStaff("pizzaiolo", "mario@pizzeria.it")).toBe("/operative/pizzaioli")
  })
})
