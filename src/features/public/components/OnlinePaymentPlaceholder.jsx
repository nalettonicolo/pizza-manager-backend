/**
 * Predisposizione pagamenti online (Stripe / SumUp): niente segreti in client;
 * chiavi pubbliche da tenant o da .env per test.
 */
export function describePaymentProvider(tenant) {
  const t = tenant && typeof tenant === "object" ? tenant : {}
  const p = String(t.pagamento_online_provider || "").toLowerCase().trim()
  if (p === "stripe") return "stripe"
  if (p === "sumup") return "sumup"
  return ""
}

export function OnlinePaymentPlaceholder({ tenant, totalEuro }) {
  const provider = describePaymentProvider(tenant)
  const pk = String(tenant?.stripe_publishable_key || "").trim()
  const sumupId = String(tenant?.sumup_merchant_public_id || "").trim()

  return (
    <div
      style={{
        padding: 16,
        borderRadius: 10,
        border: "1px solid #e2e8f0",
        background: "#f8fafc",
        fontSize: 14,
        lineHeight: 1.55,
        color: "#334155",
      }}
    >
      <strong style={{ color: "#0f172a" }}>Pagamento online</strong>
      <p style={{ margin: "10px 0 0" }}>
        Il gestionale è predisposto per integrare <strong>Stripe</strong> e <strong>SumUp</strong>. La scelta definitiva (chiavi,
        commissioni, flusso) si configura con il cliente in fase di messa in produzione.
      </p>
      {provider === "stripe" && pk ? (
        <p style={{ margin: "10px 0 0", fontSize: 13 }}>
          Provider: <strong>Stripe</strong> · chiave pubblica presente (pk_…). Totale ordine:{" "}
          <strong>€ {Number(totalEuro).toFixed(2)}</strong>. L’addebito sarà gestito tramite sessione di pagamento lato server (
          <em>PaymentIntent</em> / Checkout) quando l’endpoint sarà attivo.
        </p>
      ) : provider === "stripe" ? (
        <p style={{ margin: "10px 0 0", color: "#b45309" }}>
          Provider impostato su <strong>Stripe</strong>: aggiungi la chiave pubblica tenant (<code>stripe_publishable_key</code>) in
          database o in Admin.
        </p>
      ) : null}
      {provider === "sumup" && sumupId ? (
        <p style={{ margin: "10px 0 0", fontSize: 13 }}>
          Provider: <strong>SumUp</strong> · merchant id configurato. Totale: <strong>€ {Number(totalEuro).toFixed(2)}</strong>.
        </p>
      ) : provider === "sumup" ? (
        <p style={{ margin: "10px 0 0", color: "#b45309" }}>
          Provider impostato su <strong>SumUp</strong>: aggiungi <code>sumup_merchant_public_id</code> in database.
        </p>
      ) : null}
      {!provider ? (
        <p style={{ margin: "10px 0 0", fontSize: 13, color: "#64748b" }}>
          Nessun provider selezionato sul tenant: usa &quot;Pagamento alla consegna&quot; oppure imposta{" "}
          <code>pagamento_online_provider</code> a <code>stripe</code> o <code>sumup</code>.
        </p>
      ) : null}
    </div>
  )
}
