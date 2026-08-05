import { formatIndirizzoDisplayItaliano } from "@/utils/formatIndirizzoItaliano"

/**
 * Modale dettaglio ordine (righe, cliente, orario, formato).
 * Usato da Cucina, Bancone, Pizzaiolo.
 * ingredientsByProduct: opzionale { [prodottoId]: string[] } per mostrare ingredienti (es. da Pizzaioli).
 * showPrintCortesia / onPrintCortesia: ricevuta non fiscale (config Impostazioni → flusso stampa).
 */
export default function OrderDetailModal({
  order,
  onClose,
  actionLabel,
  onAction,
  actionDisabled,
  loading,
  ingredientsByProduct,
  showPrintCortesia = false,
  onPrintCortesia,
  printCortesiaBusy = false,
}) {
  if (!order && !loading) return null
  const ord = order || {}
  const ingMap = ingredientsByProduct || {}

  return (
    <div
      style={styles.overlay}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Dettaglio ordine"
    >
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h3 style={styles.title}>Ordine #{ord.numero ?? "—"}</h3>
          <button type="button" style={styles.closeBtn} onClick={onClose} aria-label="Chiudi">
            ✕
          </button>
        </div>

        {loading ? (
          <p style={styles.muted}>Caricamento...</p>
        ) : (
          <>
            <p style={styles.tipo}>
              {ord.tipo_ordine === "delivery" ? "Consegna" : "Ritiro in negozio"}
            </p>
            {ord.tipo_ordine === "delivery" && ord.indirizzo_consegna && (
              <p style={styles.indirizzo}>
                Indirizzo: {formatIndirizzoDisplayItaliano(ord.indirizzo_consegna)}
              </p>
            )}
            {ord.tipo_ordine === "negozio" && (
              <>
                {ord.nome_cliente && (
                  <p style={styles.cliente}>Cliente: <strong>{ord.nome_cliente}</strong></p>
                )}
                {ord.orario_ritiro && (
                  <p style={styles.orario}>Orario ritiro: {ord.orario_ritiro}</p>
                )}
              </>
            )}
            {ord.note && (
              <p style={styles.note}>Note: {ord.note}</p>
            )}

            <ul style={styles.righeList}>
              {(ord.righe || []).map((r, i) => {
                const pid = r.prodottoId ?? r.prodotto_id
                const nomeProdotto = ord.productNames?.[pid] ?? "—"
                const formatoNome = r.formatoNome ?? r.formato_nome
                const label = formatoNome ? `${nomeProdotto} (${formatoNome})` : nomeProdotto

                const rawList = ingMap[pid]
                let ingText = ""
                if (Array.isArray(rawList) && rawList.length > 0) {
                  if (typeof rawList[0] === "string") {
                    ingText = rawList.filter(Boolean).join(", ")
                  } else {
                    ingText = rawList
                      .map((ing) => (typeof ing === "string" ? ing : ing?.nome))
                      .filter(Boolean)
                      .join(", ")
                  }
                }

                return (
                  <li key={r.id || i} style={styles.riga}>
                    <div>
                      <span>{label} x {r.quantita}</span>
                      {ingText ? <div style={styles.rigaIngredienti}>{ingText}</div> : null}
                    </div>
                    <span>€ {(Number(r.prezzo) * (r.quantita || 1)).toFixed(2)}</span>
                  </li>
                )
              })}
            </ul>

            <p style={styles.totale}>
              Totale: € {typeof ord.totale === "number" ? ord.totale.toFixed(2) : ord.totale ?? "—"}
            </p>

            <div style={styles.actions}>
              {showPrintCortesia && onPrintCortesia ? (
                <button
                  type="button"
                  style={{
                    ...styles.cortesiaBtn,
                    ...(printCortesiaBusy || actionDisabled ? styles.actionBtnDisabled : {}),
                  }}
                  onClick={() => !printCortesiaBusy && !actionDisabled && onPrintCortesia()}
                  disabled={printCortesiaBusy || actionDisabled}
                >
                  {printCortesiaBusy ? "Stampa in corso…" : "Stampa ricevuta di cortesia"}
                </button>
              ) : null}
              {actionLabel && onAction ? (
                <button
                  type="button"
                  style={{ ...styles.actionBtn, ...(actionDisabled ? styles.actionBtnDisabled : {}) }}
                  onClick={() => !actionDisabled && onAction(ord.id)}
                  disabled={actionDisabled}
                >
                  {actionLabel}
                </button>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.4)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    padding: 16,
  },
  modal: {
    background: "#fff",
    borderRadius: 12,
    padding: 20,
    maxWidth: 420,
    width: "100%",
    maxHeight: "90vh",
    overflow: "auto",
    boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
  },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  title: { margin: 0, fontSize: 18 },
  closeBtn: {
    background: "none",
    border: "none",
    fontSize: 18,
    cursor: "pointer",
    padding: "4px 8px",
    color: "#666",
  },
  tipo: { margin: "0 0 8px", color: "#666", fontSize: 14 },
  indirizzo: { margin: "0 0 12px", fontWeight: 500, fontSize: 14 },
  cliente: { margin: "0 0 4px", fontWeight: 500, fontSize: 14 },
  orario: { margin: "0 0 12px", color: "#555", fontSize: 14 },
  note: { margin: "0 0 12px", fontSize: 13, fontStyle: "italic", color: "#555" },
  righeList: {
    listStyle: "none",
    padding: 0,
    margin: "0 0 12px",
    borderTop: "1px solid #eee",
    paddingTop: 12,
  },
  riga: { display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 14 },
  rigaIngredienti: { fontSize: 12, color: "#666", marginTop: 2 },
  totale: { fontWeight: 600, marginBottom: 16, fontSize: 16 },
  actions: { display: "flex", flexDirection: "column", gap: 8 },
  actionBtn: {
    padding: "10px 20px",
    background: "#2e7d32",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 600,
    width: "100%",
  },
  cortesiaBtn: {
    padding: "10px 20px",
    background: "#fff",
    color: "#1565c0",
    border: "1px solid #90caf9",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 600,
    width: "100%",
  },
  actionBtnDisabled: { opacity: 0.7, cursor: "not-allowed" },
  muted: { color: "#888", margin: 0 },
}
