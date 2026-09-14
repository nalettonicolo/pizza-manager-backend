// Regressione: getTenants() deve provare SEMPRE per primo il set di colonne completo
// (prova_valida_fino, partita_iva, sito_web_cliente, ...), mai il fallback povero
// TENANT_SELECT_LEGACY — quel fallback riesce banalmente (sono colonne che esistono sempre),
// quindi se venisse provato per primo il ciclo non arriverebbe mai a usare quello completo: i
// dati risultano salvati nel database ma sempre "vuoti" riaprendo il form di modifica in
// Superadmin → Clienti (bug osservato in produzione, vedi git blame su questo file).
vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    from: vi.fn(),
  },
}))

import { beforeEach, describe, expect, it, vi } from "vitest"
import { supabase } from "@/lib/supabaseClient"
import { getTenants } from "@/features/superadmin/services/superadminService"

function mockSuccessfulSelect(selectedColsRecorder) {
  supabase.from.mockImplementation(() => ({
    select: (cols) => {
      selectedColsRecorder.push(cols)
      return {
        is: () => ({
          order: () => Promise.resolve({ data: [], error: null }),
        }),
      }
    },
  }))
}

describe("superadminService.getTenants", () => {
  beforeEach(() => {
    supabase.from.mockReset()
    try {
      window.localStorage.clear()
    } catch {
      /* jsdom sempre disponibile nei test unit */
    }
  })

  it("prova per prima la select con tutte le colonne, non il fallback povero", async () => {
    const selectedCols = []
    mockSuccessfulSelect(selectedCols)

    await getTenants()

    expect(selectedCols.length).toBeGreaterThan(0)
    const firstAttempt = selectedCols[0]
    expect(firstAttempt).toMatch(/prova_valida_fino/)
    expect(firstAttempt).toMatch(/partita_iva/)
    expect(firstAttempt).toMatch(/sito_web_cliente/)
  })
})
