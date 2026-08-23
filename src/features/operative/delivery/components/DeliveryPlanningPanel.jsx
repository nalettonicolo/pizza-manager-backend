import { useEffect, useMemo, useState } from "react"
import {
  buildSlotsFullDay,
  getTodayOrariConsegna,
  PLANNING_GRID_SLOT_MINUTES,
  slotKeyForDate,
} from "@/features/operative/cassa/utils/planningUtils"
import { orarioToMinutes } from "@/features/operative/pizzaiolo/utils/pizzaioloUtils"
import { formatIndirizzoDisplayItaliano } from "@/utils/formatIndirizzoItaliano"
import { getOrders } from "@/features/admin/services/adminService"

function isDeliveryTipoOrdine(o) {
  const t = String(o?.tipo_ordine ?? o?.tipoOrdine ?? "").trim().toLowerCase()
  if (t === "delivery" || t === "consegna") return true
  if (t === "negozio" || t === "ritiro") return false
  return Boolean(String(o?.indirizzo_consegna ?? o?.indirizzoConsegna ?? "").trim())
}

function ordineIsAnnullato(o) {
  return String(o?.stato ?? "").trim().toUpperCase() === "ANNULLATO"
}

function ordineNome(o) {
  return String(o?.nome_cliente ?? o?.nomeCliente ?? "").trim()
}

function ordineIndirizzo(o) {
  return String(o?.indirizzo_consegna ?? o?.indirizzoConsegna ?? "").trim()
}

function slotLabelFromKey(key) {
  if (key == null) return "—"
  const d = new Date(Number(key))
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })
}

function capacityTier(n, warnAt = 3, fullAt = 5) {
  if (n >= fullAt) return "full"
  if (n >= warnAt) return "warn"
  if (n > 0) return "ok"
  return "empty"
}

/**
 * Planning consegne — ibrido D+C: heatmap fasce (sinistra) + elenco consegne (destra).
 */
