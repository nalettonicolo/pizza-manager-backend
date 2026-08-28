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

const TARGET_PIZZE = 100
const TICK_MIN_MS = 20000
const TICK_MAX_MS = 30000

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
  const timerRef = useRef(null)
  const catalogRef = useRef(null)
  const pizzeRef = useRef(0)
  const stopRef = useRef(false)

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

  const buildOrderPayload = useCallback((catalog, n) => {
    const tipo = pickRandom(["negozio", "delivery", "online"])
    const isOnline = tipo === "online"
    const tipoOrdineReale = isOnline ? pickRandom(["negozio", "delivery"]) : tipo
    const isDelivery = tipoOrdineReale === "delivery"

    const nPizze = randInt(1, 3)
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
    const delay = randInt(TICK_MIN_MS, TICK_MAX_MS)
    timerRef.current = window.setTimeout(() => void runTick(), delay)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runTick definita sotto, stabile per closure su ref
  }, [])

  async function runTick() {
    if (stopRef.current || !catalogRef.current) return
    const howMany = randInt(1, 2)
    for (let i = 0; i < howMany; i += 1) {
      if (stopRef.current || pizzeRef.current >= TARGET_PIZZE) break
      const n = pizzeRef.current
      const { payload, pizze } = buildOrderPayload(catalogRef.current, n)
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
    if (!stopRef.current && pizzeRef.current < TARGET_PIZZE) {
      scheduleTick()
    } else {
      setRunning(false)
    }
  }

  const start = async () => {
    if (running || !tenantId) return
    const ok = await appConfirm(
      `Sei sicuro di avviare questa modalità? Verranno creati ordini reali finché non si raggiungono circa ${TARGET_PIZZE} pizze totali (1-2 ordini ogni 20-30s). Da usare solo in tenant demo.`,
      { title: "Stress test ordini", okLabel: "Avvia", cancelLabel: "Annulla", variant: "danger" },
    )
    if (!ok) return
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

  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <button
        type="button"
        onClick={() => (running ? stop() : void start())}
        title={
          running
            ? `In corso: ${ordersCreated} ordini, ${pizzeCreated}/${TARGET_PIZZE} pizze — tocca per fermare`
            : "Simula un carico di ordini casuali (negozio/delivery/online) per stressare il sistema — solo demo"
        }
        style={{
          padding: "6px 12px",
          fontSize: 12,
          fontWeight: 700,
          borderRadius: 8,
          border: "1px solid " + (running ? "#b45309" : "#94a3b8"),
          background: running ? "#fff7ed" : "#fff",
          color: running ? "#b45309" : "#475569",
          cursor: tenantId ? "pointer" : "default",
        }}
        disabled={!tenantId}
      >
        {running ? `⏸ ${pizzeCreated}/${TARGET_PIZZE} pizze` : "▶ Stress test"}
        {error ? " ⚠" : ""}
      </button>
      <button
        type="button"
        onClick={() => void resetStressTest()}
        title="Cancella definitivamente tutti gli ordini creati dallo stress test, per ripartire puliti"
        style={{
          padding: "6px 10px",
          fontSize: 12,
          fontWeight: 700,
          borderRadius: 8,
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
    </div>
  )
}
