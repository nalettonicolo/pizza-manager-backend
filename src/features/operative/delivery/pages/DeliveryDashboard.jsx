import { useEffect, useState, useCallback, useRef, useMemo } from "react"
import { Link, useLocation, useOutletContext } from "react-router-dom"
import { useTenant } from "@/app/contexts/TenantContext"
import {
  getOrders,
  markDeliveryConsegnatoWithProof,
  deliveryUpdateStatoConsegna,
  riderEnsureMe,
} from "@/features/admin/services/adminService"
import { filterOrdiniPerPony } from "@/features/operative/delivery/utils/ponyOrderVisibility"
import { consegnaMapsUrl } from "@/utils/consegnaMapsUrl"
import { orarioToSlotLabel, orarioToMinutes } from "@/features/operative/pizzaiolo/utils/pizzaioloUtils"
import { PLANNING_GRID_SLOT_MINUTES } from "@/features/operative/cassa/utils/planningUtils"
import { formatIndirizzoDisplayItaliano } from "@/utils/formatIndirizzoItaliano"
import { useRepartiQuadTest } from "@/features/operative/contexts/RepartiQuadTestContext"
import LiveClock from "@/components/LiveClock"
import { useMediaQuery } from "@/hooks/useMediaQuery"
import { sortOrdersByNearestNeighbor } from "@/features/operative/delivery/utils/deliveryRouteUtils"
import { useRiderPositionSync } from "@/features/operative/delivery/hooks/useRiderPositionSync"
import ConsegnaProofDialog from "@/features/operative/delivery/components/ConsegnaProofDialog"
import DeliveryPlanningPanel from "@/features/operative/delivery/components/DeliveryPlanningPanel"
import { useOperativeOrdersLiveRefresh } from "@/features/operative/hooks/useOperativeOrdersLiveRefresh"
import { canRepartoStampareRicevutaCortesia } from "@/utils/stampaOperativaConfig"
import { printRicevutaCortesiaByOrdineId } from "@/features/operative/cassa/utils/stampaRicevutaCortesia"
import {
  iconTipoPagamentoLista,
  labelTipoPagamentoLista,
  tipoPagamentoInAttesa,
} from "@/features/operative/cassa/utils/cassaPaymentDisplay"

