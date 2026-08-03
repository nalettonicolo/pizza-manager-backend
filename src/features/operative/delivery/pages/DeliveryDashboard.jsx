import { useEffect, useState, useCallback, useRef, useMemo } from "react"
import { Link, useOutletContext } from "react-router-dom"
import { useTenant } from "@/app/contexts/TenantContext"
import {
  getOrders,
  markDeliveryConsegnatoWithProof,
  deliveryUpdateStatoConsegna,
} from "@/features/admin/services/adminService"
import { orarioToSlotLabel, orarioToMinutes } from "@/features/operative/pizzaiolo/utils/pizzaioloUtils"
import { PLANNING_GRID_SLOT_MINUTES } from "@/features/operative/cassa/utils/planningUtils"
import { formatIndirizzoDisplayItaliano } from "@/utils/formatIndirizzoItaliano"
import { useRepartiQuadTest } from "@/features/operative/contexts/RepartiQuadTestContext"
import { sortOrdersByNearestNeighbor } from "@/features/operative/delivery/utils/deliveryRouteUtils"
import ConsegnaProofDialog from "@/features/operative/delivery/components/ConsegnaProofDialog"
import { useOperativeOrdersLiveRefresh } from "@/features/operative/hooks/useOperativeOrdersLiveRefresh"

const STATO_PRONTO = "PRONTO"
const POLL_FALLBACK_MS = 30000

/** Chiave slot per ordini senza orario_ritiro (vista test griglia reparti). */
const SLOT_SENZA_ORARIO = "__senza_orario__"

function ordineRowIsAnnullato(o) {
  return String(o?.stato ?? "").trim().toUpperCase() === "ANNULLATO"
}

function groupDeliveryBySlot(orders, slotMinutes) {
  const map = {}
  for (const o of orders || []) {
    const orario = o.orario_ritiro ?? o.orarioRitiro
    const slot = orarioToSlotLabel(orario, slotMinutes) || SLOT_SENZA_ORARIO
    if (!map[slot]) map[slot] = []
    map[slot].push(o)
  }
  for (const slot of Object.keys(map)) {
    map[slot].sort((a, b) => {
      const ma = orarioToMinutes(a.orario_ritiro ?? a.orarioRitiro) ?? 99999
      const mb = orarioToMinutes(b.orario_ritiro ?? b.orarioRitiro) ?? 99999
      if (ma !== mb) return ma - mb
      return (Number(a.numero) || 0) - (Number(b.numero) || 0)
    })
  }
  return map
}

function sortedSlotKeys(map) {
  const keys = Object.keys(map || {})
  const sorted = keys.filter((k) => k !== SLOT_SENZA_ORARIO).sort((a, b) => {
    const [ha, ma] = a.split(":").map(Number)
    const [hb, mb] = b.split(":").map(Number)
    return (ha || 0) * 60 + (ma || 0) - (hb || 0) * 60 - (mb || 0)
  })
  if (keys.includes(SLOT_SENZA_ORARIO)) sorted.push(SLOT_SENZA_ORARIO)
  return sorted
}

function slotLabel(slot) {
  if (slot === SLOT_SENZA_ORARIO) return "Senza orario"
  return slot
}

function ordineNomeCliente(o) {
  return String(o?.nome_cliente ?? o?.nomeCliente ?? "").trim()
}

function ordineIndirizzoConsegna(o) {
  return String(o?.indirizzo_consegna ?? o?.indirizzoConsegna ?? "").trim()
}

function ordineStatoConsegna(o) {
  return String(o?.stato_consegna ?? o?.statoConsegna ?? "").trim()
}

function isDeliveryTipoOrdine(o) {
  const t = String(o?.tipo_ordine ?? o?.tipoOrdine ?? "").trim().toLowerCase()
  if (t === "delivery" || t === "consegna") return true
  if (t === "negozio" || t === "ritiro") return false
  const ind = String(o?.indirizzo_consegna ?? o?.indirizzoConsegna ?? "").trim()
  return Boolean(ind)
}

function ordineConsegnaLat(o) {
  const v = o?.consegna_lat ?? o?.consegnaLat
  return v != null && Number.isFinite(Number(v)) ? Number(v) : null
}

function ordineConsegnaLng(o) {
  const v = o?.consegna_lng ?? o?.consegnaLng
  return v != null && Number.isFinite(Number(v)) ? Number(v) : null
}

