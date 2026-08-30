import { describe, it, expect } from "vitest"
import {
  FLUSSI_CONSEGNA,
  FLUSSI_MISMATCH,
  FLUSSI_PERCORSI,
  FLUSSI_REPARTI,
  FLUSSI_STATI,
  FLUSSI_SYNC,
} from "@/features/superadmin/data/flussiOperativi"

describe("flussiOperativi", () => {
  it("copre i cinque reparti operativi", () => {
    expect(FLUSSI_REPARTI.map((r) => r.id)).toEqual(["cassa", "pizzaioli", "cucina", "bancone", "delivery"])
    for (const r of FLUSSI_REPARTI) {
      expect(r.vede.length).toBeGreaterThan(20)
      expect(r.fa.length).toBeGreaterThan(20)
      expect(r.passaggio.length).toBeGreaterThan(20)
      expect(r.percorso).toMatch(/^\/operative\//)
    }
  })

  it("ha percorsi ritiro, domicilio, web e tavolo", () => {
    expect(FLUSSI_PERCORSI.map((p) => p.id)).toEqual(["negozio", "delivery", "web", "tavolo"])
  })

  it("elenca le correzioni applicate con id unici", () => {
    const ids = FLUSSI_MISMATCH.map((m) => m.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toContain("bancone-in-consegna")
    for (const m of FLUSSI_MISMATCH) {
      expect(m.fatto.length).toBeGreaterThan(20)
      expect(m.attesoHint.length).toBeGreaterThan(20)
    }
  })

  it("descrive sync e stati", () => {
    expect(FLUSSI_SYNC.punti.length).toBeGreaterThanOrEqual(3)
    expect(FLUSSI_STATI.length).toBeGreaterThanOrEqual(4)
    expect(FLUSSI_CONSEGNA.length).toBeGreaterThanOrEqual(3)
  })
})
