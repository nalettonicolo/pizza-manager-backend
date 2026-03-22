import CartItem from "./CartItem"
import { formatPrice } from "@/utils/format"

export default function Cart({
  cart,
  total,
  tipoOrdine,
  deliverySearch,
  onIncrease,
  onDecrease,
  onRemove,
  onCheckout,
  onClear,
  checkoutError,
  loading = false,
}) {
  return (
    <div style={styles.wrapper}>
      <h3>Carrello</h3>

      {cart.length > 0 && tipoOrdine && (
        <p style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>
          {tipoOrdine === "negozio" ? "Ritiro in negozio" : `Consegna${deliverySearch ? `: ${deliverySearch}` : ""}`}
        </p>
      )}

      {cart.length === 0 && (
        <div>Nessun prodotto nel carrello</div>
      )}

      {cart.map((item, idx) => (
        <CartItem
          key={item.id + "-" + idx + (item._modsKey ?? "") + (item.ingredientiCotturaSummary ?? "")}
          item={item}
          onIncrease={onIncrease}
          onDecrease={onDecrease}
          onRemove={onRemove}
        />
      ))}

      <hr />

      <strong>Totale: € {formatPrice(total)}</strong>

      {checkoutError && (
        <div style={{ marginTop: 8, padding: 8, background: "#ffebee", color: "#c62828", borderRadius: 6, fontSize: 13 }}>
          {checkoutError}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        {onClear && (
          <button
            style={{ ...styles.checkout, background: "#666", flex: 1 }}
            onClick={onClear}
          >
            Svuota
          </button>
        )}
        <button
          style={{ ...styles.checkout, flex: 1 }}
          disabled={!cart.length || loading}
          onClick={onCheckout}
        >
          {loading ? "Conferma in corso..." : "Conferma Ordine"}
        </button>
      </div>
    </div>
  )
}

const styles = {
  wrapper: {
    padding: "20px",
    borderLeft: "2px solid #eee",
    height: "100%",
  },
  checkout: {
    marginTop: "15px",
    width: "100%",
    padding: "10px",
    background: "#4caf50",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
  },
}
