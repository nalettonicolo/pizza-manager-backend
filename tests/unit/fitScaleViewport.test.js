import { describe, expect, it } from "vitest"
import { fitScaleViewport } from "@/features/operative/utils/fitScaleViewport"

describe("fitScaleViewport", () => {
  it("riduce il design per entrare nel contenitore senza deformare", () => {
    const fit = fitScaleViewport(640, 400, 1280, 800)
    expect(fit.scale).toBe(0.5)
    expect(fit.x).toBe(0)
    expect(fit.y).toBe(0)
  })

  it("centra se le proporzioni non coincidono", () => {
    const fit = fitScaleViewport(1280, 400, 1280, 800)
    expect(fit.scale).toBe(0.5)
    expect(fit.x).toBe(320)
    expect(fit.y).toBe(0)
  })

  it("ignora misure non valide", () => {
    expect(fitScaleViewport(0, 400, 1280, 800).scale).toBe(0)
  })
})
