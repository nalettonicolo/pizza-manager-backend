import assert from "node:assert"
import { describe, it } from "node:test"
import {
  fidelitySkippedByPromoCalendario,
  promoRuleAppliesToProduct,
  ruleMatchesTimeWindow,
} from "../src/utils/promozioniCalendario.js"

describe("promozioniCalendario", () => {
  it("fascia a cavallo di mezzanotte: 23:30 dentro 22:00–02:00", () => {
    const rule = { ora_inizio: "22:00", ora_fine: "02:00" }
    const d = new Date(2026, 3, 5, 23, 30, 0)
    assert.strictEqual(ruleMatchesTimeWindow(rule, d), true)
  })

  it("fascia a cavallo di mezzanotte: 01:00 dentro 22:00–02:00", () => {
    const rule = { ora_inizio: "22:00", ora_fine: "02:00" }
    const d = new Date(2026, 3, 6, 1, 0, 0)
    assert.strictEqual(ruleMatchesTimeWindow(rule, d), true)
  })

  it("promoRuleAppliesToProduct rispetta categoria", () => {
    const rule = {
      giorno_settimana: 0,
      ora_inizio: "10:00",
      ora_fine: "20:00",
      categoria_ids: ["cat1"],
      attivo: true,
    }
    const now = new Date(2026, 3, 6, 12, 0, 0)
    assert.strictEqual(promoRuleAppliesToProduct({ categoria_id: "cat1" }, rule, now), true)
    assert.strictEqual(promoRuleAppliesToProduct({ categoria_id: "cat2" }, rule, now), false)
  })

  it("fidelitySkippedByPromoCalendario se regola con disabilita_fidelity", () => {
    const po = {
      promozioni_calendario: [
        {
          giorno_settimana: 0,
          ora_inizio: "00:00",
          ora_fine: "23:59",
          disabilita_fidelity: true,
          categoria_ids: [],
          attivo: true,
        },
      ],
    }
    const now = new Date(2026, 3, 6, 12, 0, 0)
    assert.strictEqual(fidelitySkippedByPromoCalendario(po, [{ categoria_id: "x", id: "p1" }], now), true)
  })
})
