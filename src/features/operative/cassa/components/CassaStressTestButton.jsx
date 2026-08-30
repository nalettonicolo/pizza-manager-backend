import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTenant } from "@/app/contexts/TenantContext"
import { usePv } from "@/app/contexts/PvContext"
import {
  createOrder,
  deleteOrdersByIds,
  getCategories,
  getOrders,
  getProducts,
} from "@/features/admin/services/adminService"
import { appConfirm } from "@/utils/appDialog"
import { buildSlotsFullDay, getTodayOrariConsegna } from "@/features/operative/cassa/utils/planningUtils"
import { resolveDeliveryPolygonOuterRing, pointInPolygonRing } from "@/utils/deliveryArea"
import {
  loadStressTestConfig,
  normalizeStressTestConfig,
  saveStressTestConfig,
  STRESS_TEST_DEFAULTS,
  stressTestTipiAttivi,
} from "@/features/operative/cassa/utils/cassaStressTestConfig"

/** Stessa logica "a esclusione" già usata altrove (adminService/vetrina): una categoria conta
 * come pizza a meno che non sia esplicitamente fritti/dolci/bibite/ingredienti. */
function categoriaEsclusaDaPizza(cat) {
  if (!cat) return false
  const hay = `${cat.slug || ""} ${cat.nome || ""}`.toLowerCase().trim()
  if (!hay) return false
  return (
    hay.includes("fritt") ||
    hay.includes("dolc") ||
    hay.includes("bibit") ||
    hay.includes("bevand") ||
    hay.includes("bevan") ||
    hay.includes("ingredient")
  )
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function pickRandom(list) {
  return list[randInt(0, list.length - 1)]
}

const PAGAMENTI_NEGOZIO = ["Contanti", "Carta"]
const PAGAMENTI_ONLINE = ["Carta online", "Paga online"]

/**
 * Solo area demo: genera un carico di ordini casuali (negozio/delivery/online) usando il vero
 * catalogo del tenant, indirizzi di consegna già usati da ordini reali in passato (mai coordinate
 * inventate) e le vere fasce orarie di oggi dal motore del planning — per stressare davvero i
 * reparti (capacità forno, planning, realtime) invece di dati a caso.
 */
export default function CassaStressTestButton() {
  const { tenantId, tenantData } = useTenant()
  const pvCtx = usePv()
  const activePvId = pvCtx?.activePv ?? null
  const pvList = useMemo(() => pvCtx?.pvList ?? [], [pvCtx?.pvList])
  const [running, setRunning] = useState(false)
  const [ordersCreated, setOrdersCreated] = useState(0)
  const [pizzeCreated, setPizzeCreated] = useState(0)
  const [error, setError] = useState(null)
  const [resetting, setResetting] = useState(false)
  const [configOpen, setConfigOpen] = useState(false)
  const [draft, setDraft] = useState(() => loadStressTestConfig())
  const timerRef = useRef(null)
  const catalogRef = useRef(null)
  const pizzeRef = useRef(0)
  const stopRef = useRef(false)
  const configRef = useRef(loadStressTestConfig())

  useEffect(() => {
    return () => {
      stopRef.current = true
      if (timerRef.current) window.clearTimeout(timerRef.current)
    }
  }, [])

  const loadCatalog = useCallback(async () => {
    const [products, categories, storicoOrdini] = await Promise.all([
      getProducts(tenantId),
      getCategories(tenantId),
      // Storico (non solo oggi) per avere un pool di indirizzi reali già usati da clienti veri —
      // niente coordinate inventate: "vedi quelli attivi nel database".
      getOrders(tenantId, { limit: 300 }),
    ])
    const categoriaById = new Map(categories.map((c) => [c.id, c]))
    const esauriti = new Set(
      Array.isArray(tenantData?.parametri_operativi?.prodotti_esauriti)
        ? tenantData.parametri_operativi.prodotti_esauriti
        : [],
    )
    const disponibili = (products || []).filter((p) => p.attivo !== false && !esauriti.has(p.id))
    const pizze = disponibili.filter((p) => !categoriaEsclusaDaPizza(categoriaById.get(p.categoria_id)))
    const altro = disponibili.filter((p) => categoriaEsclusaDaPizza(categoriaById.get(p.categoria_id)))

    // Un indirizzo comparso in passato non è detto sia ancora dentro l'area di consegna ATTUALE
    // (il poligono può essere stato ridisegnato da allora, o quell'ordine era un'eccezione presa
    // a mano da cassa che bypassa il controllo) — qui invece deve valere la regola vera e attuale,
    // quindi filtriamo anche sul poligono oggi configurato. Il PV attivo può avere un poligono
    // proprio che sostituisce quello di tenant (spesso quello di tenant non è nemmeno configurato
    // sui tenant multi-sede): stessa risoluzione usata dalla mappa consegne live.
    const activePv = pvList.find((p) => String(p.id) === String(activePvId)) ?? null
    const ring = resolveDeliveryPolygonOuterRing(tenantData, activePv)
    const indirizziVisti = new Set()
    const indirizziReali = []
    for (const o of storicoOrdini || []) {
      const ind = String(o.indirizzo_consegna ?? o.indirizzoConsegna ?? "").trim()
      const lat = Number(o.consegna_lat ?? o.consegnaLat)
      const lng = Number(o.consegna_lng ?? o.consegnaLng)
      if (!ind || !Number.isFinite(lat) || !Number.isFinite(lng)) continue
      if (ring && pointInPolygonRing(lng, lat, ring) !== true) continue
      if (indirizziVisti.has(ind)) continue
      indirizziVisti.add(ind)
      indirizziReali.push({ indirizzo: ind, lat, lng })
      if (indirizziReali.length >= 40) break
    }

    // Fasce orarie reali di oggi (stesso motore del planning): solo quelle non ancora passate,
    // altrimenti — se è già sera tardi — tutte quelle di oggi come fallback.
    const orariOggi = getTodayOrariConsegna(tenantData?.orari_settimana)
    const tutteLeFasce = buildSlotsFullDay(orariOggi)
    const now = Date.now()
    const fasceFuture = tutteLeFasce.filter((s) => s.date.getTime() >= now)
    const fasce = fasceFuture.length ? fasceFuture : tutteLeFasce

    return { pizze: pizze.length ? pizze : disponibili, altro, indirizziReali, fasce }
  }, [tenantId, tenantData, pvList, activePvId])

  const buildOrderPayload = useCallback((catalog, n, cfg) => {
    const tipi = stressTestTipiAttivi(cfg)
    const tipo = pickRandom(tipi)
    const isOnline = tipo === "online"
    const tipoOrdineReale = isOnline
      ? pickRandom(tipi.filter((t) => t !== "online").length ? tipi.filter((t) => t !== "online") : ["negozio"])
      : tipo
    const isDelivery = tipoOrdineReale === "delivery"

    const nPizze = randInt(cfg.pizzeMin, cfg.pizzeMax)
    const items = []
    let pizzeInOrdine = 0
    for (let i = 0; i < nPizze; i += 1) {
      const p = pickRandom(catalog.pizze)
      const qty = randInt(1, 2)
      items.push({ prodotto_id: p.id, quantita: qty, prezzo: Number(p.prezzo) || 0 })
      pizzeInOrdine += qty
    }
    if (catalog.altro.length && Math.random() < 0.4) {
      const extra = pickRandom(catalog.altro)
      items.push({ prodotto_id: extra.id, quantita: 1, prezzo: Number(extra.prezzo) || 0 })
    }
    const totale = items.reduce((sum, it) => sum + it.prezzo * it.quantita, 0)

    let consegnaLat = null
    let consegnaLng = null
    let indirizzoConsegna = ""
    let tipoOrdineFinale = tipoOrdineReale
    if (isDelivery) {
      const reale = catalog.indirizziReali.length ? pickRandom(catalog.indirizziReali) : null
      if (reale) {
        consegnaLat = reale.lat
        consegnaLng = reale.lng
        indirizzoConsegna = reale.indirizzo
      } else {
        // Nessun indirizzo reale in storico (tenant nuovo/senza consegne precedenti): niente
        // coordinate inventate, l'ordine resta negozio — rispetta comunque la regola invece di
        // forzare una consegna senza un indirizzo vero dietro.
        tipoOrdineFinale = "negozio"
      }
    }

    const tipoPagamento = isOnline
      ? pickRandom(PAGAMENTI_ONLINE)
      : pickRandom(PAGAMENTI_NEGOZIO)

    const orarioRitiro = catalog.fasce.length ? pickRandom(catalog.fasce).label : ""

    return {
      payload: {
        totale,
        stato: "IN_PREPARAZIONE",
        items,
        note: isOnline ? `Ordine online (stress test #${n})` : `Ordine telefonico (stress test #${n})`,
        tipoPagamento,
        tipoOrdine: tipoOrdineFinale,
        nomeCliente: `Cliente stress test #${n}`,
        orarioRitiro,
        indirizzoConsegna,
        consegnaLat,
        consegnaLng,
      },
      pizze: pizzeInOrdine,
    }
  }, [])

  const scheduleTick = useCallback(() => {
    if (stopRef.current) return
    const cfg = configRef.current
    const delay = randInt(cfg.tickMinSec * 1000, cfg.tickMaxSec * 1000)
    timerRef.current = window.setTimeout(() => void runTick(), delay)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runTick definita sotto, stabile per closure su ref
  }, [])

  async function runTick() {
    if (stopRef.current || !catalogRef.current) return
    const cfg = configRef.current
    const howMany = randInt(cfg.ordersMin, cfg.ordersMax)
    for (let i = 0; i < howMany; i += 1) {
      if (stopRef.current || pizzeRef.current >= cfg.targetPizze) break
      const n = pizzeRef.current
      const { payload, pizze } = buildOrderPayload(catalogRef.current, n, cfg)
      try {
        await createOrder(tenantId, payload)
        pizzeRef.current += pizze
        setPizzeCreated(pizzeRef.current)
        setOrdersCreated((c) => c + 1)
      } catch (e) {
        console.error("[CassaStressTestButton] createOrder:", e)
        setError(e?.message || "Errore creazione ordine")
      }
    }
    if (!stopRef.current && pizzeRef.current < cfg.targetPizze) {
      scheduleTick()
    } else {
      setRunning(false)
    }
  }

  const openConfig = () => {
    if (running || !tenantId) return
    setDraft(loadStressTestConfig())
    setConfigOpen(true)
  }

  const startWithDraft = async () => {
    if (running || !tenantId) return
    const cfg = saveStressTestConfig(draft)
    configRef.current = cfg
    setDraft(cfg)
    setConfigOpen(false)
    setError(null)
    setOrdersCreated(0)
    setPizzeCreated(0)
    pizzeRef.current = 0
    stopRef.current = false
    try {
      catalogRef.current = await loadCatalog()
    } catch (e) {
      setError(e?.message || "Errore caricamento catalogo")
      return
    }
    setRunning(true)
    void runTick()
  }

  const setDraftField = (key, value) => {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  const setDraftTipo = (key, checked) => {
    setDraft((prev) => ({ ...prev, tipi: { ...prev.tipi, [key]: checked } }))
  }

  const stop = () => {
    stopRef.current = true
    if (timerRef.current) window.clearTimeout(timerRef.current)
    setRunning(false)
  }

  /**
   * Cancella (non annulla: proprio via dal database) tutti gli ordini creati dallo stress test,
   * riconoscendoli dalla nota `(stress test #N)` che il generatore scrive su ogni ordine — solo
   * quelli del tenant corrente. Pensato per essere ripetibile prima di ogni nuova prova.
   */
  const resetStressTest = async () => {
    if (!tenantId || running || resetting) return
    const ok = await appConfirm(
      "Sei sicuro di voler cancellare definitivamente tutti gli ordini creati dallo stress test? L'operazione non è reversibile.",
      { title: "Reset stress test", okLabel: "Cancella", cancelLabel: "Annulla", variant: "danger" },
    )
    if (!ok) return
    setResetting(true)
    setError(null)
    try {
      const ordini = await getOrders(tenantId, { limit: 500 })
      const ids = (ordini || [])
        .filter((o) => String(o.note || "").includes("(stress test"))
        .map((o) => o.id)
        .filter(Boolean)
      if (ids.length) await deleteOrdersByIds(tenantId, ids)
      setOrdersCreated(0)
      setPizzeCreated(0)
      pizzeRef.current = 0
    } catch (e) {
      console.error("[CassaStressTestButton] resetStressTest:", e)
      setError(e?.message || "Errore nel reset dello stress test")
    } finally {
      setResetting(false)
    }
  }

  const targetPizze = configRef.current.targetPizze
  const preview = normalizeStressTestConfig(draft)

  return (
    <>
      <button
        type="button"
        className="cassa-action-stress"
        title={
          running
            ? `In corso: ${ordersCreated} ordini, ${pizzeCreated}/${targetPizze} pizze — tocca per fermare`
            : "Apri i parametri e simula un carico di ordini (negozio/delivery/online) — solo demo"
        }
        style={{
          padding: "4px 8px",
          fontSize: 11,
          fontWeight: 700,
          borderRadius: 6,
          border: "1px solid " + (running ? "#b45309" : "#94a3b8"),
          background: running ? "#fff7ed" : "#fff",
          color: running ? "#b45309" : "#475569",
          cursor: tenantId ? "pointer" : "default",
        }}
        disabled={!tenantId}
      >
        {running ? `⏸ ${pizzeCreated}/${targetPizze} pizze` : "▶ Stress test"}
        {error ? " ⚠" : ""}
      </button>
      <button
        type="button"
        className="cassa-action-reset"
        onClick={() => void resetStressTest()}
        title="Cancella definitivamente tutti gli ordini creati dallo stress test, per ripartire puliti"
        style={{
          padding: "4px 8px",
          fontSize: 11,
          fontWeight: 700,
          borderRadius: 6,
          border: "1px solid #94a3b8",
          background: "#fff",
          color: "#475569",
          cursor: tenantId && !running && !resetting ? "pointer" : "default",
          opacity: resetting ? 0.6 : 1,
        }}
        disabled={!tenantId || running || resetting}
      >
        {resetting ? "…" : "🗑 Reset"}
      </button>

      {configOpen ? (
        <div
          className="app-dialog-overlay"
          role="presentation"
          onClick={() => setConfigOpen(false)}
        >
          <div
            className="app-dialog app-dialog--danger"
            role="dialog"
            aria-modal="true"
            aria-labelledby="stress-test-title"
            style={{ width: "min(520px, 100%)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="stress-test-title" className="app-dialog-title">
              Stress test ordini
            </h2>
            <p className="app-dialog-message" style={{ marginBottom: 14 }}>
              Scegli i parametri. Verranno creati ordini reali sul tenant corrente: usalo solo in demo.
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
                marginBottom: 14,
              }}
            >
              <label style={fieldLabel}>
                Tetto pizze
                <input
                  type="number"
                  min={1}
                  max={2000}
                  className="app-dialog-input"
                  style={{ margin: "4px 0 0" }}
                  value={draft.targetPizze}
                  onChange={(e) => setDraftField("targetPizze", e.target.value)}
                />
              </label>
              <label style={fieldLabel}>
                Pizze per ordine (min–max)
                <span style={pairRow}>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    className="app-dialog-input"
                    style={{ margin: 0 }}
                    value={draft.pizzeMin}
                    onChange={(e) => setDraftField("pizzeMin", e.target.value)}
                  />
                  <input
                    type="number"
                    min={1}
                    max={20}
                    className="app-dialog-input"
                    style={{ margin: 0 }}
                    value={draft.pizzeMax}
                    onChange={(e) => setDraftField("pizzeMax", e.target.value)}
                  />
                </span>
              </label>
              <label style={fieldLabel}>
                Secondi tra i cicli (min–max)
                <span style={pairRow}>
                  <input
                    type="number"
                    min={1}
                    max={300}
                    className="app-dialog-input"
                    style={{ margin: 0 }}
                    value={draft.tickMinSec}
                    onChange={(e) => setDraftField("tickMinSec", e.target.value)}
                  />
                  <input
                    type="number"
                    min={1}
                    max={300}
                    className="app-dialog-input"
                    style={{ margin: 0 }}
                    value={draft.tickMaxSec}
                    onChange={(e) => setDraftField("tickMaxSec", e.target.value)}
                  />
                </span>
              </label>
              <label style={fieldLabel}>
                Ordini per ciclo (min–max)
                <span style={pairRow}>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    className="app-dialog-input"
                    style={{ margin: 0 }}
                    value={draft.ordersMin}
                    onChange={(e) => setDraftField("ordersMin", e.target.value)}
                  />
                  <input
                    type="number"
                    min={1}
                    max={20}
                    className="app-dialog-input"
                    style={{ margin: 0 }}
                    value={draft.ordersMax}
                    onChange={(e) => setDraftField("ordersMax", e.target.value)}
                  />
                </span>
              </label>
            </div>
            <fieldset
              style={{
                margin: "0 0 14px",
                padding: "10px 12px",
                border: "1px solid #e2e8f0",
                borderRadius: 10,
              }}
            >
              <legend style={{ fontSize: 12, fontWeight: 700, color: "#475569", padding: "0 6px" }}>
                Tipi di ordine
              </legend>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                {[
                  ["negozio", "Ritiro in negozio"],
                  ["delivery", "Domicilio"],
                  ["online", "Online (vetrina)"],
                ].map(([key, label]) => (
                  <label key={key} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#334155" }}>
                    <input
                      type="checkbox"
                      checked={Boolean(draft.tipi?.[key])}
                      onChange={(e) => setDraftTipo(key, e.target.checked)}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
            <p style={{ margin: "0 0 16px", fontSize: 12, color: "#64748b", lineHeight: 1.45 }}>
              Con questi valori: circa {preview.targetPizze} pizze, {preview.ordersMin}–{preview.ordersMax}{" "}
              ordini ogni {preview.tickMinSec}–{preview.tickMaxSec} secondi, {preview.pizzeMin}–{preview.pizzeMax}{" "}
              pizze per ordine.
            </p>
            <div className="app-dialog-actions">
              <button
                type="button"
                className="app-dialog-btn app-dialog-btn--ghost"
                onClick={() => setDraft({ ...STRESS_TEST_DEFAULTS, tipi: { ...STRESS_TEST_DEFAULTS.tipi } })}
              >
                Ripristina
              </button>
              <button
                type="button"
                className="app-dialog-btn app-dialog-btn--ghost"
                onClick={() => setConfigOpen(false)}
              >
                Annulla
              </button>
              <button
                type="button"
                className="app-dialog-btn app-dialog-btn--primary app-dialog-btn--danger"
                onClick={() => void startWithDraft()}
              >
                Avvia
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

const fieldLabel = {
  display: "flex",
  flexDirection: "column",
  fontSize: 12,
  fontWeight: 700,
  color: "#475569",
}

const pairRow = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 6,
  marginTop: 4,
}
