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
  onEditPizza,
  onCheckout,
  onClear,
  checkoutError,
  loading = false,
  variant = "default",
}) {
  const mobile = variant === "mobile"
  return (
    <div style={mobile ? styles.wrapperMobile : styles.wrapper}>
      <h3 style={mobile ? { margin: "0 0 12px", fontSize: 20 } : undefined}>Carrello</h3>

      <div style={{ display: "flex", gap: mobile ? 12 : 8, marginBottom: mobile ? 16 : 12 }}>
        {onClear && (
          <button
            type="button"
            style={{
              ...styles.checkout,
              background: "#666",
              flex: 1,
              marginTop: 0,
              ...(mobile ? styles.checkoutMobile : {}),
            }}
            onClick={onClear}
          >
            Svuota
          </button>
        )}
        <button
          type="button"
          style={{ ...styles.checkout, flex: 1, marginTop: 0, ...(mobile ? styles.checkoutMobile : {}) }}
          disabled={!cart.length || loading}
          onClick={onCheckout}
        >
          {loading ? "Conferma in corso..." : "Conferma Ordine"}
        </button>
      </div>

      {cart.length > 0 && tipoOrdine && (
        <p style={{ fontSize: mobile ? 14 : 12, color: "#666", marginBottom: 8, lineHeight: 1.45 }}>
          {tipoOrdine === "negozio" ? "Ritiro in negozio" : `Consegna${deliverySearch ? `: ${deliverySearch}` : ""}`}
        </p>
      )}

      {cart.length === 0 && (
        <div style={mobile ? { fontSize: 16, color: "#64748b", padding: "8px 0 12px" } : undefined}>
          Nessun prodotto nel carrello
        </div>
      )}

      {cart.map((item, idx) => (
        <CartItem
          key={item.id + "-" + idx + (item._modsKey ?? "") + (item.ingredientiCotturaSummary ?? "")}
          item={item}
          onIncrease={onIncrease}
          onDecrease={onDecrease}
          onRemove={onRemove}
          onEditPizza={onEditPizza}
          variant={variant}
        />
      ))}

      <hr />

      <strong style={mobile ? { fontSize: 20, display: "block", marginTop: 8 } : undefined}>
        Totale: € {formatPrice(total)}
      </strong>

      {checkoutError && (
        <div style={{ marginTop: 8, padding: 8, background: "#ffebee", color: "#c62828", borderRadius: 6, fontSize: 13 }}>
          {checkoutError}
        </div>
      )}
    </div>
  )
}

const styles = {
  wrapper: {
    padding: "20px",
    borderLeft: "2px solid #eee",
    height: "100%",
  },
  wrapperMobile: {
    padding: "4px 0 8px",
    borderLeft: "none",
    height: "100%",
    minHeight: 0,
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
  checkoutMobile: {
    minHeight: 48,
    padding: "14px 16px",
    fontSize: 16,
    fontWeight: 700,
    borderRadius: 10,
    marginTop: 0,
  },
}