export default function DeliveryPlanningPanel({ open, onClose, tenantId, orariSettimana }) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [selectedSlotKey, setSelectedSlotKey] = useState(null)
  const [narrow, setNarrow] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 900px)").matches,
  )

  const orari = useMemo(() => getTodayOrariConsegna(orariSettimana), [orariSettimana])
  const slots = useMemo(() => buildSlotsFullDay(orari), [orari])

  useEffect(() => {
    if (typeof window === "undefined") return undefined
    const mq = window.matchMedia("(max-width: 900px)")
    const onChange = () => setNarrow(mq.matches)
    onChange()
    mq.addEventListener?.("change", onChange)
    return () => mq.removeEventListener?.("change", onChange)
  }, [])

  useEffect(() => {
    if (!open) {
      setSelectedSlotKey(null)
      return
    }
    let cancelled = false
    ;(async () => {
      if (!tenantId) {
        setOrders([])
        setError("Locale non disponibile.")
        return
      }
      setLoading(true)
      setError(null)
      try {
        const data = await getOrders(tenantId, { todayOnly: true, limit: 200 })
        if (cancelled) return
        const rows = (data || []).filter(isDeliveryTipoOrdine).filter((o) => !ordineIsAnnullato(o))
        setOrders(rows)
      } catch (err) {
        if (!cancelled) {
          setOrders([])
          setError(err?.message || "Impossibile caricare le consegne.")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, tenantId])

  const ordersBySlotKey = useMemo(() => {
    const map = new Map()
    for (const o of orders) {
      const orario = o.orario_ritiro ?? o.orarioRitiro
      let key = null
      if (orario) {
        const mins = orarioToMinutes(orario)
        if (mins != null) {
          const d = new Date()
          d.setHours(Math.floor(mins / 60), mins % 60, 0, 0)
          key = slotKeyForDate(d, PLANNING_GRID_SLOT_MINUTES)
        }
      }
      if (key == null) continue
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(o)
    }
    for (const list of map.values()) {
      list.sort((a, b) => (Number(a.numero) || 0) - (Number(b.numero) || 0))
    }
    return map
  }, [orders])

  const heatmap = useMemo(() => {
    const hoursSet = new Set()
    const minsSet = new Set()
    const byHm = new Map()
    for (const slot of slots) {
      const d = slot.date instanceof Date ? slot.date : new Date(Number(slot.key))
      if (Number.isNaN(d.getTime())) continue
      const h = d.getHours()
      const m = d.getMinutes()
      hoursSet.add(h)
      minsSet.add(m)
      byHm.set(`${h}:${m}`, slot)
    }
    return {
      hours: [...hoursSet].sort((a, b) => a - b),
      mins: [...minsSet].sort((a, b) => a - b),
      byHm,
    }
  }, [slots])

  const listOrders = useMemo(() => {
    if (selectedSlotKey != null) return ordersBySlotKey.get(selectedSlotKey) || []
    return orders
      .slice()
      .sort((a, b) => {
        const ma = orarioToMinutes(a.orario_ritiro ?? a.orarioRitiro) ?? 9999
        const mb = orarioToMinutes(b.orario_ritiro ?? b.orarioRitiro) ?? 9999
        return ma - mb || (Number(a.numero) || 0) - (Number(b.numero) || 0)
      })
  }, [selectedSlotKey, ordersBySlotKey, orders])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  if (!open) return null

  const fonteLabel =
    orari.fonte === "consegna" ? "orari di consegna di oggi" : "orari di apertura di oggi"

  const cellStyle = (tier, active) => ({
    minHeight: 48,
    borderRadius: 8,
    border: active ? "2px solid #0f766e" : "1px solid #cbd5e1",
    background:
      tier === "full"
        ? "#fef2f2"
        : tier === "warn"
          ? "#fffbeb"
          : tier === "ok"
            ? "#ecfdf5"
            : "#f1f5f9",
    padding: "6px 4px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    cursor: "pointer",
    fontFamily: "inherit",
  })

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delivery-planning-title"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1200,
        background: "rgba(15, 23, 42, 0.45)",
        display: "flex",
        alignItems: "stretch",
        justifyContent: "center",
        padding: "min(24px, 3vw)",
        boxSizing: "border-box",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(1100px, 100%)",
          maxHeight: "100%",
          overflow: "hidden",
          background: "#f8fafc",
          borderRadius: 12,
          boxShadow: "0 12px 40px rgba(0,0,0,0.22)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <header
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
            padding: "16px 18px 12px",
            borderBottom: "1px solid #e2e8f0",
            background: "#fff",
            flexShrink: 0,
          }}
        >
          <div>
            <h2 id="delivery-planning-title" style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#0f172a" }}>
              Planning consegne
            </h2>
            <p style={{ margin: "6px 0 0", fontSize: 13, color: "#64748b", lineHeight: 1.45 }}>
              Heatmap fasce ({fonteLabel}) · elenco a destra. Tocca una cella per filtrare.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Chiudi planning"
            style={{
              flexShrink: 0,
              width: 36,
              height: 36,
              borderRadius: 8,
              border: "1px solid #cbd5e1",
              background: "#fff",
              cursor: "pointer",
              fontWeight: 700,
              fontSize: 16,
              color: "#334155",
            }}
          >
            ✕
          </button>
        </header>

        <div style={{ padding: 16, flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
          {error ? (
            <p role="alert" style={{ color: "#c62828", fontWeight: 600 }}>
              {error}
            </p>
          ) : null}
          {loading ? <p style={{ color: "#64748b", marginBottom: 12 }}>Caricamento consegne…</p> : null}

          {!slots.length ? (
            <p style={{ color: "#64748b" }}>Nessuna fascia disponibile per gli orari di oggi.</p>
          ) : (
            <div
              style={{
                flex: 1,
                minHeight: 0,
                display: "grid",
                gridTemplateColumns: narrow ? "1fr" : "minmax(240px, 0.9fr) minmax(280px, 1.1fr)",
                gridTemplateRows: narrow ? "minmax(160px, 40%) minmax(200px, 1fr)" : undefined,
                gap: 12,
              }}
            >
              <div
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: 10,
                  padding: 12,
                  background: "#fff",
                  overflow: "auto",
                  minHeight: 0,
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    color: "#475569",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    marginBottom: 8,
                  }}
                >
                  Fasce
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: `36px repeat(${Math.max(1, heatmap.mins.length)}, minmax(40px, 1fr))`,
                    gap: 5,
                  }}
                >
                  <div />
                  {heatmap.mins.map((m) => (
                    <div
                      key={`m${m}`}
                      style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: "#64748b" }}
                    >
                      :{String(m).padStart(2, "0")}
                    </div>
                  ))}
                  {heatmap.hours.map((h) => (
                    <div key={`row-${h}`} style={{ display: "contents" }}>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 800,
                          color: "#0f172a",
                          display: "flex",
                          alignItems: "center",
                        }}
                      >
                        {String(h).padStart(2, "0")}
                      </div>
                      {heatmap.mins.map((m) => {
                        const slot = heatmap.byHm.get(`${h}:${m}`)
                        if (!slot) {
                          return (
                            <div
                              key={`${h}-${m}`}
                              style={{
                                minHeight: 48,
                                borderRadius: 8,
                                border: "1px dashed #e2e8f0",
                              }}
                            />
                          )
                        }
                        const list = ordersBySlotKey.get(slot.key) || []
                        const n = list.length
                        const tier = capacityTier(n)
                        const active = selectedSlotKey === slot.key
                        return (
                          <button
                            key={slot.key}
                            type="button"
                            onClick={() => setSelectedSlotKey(active ? null : slot.key)}
                            style={cellStyle(tier, active)}
                            title={`${slot.label} · ${n} consegne`}
                          >
                            <span style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>
                              {n > 0 ? n : "·"}
                            </span>
                            <span style={{ fontSize: 10, fontWeight: 600, color: "#64748b" }}>
                              {slot.label?.replace?.(/\./g, ":") || slotLabelFromKey(slot.key)}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  ))}
                </div>
                <p style={{ margin: "10px 0 0", fontSize: 11, color: "#64748b" }}>
                  {selectedSlotKey != null
                    ? `Fascia ${slotLabelFromKey(selectedSlotKey)} — clic di nuovo per tutta la giornata`
                    : "Clic su una fascia per filtrare l’elenco"}
                </p>
              </div>

              <div
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: 10,
                  padding: 12,
                  background: "#fff",
                  overflow: "auto",
                  minHeight: 0,
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    color: "#475569",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    marginBottom: 10,
                  }}
                >
                  {selectedSlotKey != null
                    ? `Consegne · ${slotLabelFromKey(selectedSlotKey)}`
                    : "Consegne · giornata"}
                  {" · "}
                  {listOrders.length}
                </div>
                {listOrders.length === 0 ? (
                  <p style={{ margin: 0, color: "#94a3b8", fontSize: 13 }}>
                    Nessuna consegna{selectedSlotKey != null ? " in questa fascia" : ""}.
                  </p>
                ) : (
                  <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                    {listOrders.map((o) => {
                      const ind = ordineIndirizzo(o)
                      const nome = ordineNome(o)
                      const sc = String(o.stato_consegna ?? o.statoConsegna ?? "").trim()
                      const orario = o.orario_ritiro ?? o.orarioRitiro
                      return (
                        <li
                          key={o.id}
                          style={{
                            padding: "10px 12px",
                            borderRadius: 8,
                            border: "1px solid #e2e8f0",
                            background: "#f8fafc",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                            <strong>#{o.numero ?? "—"}</strong>
                            <span style={{ fontSize: 12, color: "#64748b" }}>
                              {selectedSlotKey == null && orario ? `${orario} · ` : ""}
                              {String(o.stato ?? "—")}
                              {sc ? ` · ${sc}` : ""}
                            </span>
                          </div>
                          {nome ? <div style={{ fontSize: 13, marginTop: 4, fontWeight: 600 }}>{nome}</div> : null}
                          {ind ? (
                            <div style={{ fontSize: 12, color: "#475569", marginTop: 2 }}>
                              {formatIndirizzoDisplayItaliano(ind)}
                            </div>
                          ) : null}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
