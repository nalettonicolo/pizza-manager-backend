import { formatPrice } from "@/utils/format"

export default function CartItem({
  item,
  onIncrease,
  onDecrease,
  onRemove,
  variant = "default",
}) {
  const mobile = variant === "mobile"
  const metaFs = mobile ? 13 : 11
  const btnStyle = mobile ? styles.actionBtnMobile : styles.actionBtn
  return (
    <div style={styles.row}>
      <div style={mobile ? { flex: 1, minWidth: 0, paddingRight: 8 } : undefined}>
        <strong style={mobile ? { fontSize: 16 } : undefined}>{item.nome}</strong>
        {item.impastoNome && (
          <div style={{ fontSize: metaFs, color: "#2e7d32", marginTop: 2 }}>
            Impasto: {item.impastoNome}
          </div>
        )}
        {item.formatoNome && (
          <div style={{ fontSize: metaFs, color: "#555", marginTop: 2 }}>
            Dimensione: {item.formatoNome}
          </div>
        )}
        {item.cotturaNome && (
          <div style={{ fontSize: metaFs, color: "#555", marginTop: 2 }}>
            Cottura: {item.cotturaNome}
          </div>
        )}
        {item.ingredientiCotturaSummary && (
          <div style={{ fontSize: metaFs, color: "#666", marginTop: 2 }}>
            {item.ingredientiCotturaSummary}
          </div>
        )}
        <div style={{ fontSize: mobile ? 15 : undefined, marginTop: 4 }}>
          € {formatPrice(item.prezzo)} x {item.qty}
        </div>
      </div>

      <div style={styles.actions}>
        <button type="button" style={btnStyle} aria-label="Diminuisci quantità" onClick={() => onDecrease(item)}>
          −
        </button>
        <button type="button" style={btnStyle} aria-label="Aumenta quantità" onClick={() => onIncrease(item)}>
          +
        </button>
        <button type="button" style={btnStyle} aria-label="Rimuovi dal carrello" onClick={() => onRemove(item)}>
          🗑
        </button>
      </div>
    </div>
  )
}

const styles = {
  row: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "10px",
    paddingBottom: "10px",
    borderBottom: "1px solid #eee",
  },
  actions: {
    display: "flex",
    gap: "5px",
    alignItems: "center",
    flexShrink: 0,
  },
  actionBtn: {
    minWidth: 28,
    padding: "4px 8px",
    fontSize: 14,
    cursor: "pointer",
  },
  actionBtnMobile: {
    minWidth: 44,
    minHeight: 44,
    padding: 0,
    fontSize: 20,
    lineHeight: 1,
    borderRadius: 10,
    border: "1px solid #cbd5e1",
    background: "#f8fafc",
    cursor: "pointer",
  },
}
