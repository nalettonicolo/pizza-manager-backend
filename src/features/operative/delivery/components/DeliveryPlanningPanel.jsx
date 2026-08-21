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

/**
 * Overlay: griglia fasce consegna (5 colonne × N righe dagli orari di oggi).
 */
export default function DeliveryPlanningPanel({ open, onClose, tenantId, orariSettimana }) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [selectedSlotKey, setSelectedSlotKey] = useState(null)

  const orari = useMemo(() => getTodayOrariConsegna(orariSettimana), [orariSettimana])
  const slots = useMemo(() => buildSlotsFullDay(orari), [orari])

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

  const selectedOrders = selectedSlotKey != null ? ordersBySlotKey.get(selectedSlotKey) || [] : []

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
          overflow: "auto",
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
            position: "sticky",
            top: 0,
            zIndex: 1,
          }}
        >
          <div>
            <h2 id="delivery-planning-title" style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#0f172a" }}>
              Planning consegne
            </h2>
            <p style={{ margin: "6px 0 0", fontSize: 13, color: "#64748b", lineHeight: 1.45 }}>
              Fasce da {fonteLabel} ({PLANNING_GRID_SLOT_MINUTES} min) · 5 colonne. Tocca una fascia per il dettaglio.
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

        <div style={{ padding: 16, flex: 1 }}>
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
                display: "grid",
                gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
                gap: 8,
              }}
            >
              {slots.map((slot) => {
                const list = ordersBySlotKey.get(slot.key) || []
                const n = list.length
                const active = selectedSlotKey === slot.key
                return (
                  <button
                    key={slot.key}
                    type="button"
                    onClick={() => setSelectedSlotKey(active ? null : slot.key)}
                    style={{
                      textAlign: "left",
                      minHeight: 72,
                      padding: "10px 10px 8px",
                      borderRadius: 8,
                      border: active ? "2px solid #0d9488" : "1px solid #e2e8f0",
                      background: n > 0 ? (active ? "#ccfbf1" : "#fff") : "#f1f5f9",
                      cursor: "pointer",
                      boxSizing: "border-box",
                    }}
                  >
                    <div style={{ fontWeight: 800, fontSize: 14, color: "#0f172a", marginBottom: 4 }}>
                      {slot.label}
                    </div>
                    <div style={{ fontSize: 12, color: n > 0 ? "#0f766e" : "#94a3b8", fontWeight: 600 }}>
                      {n === 0 ? "Libera" : n === 1 ? "1 consegna" : `${n} consegne`}
                    </div>
                    {n > 0 ? (
                      <div style={{ marginTop: 4, fontSize: 11, color: "#475569", lineHeight: 1.3 }}>
                        {list
                          .slice(0, 2)
                          .map((o) => `#${o.numero ?? "—"}`)
                          .join(" · ")}
                        {n > 2 ? ` · +${n - 2}` : ""}
                      </div>
                    ) : null}
                  </button>
                )
              })}
            </div>
          )}

          {selectedSlotKey != null ? (
            <section
              style={{
                marginTop: 16,
                padding: 14,
                borderRadius: 10,
                border: "1px solid #99f6e4",
                background: "#fff",
              }}
            >
              <h3 style={{ margin: "0 0 10px", fontSize: 15, color: "#0f766e" }}>
                Fascia {slotLabelFromKey(selectedSlotKey)} · {selectedOrders.length}{" "}
                {selectedOrders.length === 1 ? "consegna" : "consegne"}
              </h3>
              {selectedOrders.length === 0 ? (
                <p style={{ margin: 0, color: "#64748b", fontSize: 13 }}>Nessuna consegna in questa fascia.</p>
              ) : (
                <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                  {selectedOrders.map((o) => {
                    const ind = ordineIndirizzo(o)
                    const nome = ordineNome(o)
                    const sc = String(o.stato_consegna ?? o.statoConsegna ?? "").trim()
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
            </section>
          ) : null}
        </div>
      </div>
    </div>
  )
}