const STATO_PRONTO = "PRONTO"
const POLL_FALLBACK_MS = 8000

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
  const { mode, riderView: riderViewProp, ponyNome: ponyNomeProp } = props || {}
  const ponyNome = typeof ponyNomeProp === "string" ? ponyNomeProp.trim() : ""
  const location = useLocation()
  const quadTest = mode === "quadTestBySlot"
  const embedQuad = useRepartiQuadTest()
  const riderView = riderViewProp === true || location.pathname === "/operative/rider"
  /** Vista test a 4 riquadri / PWA pony: niente titoli né testi esplicativi. */
  const stripQuadChrome = quadTest || embedQuad || riderView
  const { operatoreLabel } = useOutletContext() || {}
  const { tenantId, tenantData } = useTenant()
  const parametri = tenantData?.parametri_operativi || {}
  const showPrintCortesia = canRepartoStampareRicevutaCortesia(parametri, "delivery")
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(null)
  const [proofOrdine, setProofOrdine] = useState(null)
  const [proofBusy, setProofBusy] = useState(false)
  const [cortesiaBusyId, setCortesiaBusyId] = useState(null)
  const [riderPos, setRiderPos] = useState(null)
  const [planningOpen, setPlanningOpen] = useState(false)
  const [myRiderId, setMyRiderId] = useState(null)
  const loadSeqRef = useRef(0)

  useEffect(() => {
    if (!tenantId || !riderView) {
      setMyRiderId(null)
      return undefined
    }
    if (!ponyNome) {
      setMyRiderId(null)
      return undefined
    }
    let cancelled = false
    riderEnsureMe(tenantId, ponyNome)
      .then((id) => {
        if (!cancelled) setMyRiderId(id || null)
      })
      .catch(() => {
        if (!cancelled) setMyRiderId(null)
      })
    return () => {
      cancelled = true
    }
  }, [tenantId, riderView, ponyNome])

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
        // delivery_mark_consegnato aggiorna solo stato_consegna/stato_delivery, non lo stato
        // ordine "top level" (che resta PRONTO di proposito — Bancone lo usa per distinguere un
        // ritiro in negozio ancora da consegnare). Senza questo filtro, un ordine appena segnato
        // Consegnato spariva subito (rimozione ottimistica locale) ma poi RIAPPARIVA al refresh
        // successivo, perché tornava a matchare stato=PRONTO (o, in quadTest, nessun filtro stato
        // lato server): qui lo escludiamo esplicitamente lato client.
        let rows = (data || [])
          .filter(isDeliveryTipoOrdine)
          .filter((o) => !ordineRowIsAnnullato(o))
          .filter((o) => ordineStatoConsegna(o) !== "CONSEGNATO")
          // Difesa extra: stato "top level" ordine è ora la fonte definitiva di chiusura (dal
          // modulo 72_chiudi_giornata_chiude_ordini.sql — delivery_mark_consegnato aggiorna anche
          // core.ordini.stato, non solo stato_consegna). Se per qualsiasi motivo i due campi
          // risultassero temporaneamente disallineati (es. un vecchio ordine chiuso da un'altra
          // via mentre stato_consegna era rimasto indietro), lo stato generale vince sempre:
          // un ordine con stato CONSEGNATO non deve mai comparire come ancora da consegnare.
          .filter((o) => String(o?.stato ?? "").trim().toUpperCase() !== "CONSEGNATO")
        if (riderView && !quadTest) {
          rows = filterOrdiniPerPony(rows, { riderId: myRiderId })
        }
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
    [tenantId, quadTest, riderView, myRiderId],
  )

  useOperativeOrdersLiveRefresh({
    tenantId,
    onRefresh: () => loadOrders({ silent: true }),
    pollMs: POLL_FALLBACK_MS,
  })

  useEffect(() => {
    if (tenantId && riderView && myRiderId) void loadOrders({ silent: true })
  }, [tenantId, riderView, myRiderId, loadOrders])

  const { position: syncedRiderPos } = useRiderPositionSync()
  useEffect(() => {
    if (syncedRiderPos) setRiderPos(syncedRiderPos)
  }, [syncedRiderPos])

  // "Assegna" e "In viaggio" erano due click separati: su richiesta dell'utente li abbiamo
  // uniti in uno solo — il fattorino che prende in carico l'ordine è di fatto già in viaggio,
  // non ha senso fargli confermare due volte. Un solo tasto porta direttamente a IN_VIAGGIO.
  const setInViaggio = async (ordineId) => {
    if (!ordineId) return
    try {
      await deliveryUpdateStatoConsegna(ordineId, "IN_VIAGGIO", {
        nome: ponyNome || undefined,
      })
      await loadOrders({ silent: true })
    } catch (err) {
      logDeliveryError("setInViaggio", err)
      const msg = String(err?.message ?? err ?? "")
      if (/ordine_gia_preso/i.test(msg)) {
        window.alert("Questa consegna l'ha già presa un altro pony.")
        await loadOrders({ silent: true })
      }
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
    const visible =
      riderView && !quadTest ? filterOrdiniPerPony(orders, { riderId: myRiderId }) : orders
    if (quadTest) return visible
    return sortOrdersByNearestNeighbor(visible, riderPos)
  }, [orders, quadTest, riderPos, riderView, myRiderId])

  const bySlot = useMemo(
    () => groupDeliveryBySlot(displayOrders, PLANNING_GRID_SLOT_MINUTES),
    [displayOrders],
  )
  const slotOrder = useMemo(() => sortedSlotKeys(bySlot), [bySlot])

  const riderNarrow = useMediaQuery("(max-width: 719px)")
  const pad = riderView ? 0 : quadTest ? 10 : 24
  const titleSize = quadTest ? 15 : undefined

  const renderOrderCard = (ord, compact) => {
    const nome = ordineNomeCliente(ord)
    const ind = ordineIndirizzoConsegna(ord)
    const sc = ordineStatoConsegna(ord)
    const statoOrd = String(ord.stato ?? "").trim() || "—"
    const lat = ordineConsegnaLat(ord)
    const lng = ordineConsegnaLng(ord)
    const mapsUrl = consegnaMapsUrl({ lat, lng, indirizzo: ind })
    const p = compact ? 10 : 16
    const fs = compact ? 12 : 14
    const tipoPagamento = ord.tipo_pagamento ?? ord.tipoPagamento ?? ""
    const pagamentoInAttesa = tipoPagamentoInAttesa(tipoPagamento)
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
            alignItems: "flex-start",
            marginBottom: 6,
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <strong style={{ fontSize: compact ? 13 : undefined }}>#{ord.numero ?? ord.id?.slice?.(0, 8) ?? "—"}</strong>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
            <span style={{ fontWeight: 600, color: "#2e7d32", fontSize: compact ? 12 : undefined }}>
              € {Number(ord.totale ?? 0).toFixed(2)}
            </span>
            {mapsUrl ? (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: compact ? 11 : 12,
                  fontWeight: 700,
                  color: "#1565c0",
                  background: "#e3f2fd",
                  border: "1px solid #90caf9",
                  borderRadius: 6,
                  padding: compact ? "3px 7px" : "4px 9px",
                  textDecoration: "none",
                }}
              >
                📍 Maps
              </a>
            ) : null}
          </div>
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
        {nome && mapsUrl ? (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: fs, margin: "0 0 4px", fontWeight: 600, color: "#1565c0", display: "inline-block" }}
            title="Apri la mappa della consegna"
          >
            {nome}
          </a>
        ) : nome ? (
          <p style={{ fontSize: fs, margin: "0 0 4px", fontWeight: 600 }}>{nome}</p>
        ) : null}
        {ind ? (
          <p style={{ fontSize: compact ? 12 : 13, color: "#444", margin: "0 0 6px", lineHeight: 1.4 }}>
            {formatIndirizzoDisplayItaliano(ind)}
          </p>
        ) : null}
        {tipoPagamento ? (
          <p
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: compact ? 14 : 16,
              fontWeight: 800,
              margin: "0 0 8px",
              padding: compact ? "6px 8px" : "8px 10px",
              borderRadius: 8,
              background: pagamentoInAttesa ? "#fff3e0" : "#e8f5e9",
              color: pagamentoInAttesa ? "#e65100" : "#1b5e20",
              border: `1px solid ${pagamentoInAttesa ? "#ffb74d" : "#a5d6a7"}`,
            }}
          >
            <span>{iconTipoPagamentoLista(tipoPagamento)}</span>
            <span>{labelTipoPagamentoLista(tipoPagamento)}</span>
            {pagamentoInAttesa ? <span style={{ fontWeight: 600, fontSize: compact ? 11 : 12 }}>· da confermare</span> : null}
          </p>
        ) : null}
        {ord.note ? (
          <p style={{ fontSize: compact ? 11 : 13, color: "#555", marginBottom: 6 }}>Note: {ord.note}</p>
        ) : null}
        <div className={riderView ? "rider-pwa-actions" : undefined} style={riderView ? undefined : { display: "flex", flexWrap: "wrap", gap: compact ? 6 : 8 }}>
          {sc !== "IN_VIAGGIO" && sc !== "CONSEGNATO" ? (
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
              🛵 In consegna
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
          {showPrintCortesia ? (
            <button
              type="button"
              disabled={cortesiaBusyId === ord.id}
              onClick={async () => {
                if (!ord.id || cortesiaBusyId) return
                setCortesiaBusyId(ord.id)
                try {
                  await printRicevutaCortesiaByOrdineId(tenantId, ord.id, tenantData)
                } catch (err) {
                  logDeliveryError("printRicevutaCortesia", err)
                  window.alert("Impossibile stampare la ricevuta di cortesia. Riprova.")
                } finally {
                  setCortesiaBusyId(null)
                }
              }}
              style={{
                padding: compact ? "4px 8px" : "8px 16px",
                fontSize: compact ? 11 : undefined,
                background: "#fff",
                color: "#1565c0",
                border: "1px solid #90caf9",
                borderRadius: 6,
                cursor: cortesiaBusyId === ord.id ? "wait" : "pointer",
                fontWeight: 600,
                opacity: cortesiaBusyId === ord.id ? 0.7 : 1,
              }}
            >
              {cortesiaBusyId === ord.id ? "Stampa…" : "Ricevuta cortesia"}
            </button>
          ) : null}
        </div>
      </li>
    )
  }

  return (
    <div className={riderView ? "rider-pwa-body" : undefined} style={riderView ? undefined : { padding: pad }}>
      {stripQuadChrome && !riderView ? (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 6 }}>
          <LiveClock style={{ fontSize: 11, padding: "2px 8px", minHeight: 22, borderRadius: 6 }} />
        </div>
      ) : null}
      {riderView ? (
        <div className="rider-pwa-actions" style={{ marginBottom: 12 }}>
          <button
            type="button"
            onClick={() => setPlanningOpen(true)}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid #0d9488",
              background: "#0d9488",
              color: "#fff",
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Planning consegne
          </button>
        </div>
      ) : null}
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
            <>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 12, alignItems: "center" }}>
                <button
                  type="button"
                  onClick={() => setPlanningOpen(true)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 8,
                    border: "1px solid #0d9488",
                    background: "#0d9488",
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  Planning consegne
                </button>
                <Link
                  to="/operative/delivery/mappa"
                  style={{
                    padding: "8px 14px",
                    borderRadius: 8,
                    border: "1px solid #90caf9",
                    background: "#fff",
                    color: "#1565c0",
                    fontWeight: 700,
                    fontSize: 13,
                    textDecoration: "none",
                  }}
                >
                  Mappa live
                </Link>
              </div>
              {null}
            </>
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
        null
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
        <ul
          className={riderView ? "rider-pwa-orders" : undefined}
          style={riderView ? undefined : { listStyle: "none", padding: 0, margin: 0 }}
        >
          {displayOrders.map((ord) => renderOrderCard(ord, riderView ? riderNarrow : false))}
        </ul>
      )}
      <ConsegnaProofDialog
        open={Boolean(proofOrdine)}
        nomeCliente={ordineNomeCliente(proofOrdine)}
        busy={proofBusy}
        onCancel={() => !proofBusy && setProofOrdine(null)}
        onConfirm={(prove) => void confirmProof(prove)}
      />
      {!stripQuadChrome || riderView ? (
        <DeliveryPlanningPanel
          open={planningOpen}
          onClose={() => setPlanningOpen(false)}
          tenantId={tenantId}
          orariSettimana={tenantData?.orari_settimana}
        />
      ) : null}
    </div>
  )
}