function logDeliveryError(context, err) {
  const msg =
    err == null
      ? "Errore sconosciuto"
      : typeof err === "string"
        ? err
        : [err.message, err.code, err.details, err.hint].filter(Boolean).join(" · ") || String(err)
  console.error(`[DeliveryDashboard] ${context}:`, msg)
}

/**
 * @param {{ mode?: "quadTestBySlot" }} props
 * - default: solo delivery PRONTO (flusso operativo rider).
 * - quadTestBySlot: tutte le delivery di oggi per fascia oraria (pagina test 4 reparti); con credenziali pony/delivery si passerà al flusso reale.
 */
export default function DeliveryDashboard(props) {
  const { mode } = props || {}
  const quadTest = mode === "quadTestBySlot"
  const embedQuad = useRepartiQuadTest()
  /** Vista test a 4 riquadri: niente titoli né testi esplicativi (anche se mode non passato ma dentro provider). */
  const stripQuadChrome = quadTest || embedQuad
  const { operatoreLabel } = useOutletContext() || {}
  const { tenantId } = useTenant()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(null)
  const [proofOrdine, setProofOrdine] = useState(null)
  const [proofBusy, setProofBusy] = useState(false)
  const [riderPos, setRiderPos] = useState(null)
  const loadSeqRef = useRef(0)

  const loadOrders = useCallback(
    async (opts = {}) => {
      const silent = opts.silent === true
      if (!tenantId) {
        setOrders([])
        setLoadError("Tenant non disponibile: impossibile caricare gli ordini.")
        return
      }
      const seq = ++loadSeqRef.current
      if (!silent) setLoading(true)
      try {
        setLoadError(null)
        const data = await getOrders(tenantId, {
          ...(quadTest ? {} : { stato: STATO_PRONTO }),
          todayOnly: true,
          limit: quadTest ? 200 : 80,
        })
        if (seq !== loadSeqRef.current) return
        let rows = (data || []).filter(isDeliveryTipoOrdine).filter((o) => !ordineRowIsAnnullato(o))
        if (quadTest) {
          rows = [...rows].sort((a, b) => {
            const ma = orarioToMinutes(a.orario_ritiro ?? a.orarioRitiro) ?? 99999
            const mb = orarioToMinutes(b.orario_ritiro ?? b.orarioRitiro) ?? 99999
            if (ma !== mb) return ma - mb
            return (Number(a.numero) || 0) - (Number(b.numero) || 0)
          })
        }
        setOrders(rows)
      } catch (err) {
        logDeliveryError("loadOrders", err)
        if (seq === loadSeqRef.current) {
          setOrders([])
          setLoadError(err?.message || "Errore nel caricamento ordini.")
        }
      } finally {
        if (seq === loadSeqRef.current && !silent) setLoading(false)
      }
    },
    [tenantId, quadTest],
  )

  useOperativeOrdersLiveRefresh({
    tenantId,
    onRefresh: () => loadOrders({ silent: true }),
    pollMs: POLL_FALLBACK_MS,
  })

  useEffect(() => {
    if (!navigator.geolocation) return
    const watch = navigator.geolocation.watchPosition(
      (pos) => setRiderPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: false, maximumAge: 60000 },
    )
    return () => navigator.geolocation.clearWatch(watch)
  }, [])

  const setAssegnato = async (ordineId) => {
    if (!ordineId) return
    try {
      await deliveryUpdateStatoConsegna(ordineId, "ASSEGNATO")
      await loadOrders({ silent: true })
    } catch (err) {
      logDeliveryError("setAssegnato", err)
    }
  }

  const setInViaggio = async (ordineId) => {
    if (!ordineId) return
    try {
      await deliveryUpdateStatoConsegna(ordineId, "IN_VIAGGIO")
      await loadOrders({ silent: true })
    } catch (err) {
      logDeliveryError("setInViaggio", err)
    }
  }

  const markConsegnato = async (ordineId) => {
    if (!ordineId) return
    const ord = orders.find((o) => o.id === ordineId)
    setProofOrdine(ord || { id: ordineId })
  }

  const confirmProof = async (prove) => {
    if (!proofOrdine?.id) return
    setProofBusy(true)
    try {
      await markDeliveryConsegnatoWithProof(proofOrdine.id, prove, tenantId)
      setOrders((prev) => prev.filter((o) => o.id !== proofOrdine.id))
      setProofOrdine(null)
    } catch (err) {
      logDeliveryError("markConsegnatoWithProof", err)
      const msg = String(err?.message ?? err ?? "")
      if (/non_autorizzato/i.test(msg)) {
        window.alert(
          "Operazione non consentita per il tuo profilo. Serve un ruolo Delivery/Pony/Cassa o i permessi «Accesso delivery» / «Accesso cassa» in Admin → Dipendenti (Ruolo operativo). Gli account di test multi-reparto sono abilitati dopo l’aggiornamento SQL su Supabase.",
        )
      }
    } finally {
      setProofBusy(false)
    }
  }

  const displayOrders = useMemo(() => {
    if (quadTest) return orders
    return sortOrdersByNearestNeighbor(orders, riderPos)
  }, [orders, quadTest, riderPos])

  const bySlot = useMemo(
    () => groupDeliveryBySlot(displayOrders, PLANNING_GRID_SLOT_MINUTES),
    [displayOrders],
  )
  const slotOrder = useMemo(() => sortedSlotKeys(bySlot), [bySlot])

  const pad = quadTest ? 10 : 24
  const titleSize = quadTest ? 15 : undefined

  const renderOrderCard = (ord, compact) => {
    const nome = ordineNomeCliente(ord)
    const ind = ordineIndirizzoConsegna(ord)
    const sc = ordineStatoConsegna(ord)
    const statoOrd = String(ord.stato ?? "").trim() || "—"
    const lat = ordineConsegnaLat(ord)
    const lng = ordineConsegnaLng(ord)
    const mapsUrl = lat != null && lng != null ? `https://www.google.com/maps?q=${lat},${lng}` : null
    const inViaggio = sc === "IN_VIAGGIO"
    const p = compact ? 10 : 16
    const fs = compact ? 12 : 14
    return (
      <li
        key={ord.id}
        style={{
          border: "1px solid #e0e0e0",
          borderRadius: compact ? 6 : 8,
          padding: p,
          marginBottom: compact ? 8 : 12,
          background: "#fff",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 6,
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <strong style={{ fontSize: compact ? 13 : undefined }}>#{ord.numero ?? ord.id?.slice?.(0, 8) ?? "—"}</strong>
          <span style={{ fontWeight: 600, color: "#2e7d32", fontSize: compact ? 12 : undefined }}>
            € {Number(ord.totale ?? 0).toFixed(2)}
          </span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6, fontSize: compact ? 10 : 11 }}>
          <span style={{ background: "#e3f2fd", padding: "2px 6px", borderRadius: 4, fontWeight: 600 }}>{statoOrd}</span>
          <span style={{ background: "#f3e5f5", padding: "2px 6px", borderRadius: 4 }}>
            Consegna: {sc || "—"}
          </span>
          {(ord.orario_ritiro ?? ord.orarioRitiro) ? (
            <span style={{ background: "#e8f5e9", padding: "2px 6px", borderRadius: 4 }}>
              {ord.orario_ritiro ?? ord.orarioRitiro}
            </span>
          ) : null}
        </div>
        {nome ? <p style={{ fontSize: fs, margin: "0 0 4px", fontWeight: 600 }}>{nome}</p> : null}
        {ind ? (
          <p style={{ fontSize: compact ? 12 : 13, color: "#444", margin: "0 0 6px", lineHeight: 1.4 }}>
            {formatIndirizzoDisplayItaliano(ind)}
          </p>
        ) : null}
        {mapsUrl ? (
          <p style={{ margin: "0 0 6px" }}>
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: compact ? 11 : 13, color: "#1565c0" }}>
              Maps
            </a>
          </p>
        ) : null}
        {ord.note ? (
          <p style={{ fontSize: compact ? 11 : 13, color: "#555", marginBottom: 6 }}>Note: {ord.note}</p>
        ) : null}
        <div style={{ display: "flex", flexWrap: "wrap", gap: compact ? 6 : 8 }}>
          {sc !== "ASSEGNATO" && sc !== "IN_VIAGGIO" && sc !== "CONSEGNATO" ? (
            <button
              type="button"
              onClick={() => setAssegnato(ord.id)}
              style={{
                padding: compact ? "4px 8px" : "8px 16px",
                fontSize: compact ? 11 : undefined,
                background: "#7c3aed",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Assegna
            </button>
          ) : null}
          {!inViaggio ? (
            <button
              type="button"
              onClick={() => setInViaggio(ord.id)}
              style={{
                padding: compact ? "4px 8px" : "8px 16px",
                fontSize: compact ? 11 : undefined,
                background: "#ff9800",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              In viaggio
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => markConsegnato(ord.id)}
            style={{
              padding: compact ? "4px 8px" : "8px 16px",
              fontSize: compact ? 11 : undefined,
              background: "#2196f3",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Consegnato
          </button>
        </div>
      </li>
    )
  }

  return (
    <div style={{ padding: pad }}>
      {!stripQuadChrome ? (
        <>
          <h1
            className={quadTest ? undefined : "dashboard-page-title"}
            style={quadTest ? { fontSize: titleSize, margin: "0 0 6px", lineHeight: 1.25 } : undefined}
          >
            Delivery{operatoreLabel ? ` — ${operatoreLabel}` : ""}
            {quadTest ? <span style={{ fontWeight: 500, color: "#64748b" }}> · test griglia</span> : null}
          </h1>
          {quadTest ? (
            <p style={{ color: "#64748b", marginBottom: 10, lineHeight: 1.45, fontSize: 11 }}>
              Tutte le consegne a domicilio di oggi raggruppate per fascia ({PLANNING_GRID_SLOT_MINUTES} min). Con le credenziali
              pony/delivery useremo il flusso rider dedicato.
            </p>
          ) : (
            <p style={{ color: "#666", marginBottom: 16, lineHeight: 1.55 }}>
              Solo ordini <strong>delivery</strong> in stato <strong>PRONTO</strong> (creati oggi). Compaiono qui quando cucina/pizzaiolo
              segnano l’ordine pronto. Stato consegna su DB: <code>stato_consegna</code> (flusso:{" "}
              <strong>ASSEGNATO</strong> → <strong>IN_VIAGGIO</strong> → <strong>CONSEGNATO</strong>).
              {riderPos ? " Ordine suggerito per vicinanza GPS." : null}{" "}
              <Link to="/operative/delivery/mappa" style={{ color: "#1565c0", fontWeight: 600 }}>
                Mappa live
              </Link>
              {operatoreLabel ? ` · ${operatoreLabel}` : ""}
            </p>
          )}
        </>
      ) : null}

      {loadError ? (
        <p style={{ color: "#c62828", fontWeight: 600, marginBottom: 12 }} role="alert">
          {loadError}
        </p>
      ) : loading && orders.length === 0 ? (
        stripQuadChrome ? null : (
          <p style={{ color: "#888", fontSize: quadTest ? 12 : undefined }}>Caricamento...</p>
        )
      ) : orders.length === 0 ? (
        stripQuadChrome ? null : (
          <p style={{ color: "#888", lineHeight: 1.5, fontSize: quadTest ? 12 : undefined }}>
            {quadTest
              ? "Nessuna consegna a domicilio oggi (ordini annullati esclusi)."
              : "Nessun ordine delivery in stato PRONTO per oggi. Se hai ordini solo \"ritiro in negozio\", restano in Bancone / Pizzaioli; se sono ancora in preparazione, compariranno qui dopo PRONTO."}
          </p>
        )
      ) : quadTest ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {slotOrder.map((slot) => {
            const list = bySlot[slot] || []
            if (!list.length) return null
            return (
              <section key={slot} style={{ borderLeft: "3px solid #0d9488", paddingLeft: 8 }}>
                {stripQuadChrome ? null : (
                  <h2 style={{ margin: "0 0 6px", fontSize: 13, color: "#0f766e", fontWeight: 800 }}>
                    {slotLabel(slot)} · {list.length} {list.length === 1 ? "ordine" : "ordini"}
                  </h2>
                )}
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>{list.map((ord) => renderOrderCard(ord, true))}</ul>
              </section>
            )
          })}
        </div>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>{displayOrders.map((ord) => renderOrderCard(ord, false))}</ul>
      )}
      <ConsegnaProofDialog
        open={Boolean(proofOrdine)}
        ordineNumero={proofOrdine?.numero}
        busy={proofBusy}
        onCancel={() => !proofBusy && setProofOrdine(null)}
        onConfirm={(prove) => void confirmProof(prove)}
      />
    </div>
  )
}
