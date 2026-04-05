import { formatPrice } from "@/utils/format"

export default function CartItem({
  item,
  onIncrease,
  onDecrease,
  onRemove,
}) {
  return (
    <div style={styles.row}>
      <div>
        <strong>{item.nome}</strong>
        {item.impastoNome && (
          <div style={{ fontSize: 11, color: "#2e7d32", marginTop: 2 }}>
            Impasto: {item.impastoNome}
          </div>
        )}
        {item.formatoNome && (
          <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>
            Dimensione: {item.formatoNome}
          </div>
        )}
        {item.cotturaNome && (
          <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>
            Cottura: {item.cotturaNome}
          </div>
        )}
        {item.ingredientiCotturaSummary && (
          <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>
            {item.ingredientiCotturaSummary}
          </div>
        )}
        <div>
          € {formatPrice(item.prezzo)} x {item.qty}
        </div>
      </div>

      <div style={styles.actions}>
        <button type="button" onClick={() => onDecrease(item)}>-</button>
        <button type="button" onClick={() => onIncrease(item)}>+</button>
        <button type="button" onClick={() => onRemove(item)}>🗑</button>
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
  },
}
