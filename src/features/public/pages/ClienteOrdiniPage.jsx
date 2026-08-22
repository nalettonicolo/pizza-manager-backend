import { useEffect, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import Loader from "@/components/feedback/Loader"
import ErrorState from "@/components/feedback/ErrorState"
import { listClienteOrdini, getClienteOrdineDettaglio } from "@/features/public/services/clienteAuthService"
import { finalizeSumUpCheckoutOrdine } from "@/features/public/services/onlinePaymentService"
import {
  clientePagamentoLabel,
  clienteStatoOrdineLabel,
  clienteTipoOrdineLabel,
} from "@/utils/clienteOrdineStato"
import { formatPrice } from "@/utils/format"
import { resolveClienteVetrinaPath } from "@/utils/clienteVetrinaPath"

function formatDateTime(value) {
  if (!value) return "—"
  const raw = String(value).trim()
  // orario_ritiro può essere un semplice orario "HH:MM" (es. impostato da Cassa con "Sposta
  // orario"), non una data completa — new Date("19:15") è Invalid Date in JS. Mostralo com'è.
  if (/^\d{1,2}:\d{2}$/.test(raw)) return raw
  try {
    const d = new Date(raw)
    if (Number.isNaN(d.getTime())) return raw
    return d.toLocaleString("it-IT", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return raw
  }
}

function statoBadgeStyle(stato) {
  const s = String(stato ?? "").toUpperCase()
  if (s === "ANNULLATO") return { background: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca" }
  if (s === "CONSEGNATO") return { background: "#ecfdf5", color: "#166534", border: "1px solid #bbf7d0" }
  if (s === "PRONTO") return { background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe" }
  if (s === "IN_PREPARAZIONE") return { background: "#fff7ed", color: "#c2410c", border: "1px solid #fed7aa" }
  return { background: "#f8fafc", color: "#475569", border: "1px solid #e2e8f0" }
}

export default function ClienteOrdiniPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const nuovoId = searchParams.get("nuovo")
  const sumupReturn = searchParams.get("sumup") === "1"

  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState(null)
  const [sumupConfirming, setSumupConfirming] = useState(false)
  const [sumupMessage, setSumupMessage] = useState(null)

  useEffect(() => {
    let c = false
    ;(async () => {
      setLoading(true)
      setError(null)
      const { data, error: err } = await listClienteOrdini()
      if (c) return
      if (err) {
        setError(err.message || "Impossibile caricare gli ordini.")
        setOrders([])
      } else {
        setOrders(data)
      }
      setLoading(false)
    })()
    return () => {
      c = true
    }
  }, [])

  useEffect(() => {
    if (!nuovoId) return
    openDetail(nuovoId)
  }, [nuovoId])

  useEffect(() => {
    if (!sumupReturn || !nuovoId) return
    let cancelled = false
    ;(async () => {
      setSumupConfirming(true)
      setSumupMessage(null)
      try {
        await finalizeSumUpCheckoutOrdine(nuovoId)
        if (cancelled) return
        setSumupMessage("Pagamento SumUp confermato. Il tuo ordine è in preparazione.")
        const { data } = await listClienteOrdini()
        if (!cancelled && data) setOrders(data)
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev)
          next.delete("sumup")
          return next
        }, { replace: true })
      } catch (err) {
        if (!cancelled) {
          setSumupMessage(err?.message || "Conferma pagamento SumUp non riuscita.")
        }
      } finally {
        if (!cancelled) setSumupConfirming(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [sumupReturn, nuovoId, setSearchParams])

  async function openDetail(ordineId) {
    setDetailLoading(true)
    setDetailError(null)
    const { data, error: err } = await getClienteOrdineDettaglio(ordineId)
    setDetailLoading(false)
    if (err) {
      setDetailError(err.message || "Dettaglio non disponibile.")
      setDetail(null)
      return
    }
    setDetail(data)
  }

  function closeDetail() {
    setDetail(null)
    setDetailError(null)
    if (nuovoId) {
      searchParams.delete("nuovo")
      setSearchParams(searchParams, { replace: true })
    }
  }

  if (loading) return <Loader />

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "24px 16px 48px" }}>
      <h1 style={{ fontSize: 22, marginBottom: 8 }}>I miei ordini</h1>
      <p style={{ color: "#64748b", lineHeight: 1.6, marginBottom: 20, fontSize: 14 }}>
        Storico ordini effettuati online con il tuo account.
      </p>

      {sumupConfirming ? (
        <p role="status" style={{ marginBottom: 16, padding: 12, borderRadius: 8, background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1d4ed8", fontSize: 14 }}>
          Conferma pagamento SumUp in corso…
        </p>
      ) : null}
      {sumupMessage ? (
        <p
          role="status"
          style={{
            marginBottom: 16,
            padding: "12px 14px",
            borderRadius: 8,
            background: sumupMessage.includes("confermato") ? "#ecfdf5" : "#fef2f2",
            border: `1px solid ${sumupMessage.includes("confermato") ? "#bbf7d0" : "#fecaca"}`,
            color: sumupMessage.includes("confermato") ? "#166534" : "#991b1b",
            fontSize: 14,
          }}
        >
          {sumupMessage}
        </p>
      ) : null}

      {nuovoId && !detail && !detailLoading && !sumupReturn ? (
        <p
          role="status"
          style={{
            marginBottom: 16,
            padding: "12px 14px",
            borderRadius: 8,
            background: "#ecfdf5",
            border: "1px solid #bbf7d0",
            color: "#166534",
            fontSize: 14,
          }}
        >
          Ordine inviato correttamente. Controlla lo stato qui sotto.
        </p>
      ) : null}

      {error ? <ErrorState message={error} /> : null}

      {!error && orders.length === 0 ? (
        <div
          style={{
            padding: 20,
            borderRadius: 10,
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            marginBottom: 20,
          }}
        >
          <p style={{ margin: 0, color: "#64748b", lineHeight: 1.6 }}>
            Non hai ancora ordini online collegati a questo account. Quando ordini dal menù, li troverai qui.
          </p>
          <Link
            to={resolveClienteVetrinaPath(typeof window !== "undefined" ? window.location.search : "")}
            style={{ display: "inline-block", marginTop: 12, color: "#c0392b", fontWeight: 600 }}
          >
            Vai al menù →
          </Link>
        </div>
      ) : null}

      {!error && orders.length > 0 ? (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
          {orders.map((o) => {
            const isNew = nuovoId && o.id === nuovoId
            return (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => openDetail(o.id)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "14px 16px",
                    borderRadius: 10,
                    border: isNew ? "2px solid #22c55e" : "1px solid #e2e8f0",
                    background: isNew ? "#f0fdf4" : "#fff",
                    cursor: "pointer",
                    font: "inherit",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <strong style={{ fontSize: 15 }}>Ordine #{o.numero ?? "—"}</strong>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        padding: "2px 8px",
                        borderRadius: 999,
                        ...statoBadgeStyle(o.stato),
                      }}
                    >
                      {clienteStatoOrdineLabel(o.stato)}
                    </span>
                  </div>
                  <p style={{ margin: "8px 0 0", fontSize: 13, color: "#64748b" }}>
                    {formatDateTime(o.created_at)} · {clienteTipoOrdineLabel(o.tipo_ordine)} ·{" "}
                    {clientePagamentoLabel(o.tipo_pagamento, o.online_payment)}
                  </p>
                  <p style={{ margin: "6px 0 0", fontSize: 15, fontWeight: 700, color: "#0f172a" }}>
                    {formatPrice(Number(o.totale ?? 0))}
                  </p>
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}

      {detailLoading ? (
        <div style={{ marginTop: 24 }}>
          <Loader />
        </div>
      ) : null}

      {detailError ? (
        <p role="alert" style={{ marginTop: 16, color: "#b91c1c" }}>
          {detailError}
        </p>
      ) : null}

      {detail ? (
        <div
          role="dialog"
          aria-labelledby="cliente-ordine-detail-title"
          style={{
            marginTop: 24,
            padding: 20,
            borderRadius: 12,
            border: "1px solid #e2e8f0",
            background: "#fff",
            boxShadow: "0 4px 24px rgba(15,23,42,0.08)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <h2 id="cliente-ordine-detail-title" style={{ fontSize: 18, margin: 0 }}>
              Ordine #{detail.numero ?? "—"}
            </h2>
            <button
              type="button"
              onClick={closeDetail}
              aria-label="Chiudi dettaglio"
              style={{
                border: "none",
                background: "#f1f5f9",
                borderRadius: 8,
                padding: "6px 10px",
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              Chiudi
            </button>
          </div>

          <p style={{ margin: "12px 0 0", fontSize: 13, color: "#64748b" }}>
            {formatDateTime(detail.created_at)} ·{" "}
            <span style={{ ...statoBadgeStyle(detail.stato), padding: "2px 8px", borderRadius: 999, fontWeight: 600 }}>
              {clienteStatoOrdineLabel(detail.stato)}
            </span>
          </p>

          <dl style={{ fontSize: 14, lineHeight: 1.7, margin: "16px 0" }}>
            <dt style={{ color: "#64748b", fontWeight: 600 }}>Tipo</dt>
            <dd style={{ margin: "0 0 10px" }}>{clienteTipoOrdineLabel(detail.tipo_ordine)}</dd>
            <dt style={{ color: "#64748b", fontWeight: 600 }}>Pagamento</dt>
            <dd style={{ margin: "0 0 10px" }}>
              {clientePagamentoLabel(detail.tipo_pagamento, detail.online_payment)}
            </dd>
            {detail.orario_ritiro ? (
              <>
                <dt style={{ color: "#64748b", fontWeight: 600 }}>Orario previsto</dt>
                <dd style={{ margin: "0 0 10px" }}>{formatDateTime(detail.orario_ritiro)}</dd>
              </>
            ) : null}
            {detail.indirizzo_consegna ? (
              <>
                <dt style={{ color: "#64748b", fontWeight: 600 }}>Indirizzo</dt>
                <dd style={{ margin: "0 0 10px" }}>{detail.indirizzo_consegna}</dd>
              </>
            ) : null}
            {detail.note ? (
              <>
                <dt style={{ color: "#64748b", fontWeight: 600 }}>Note</dt>
                <dd style={{ margin: "0 0 10px", whiteSpace: "pre-wrap" }}>{detail.note}</dd>
              </>
            ) : null}
          </dl>

          <h3 style={{ fontSize: 15, margin: "0 0 10px" }}>Prodotti</h3>
          <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {(detail.righe || []).map((r) => (
              <li
                key={r.id}
                style={{
                  padding: "10px 0",
                  borderTop: "1px solid #f1f5f9",
                  fontSize: 14,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span>
                    {r.quantita}× {r.prodotto_nome || "Prodotto"}
                    {r.formato_nome ? ` (${r.formato_nome})` : ""}
                  </span>
                  <span style={{ fontWeight: 600 }}>{formatPrice(Number(r.prezzo ?? 0) * Number(r.quantita ?? 1))}</span>
                </div>
                {r.ingredienti_cottura_summary ? (
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: "#64748b" }}>{r.ingredienti_cottura_summary}</p>
                ) : null}
              </li>
            ))}
          </ul>

          <p style={{ marginTop: 16, fontSize: 16, fontWeight: 700, textAlign: "right" }}>
            Totale {formatPrice(Number(detail.totale ?? 0))}
          </p>
        </div>
      ) : null}

      <p style={{ marginTop: 28 }}>
        <Link
          to={resolveClienteVetrinaPath(typeof window !== "undefined" ? window.location.search : "")}
          style={{ color: "#c0392b", fontWeight: 600 }}
        >
          ← Torna al menù
        </Link>
      </p>
    </div>
  )
}
