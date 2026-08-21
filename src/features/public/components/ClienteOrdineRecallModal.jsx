import { useEffect, useState } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { getClienteOrdineDettaglio } from "@/features/public/services/clienteAuthService"
import { usePublicCart } from "@/app/contexts/PublicCartContext"
import {
  orderLineToPublicCartItem,
  orderLinesToPublicCartItems,
} from "@/utils/ordineRecallCart"
import {
  clienteStatoOrdineLabel,
  clienteTipoOrdineLabel,
} from "@/utils/clienteOrdineStato"
import { formatPrice } from "@/utils/format"
import { withPreservedSupportSearch } from "@/utils/supportTenantOverride"

function formatQuando(iso) {
  if (!iso) return "—"
  try {
    return new Date(iso).toLocaleString("it-IT", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return String(iso)
  }
}

/**
 * Modale rapido: dettaglio ordine + aggiungi riga / ripeti ordine → carrello → checkout.
 */
export default function ClienteOrdineRecallModal({ ordineId, onClose }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { addItem, clearCart } = usePublicCart()
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(null)

  useEffect(() => {
    if (!ordineId) return undefined
    let c = false
    setLoading(true)
    setError(null)
    getClienteOrdineDettaglio(ordineId).then(({ data, error: err }) => {
      if (c) return
      if (err) {
        setError(err.message || "Dettaglio non disponibile.")
        setDetail(null)
      } else {
        setDetail(data)
      }
      setLoading(false)
    })
    return () => {
      c = true
    }
  }, [ordineId])

  function goCheckout() {
    const path = withPreservedSupportSearch("/ordina", location.search)
    onClose?.()
    navigate(path)
  }

  function addLine(riga) {
    const item = orderLineToPublicCartItem(riga)
    if (!item) return
    setBusy(riga.id || "line")
    try {
      addItem(item)
    } finally {
      setBusy(null)
    }
  }

  function recallFullOrder() {
    const items = orderLinesToPublicCartItems(detail?.righe || [])
    if (!items.length) return
    setBusy("full")
    try {
      clearCart()
      for (const item of items) {
        addItem(item)
      }
      goCheckout()
    } finally {
      setBusy(null)
    }
  }

  if (!ordineId) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Dettaglio ordine"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "rgba(15, 23, 42, 0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(440px, 100%)",
          maxHeight: "min(85vh, 640px)",
          overflow: "auto",
          background: "#fff",
          borderRadius: 14,
          border: "1px solid #e2e8f0",
          boxShadow: "0 20px 50px rgba(15,23,42,0.2)",
          padding: 18,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>
            {detail ? `Ordine #${detail.numero ?? "—"}` : "Ordine"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Chiudi"
            style={{
              border: "none",
              background: "transparent",
              fontSize: 20,
              cursor: "pointer",
              lineHeight: 1,
              color: "#64748b",
            }}
          >
            ×
          </button>
        </div>

        {loading ? (
          <p style={{ color: "#64748b", fontSize: 14 }}>Caricamento…</p>
        ) : error ? (
          <p role="alert" style={{ color: "#b91c1c", fontSize: 14 }}>
            {error}
          </p>
        ) : detail ? (
          <>
            <p style={{ margin: "0 0 12px", fontSize: 13, color: "#64748b", lineHeight: 1.45 }}>
              {formatQuando(detail.created_at)} · {clienteTipoOrdineLabel(detail.tipo_ordine)} ·{" "}
              {clienteStatoOrdineLabel(detail.stato)}
              {detail.totale != null ? ` · ${formatPrice(Number(detail.totale))}` : ""}
            </p>
            {detail.indirizzo_consegna ? (
              <p style={{ margin: "0 0 12px", fontSize: 13, color: "#334155" }}>
                Consegna: {detail.indirizzo_consegna}
              </p>
            ) : null}

            <ul style={{ listStyle: "none", margin: "0 0 16px", padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
              {(detail.righe || []).map((r) => {
                const label = r.formato_nome
                  ? `${r.prodotto_nome || "Prodotto"} (${r.formato_nome})`
                  : r.prodotto_nome || "Prodotto"
                const summary = String(r.ingredienti_cottura_summary || "").trim()
                const lineBusy = busy === (r.id || "line")
                return (
                  <li
                    key={r.id}
                    style={{
                      border: "1px solid #e2e8f0",
                      borderRadius: 10,
                      padding: "10px 12px",
                      background: "#f8fafc",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <strong style={{ fontSize: 14 }}>
                          {r.quantita}× {label}
                        </strong>
                        {summary ? (
                          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#64748b", lineHeight: 1.4 }}>
                            {summary}
                          </p>
                        ) : null}
                        <p style={{ margin: "4px 0 0", fontSize: 13, fontWeight: 600 }}>
                          {formatPrice(Number(r.prezzo || 0) * Number(r.quantita || 1))}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={Boolean(busy)}
                        onClick={() => addLine(r)}
                        title="Aggiungi questa riga al carrello (con modifiche)"
                        style={{
                          flexShrink: 0,
                          border: "1px solid #cbd5e1",
                          background: "#fff",
                          borderRadius: 8,
                          padding: "8px 10px",
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: busy ? "wait" : "pointer",
                          color: "#0f172a",
                        }}
                      >
                        {lineBusy ? "…" : "Aggiungi"}
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button
                type="button"
                disabled={Boolean(busy) || !(detail.righe || []).length}
                onClick={() => recallFullOrder()}
                style={{
                  border: "none",
                  borderRadius: 10,
                  padding: "12px 14px",
                  fontWeight: 700,
                  fontSize: 14,
                  background: "#0f172a",
                  color: "#fff",
                  cursor: busy ? "wait" : "pointer",
                }}
              >
                {busy === "full" ? "Preparazione…" : "Ripeti ordine completo"}
              </button>
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={goCheckout}
                style={{
                  border: "1px solid #cbd5e1",
                  borderRadius: 10,
                  padding: "11px 14px",
                  fontWeight: 700,
                  fontSize: 14,
                  background: "#fff",
                  color: "#0f172a",
                  cursor: "pointer",
                }}
              >
                Vai al carrello / checkout
              </button>
              <p style={{ margin: 0, fontSize: 12, color: "#64748b", lineHeight: 1.4 }}>
                «Ripeti ordine» svuota il carrello, ripristina le stesse righe (con modifiche salvate) e apre la
                chiusura ordine standard.
              </p>
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
