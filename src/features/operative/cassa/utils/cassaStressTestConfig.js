const STORAGE_KEY = "pm_cassa_stress_test_cfg_v1"

export const STRESS_TEST_DEFAULTS = {
  targetPizze: 100,
  tickMinSec: 20,
  tickMaxSec: 30,
  ordersMin: 1,
  ordersMax: 2,
  pizzeMin: 1,
  pizzeMax: 3,
  tipi: { negozio: true, delivery: true, online: true },
}

function clampInt(value, min, max, fallback) {
  const n = Number.parseInt(String(value), 10)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

/**
 * Normalizza i parametri scelti nel modale (min ≤ max, almeno un tipo).
 * @param {Partial<typeof STRESS_TEST_DEFAULTS>} raw
 */
export function normalizeStressTestConfig(raw) {
  const src = raw && typeof raw === "object" ? raw : {}
  const tipiSrc = src.tipi && typeof src.tipi === "object" ? src.tipi : {}
  let tickMinSec = clampInt(src.tickMinSec, 1, 300, STRESS_TEST_DEFAULTS.tickMinSec)
  let tickMaxSec = clampInt(src.tickMaxSec, 1, 300, STRESS_TEST_DEFAULTS.tickMaxSec)
  if (tickMaxSec < tickMinSec) tickMaxSec = tickMinSec
  let ordersMin = clampInt(src.ordersMin, 1, 20, STRESS_TEST_DEFAULTS.ordersMin)
  let ordersMax = clampInt(src.ordersMax, 1, 20, STRESS_TEST_DEFAULTS.ordersMax)
  if (ordersMax < ordersMin) ordersMax = ordersMin
  let pizzeMin = clampInt(src.pizzeMin, 1, 20, STRESS_TEST_DEFAULTS.pizzeMin)
  let pizzeMax = clampInt(src.pizzeMax, 1, 20, STRESS_TEST_DEFAULTS.pizzeMax)
  if (pizzeMax < pizzeMin) pizzeMax = pizzeMin
  const tipi = {
    negozio: tipiSrc.negozio !== false,
    delivery: tipiSrc.delivery !== false,
    online: tipiSrc.online !== false,
  }
  if (!tipi.negozio && !tipi.delivery && !tipi.online) tipi.negozio = true
  return {
    targetPizze: clampInt(src.targetPizze, 1, 2000, STRESS_TEST_DEFAULTS.targetPizze),
    tickMinSec,
    tickMaxSec,
    ordersMin,
    ordersMax,
    pizzeMin,
    pizzeMax,
    tipi,
  }
}

export function loadStressTestConfig() {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...STRESS_TEST_DEFAULTS, tipi: { ...STRESS_TEST_DEFAULTS.tipi } }
    return normalizeStressTestConfig(JSON.parse(raw))
  } catch {
    return { ...STRESS_TEST_DEFAULTS, tipi: { ...STRESS_TEST_DEFAULTS.tipi } }
  }
}

export function saveStressTestConfig(cfg) {
  const next = normalizeStressTestConfig(cfg)
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
  return next
}

export function stressTestTipiAttivi(cfg) {
  const tipi = normalizeStressTestConfig(cfg).tipi
  const list = []
  if (tipi.negozio) list.push("negozio")
  if (tipi.delivery) list.push("delivery")
  if (tipi.online) list.push("online")
  return list.length ? list : ["negozio"]
}
