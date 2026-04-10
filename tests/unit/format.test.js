import { describe, it, expect } from "vitest"
import { formatPrice, parsePrice } from "../../src/utils/format.js"

describe("formatPrice", () => {
  it("formatta numeri con 2 decimali", () => {
    expect(formatPrice(12.5)).toBe("12.50")
    expect(formatPrice("3")).toBe("3.00")
  })

  it("usa fallback per valori vuoti", () => {
    expect(formatPrice(null)).toBe("—")
    expect(formatPrice(undefined, "n/d")).toBe("n/d")
  })
})

describe("parsePrice", () => {
  it("accetta virgola decimale", () => {
    expect(parsePrice("0,40")).toBeCloseTo(0.4)
  })
})
