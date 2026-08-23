import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { supabase } from "@/lib/supabaseClient"
import StripePaymentForm from "@/features/public/components/StripePaymentForm"

/**
 * Pagina di pagamento ospitata, senza login: il link (WhatsApp/SMS) porta qui con l'id della
 * richiesta di pagamento (payment_link_intents.id) registrata da cassa. Tutta la logica vive
 * nell'Edge Function `payment-link-checkout` (nessun accesso diretto alle tabelle da qui).
 */
export default function PagamentoLinkPage() {
  const { intentId } = useParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [checkout, setCheckout] = useState(null)
  const [alreadyPaid, setAlreadyPaid] = useState(false)
  const [justPaid, setJustPaid] = useState(false)

  useEffect(() => {
    if (!intentId) {
      setError("Link non valido.")
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    supabase.functions
      .invoke("payment-link-checkout", { body: { intent_id: intentId } })
      .then(({ data, error: fnErr }) => {
        if (cancelled) return
        if (fnErr || data?.error) {
          setError(data?.error || fnErr?.message || "Link non valido o scaduto.")
          return
        }
        if (data?.alreadyPaid) {
          setAlreadyPaid(true)
          setCheckout(data)
          return
        }
        setCheckout(data)
      })
      .catch((e) => {
        if (!cancelled) setError(e?.message || "Errore di rete. Riprova tra poco.")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [intentId])

  const importo =
    checkout?.importoCent != null ? (Number(checkout.importoCent) / 100).toFixed(2) : null

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        background: "#f8fafc",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 440,
          background: "#fff",
          borderRadius: 14,
          border: "1px solid #e2e8f0",
          boxShadow: "0 8px 30px rgba(15, 23, 42, 0.08)",
          padding: "28px 24px",
        }}
      >
        {checkout?.logoUrl ? (
          <img
            src={checkout.logoUrl}
            alt=""
            style={{ maxHeight: 48, marginBottom: 16, display: "block" }}
          />
        ) : null}
        <h1 style={{ fontSize: 19, margin: "0 0 4px", color: "#0f172a" }}>
          {checkout?.tenantNome || "Pagamento ordine"}
        </h1>
        {checkout?.numero != null ? (
          <p style={{ margin: "0 0 18px", fontSize: 13, color: "#64748b" }}>Ordine #{checkout.numero}</p>
        ) : (
          <div style={{ marginBottom: 18 }} />
        )}

        {loading ? (
          <p style={{ color: "#64748b", fontSize: 14 }}>Caricamento…</p>
        ) : error ? (
          <p style={{ color: "#b91c1c", fontSize: 14, lineHeight: 1.5 }}>{error}</p>
        ) : alreadyPaid || justPaid ? (
          <div>
            <p style={{ fontSize: 15, fontWeight: 600, color: "#166534", margin: "0 0 6px" }}>
              ✓ Pagamento ricevuto
            </p>
            {importo ? (
              <p style={{ fontSize: 13, color: "#475569", margin: 0 }}>Importo: € {importo}</p>
            ) : null}
          </div>
        ) : (
          <>
            {importo ? (
              <p style={{ fontSize: 22, fontWeight: 700, color: "#0f172a", margin: "0 0 14px" }}>
                € {importo}
              </p>
            ) : null}
            <StripePaymentForm
              publishableKey={checkout?.stripePublishableKey}
              clientSecret={checkout?.clientSecret}
              returnPath={`/paga/${intentId}`}
              onSuccess={() => setJustPaid(true)}
              onError={(msg) => setError(msg)}
            />
          </>
        )}
      </div>
    </div>
  )
}
