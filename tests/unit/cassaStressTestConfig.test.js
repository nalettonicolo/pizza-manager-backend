import { describe, expect, it } from "vitest"
import {
  normalizeStressTestConfig,
  STRESS_TEST_DEFAULTS,
  stressTestTipiAttivi,
} from "@/features/operative/cassa/utils/cassaStressTestConfig"

describe("cassaStressTestConfig", () => {
  it("mantiene i default se il raw è vuoto", () => {
    expect(normalizeStressTestConfig({})).toEqual(STRESS_TEST_DEFAULTS)
  })

  it("scambia min/max se invertiti e forza almeno un tipo", () => {
    const cfg = normalizeStressTestConfig({
      targetPizze: 40,
      tickMinSec: 30,
      tickMaxSec: 10,
      ordersMin: 5,
      ordersMax: 2,
      pizzeMin: 4,
      pizzeMax: 1,
      tipi: { negozio: false, delivery: false, online: false },
    })
    expect(cfg.tickMaxSec).toBe(30)
    expect(cfg.ordersMax).toBe(5)
    expect(cfg.pizzeMax).toBe(4)
    expect(cfg.tipi.negozio).toBe(true)
    expect(cfg.targetPizze).toBe(40)
  })

  it("elenca solo i tipi attivi", () => {
    expect(stressTestTipiAttivi({ tipi: { negozio: false, delivery: true, online: false } })).toEqual([
      "delivery",
    ])
  })
})
