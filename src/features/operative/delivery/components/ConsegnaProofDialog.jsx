/**
 * Conferma rapida prima di segnare CONSEGNATO: solo «hai consegnato a questo cliente?».
 */
export default function ConsegnaProofDialog({ open, nomeCliente, onCancel, onConfirm, busy }) {
  if (!open) return null

  const nome = String(nomeCliente || "").trim() || "il cliente"

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="consegna-confirm-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(15,23,42,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 380,
          background: "#fff",
          borderRadius: 12,
          padding: 20,
          boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
        }}
      >
        <h2 id="consegna-confirm-title" style={{ margin: "0 0 10px", fontSize: 17 }}>
          Conferma consegna
        </h2>
        <p style={{ margin: "0 0 16px", fontSize: 15, color: "#334155", lineHeight: 1.45 }}>
          Confermi di aver consegnato a <strong>{nome}</strong>?
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            style={{
              flex: 1,
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid #cbd5e1",
              background: "#fff",
              cursor: busy ? "default" : "pointer",
              fontWeight: 600,
            }}
          >
            Annulla
          </button>
          <button
            type="button"
            onClick={() => onConfirm([])}
            disabled={busy}
            style={{
              flex: 1,
              padding: "10px 12px",
              borderRadius: 8,
              border: "none",
              background: "#2196f3",
              color: "#fff",
              fontWeight: 700,
              cursor: busy ? "default" : "pointer",
            }}
          >
            {busy ? "Salvo…" : "Sì, consegnato"}
          </button>
        </div>
      </div>
    </div>
  )
}
