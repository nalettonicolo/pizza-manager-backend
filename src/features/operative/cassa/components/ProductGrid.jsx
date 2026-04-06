import React from "react"
import PropTypes from "prop-types"

export default function ProductGrid({
  products = [],
  ingredientiMap = {},
  rowBackground = "#f3f9f4",
  onAdd,
  onModifica,
  canAdd = true,
  showModifica = true,
  disabledProductIds = new Set(),
  storefront = false,
}) {
  const disabledSet = disabledProductIds instanceof Set ? disabledProductIds : new Set(disabledProductIds || [])
  if (!products.length) {
    return (
      <div className="p-4 text-gray-500">
        Nessun prodotto disponibile
      </div>
    )
  }

  return (
    <div style={styles.list}>
      {products.map((product) => {
        const ingredienti = ingredientiMap?.[product.id] || []
        const descrizione = ingredienti.join(", ")
        const isDisabled = disabledSet.has(product.id)
        return (
          <div
            key={product.id}
            style={{
              ...styles.row,
              background: rowBackground,
              opacity: isDisabled ? 0.75 : 1,
              ...(storefront ? { boxShadow: "0 1px 3px rgba(0,0,0,0.08)" } : {}),
            }}
          >
            <div style={styles.rowLeft}>
              <div style={styles.pizzaNameRow}>
                <span style={styles.pizzaName}>{product.nome}</span>
                {isDisabled && (
                  <span style={styles.esauritoBadge}>Esaurito</span>
                )}
              </div>
              {descrizione && (
                <p style={styles.pizzaDesc}>{descrizione}</p>
              )}
            </div>
            <div style={styles.rowRight}>
              {product.prezzo_listino_originale != null &&
              Number(product.prezzo_listino_originale) > Number(product.prezzo) ? (
                <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
                  <span style={{ fontSize: 12, color: "#94a3b8", textDecoration: "line-through" }}>
                    € {Number(product.prezzo_listino_originale).toFixed(2)}
                  </span>
                  <span style={styles.price}>€ {Number(product.prezzo).toFixed(2)}</span>
                  {!storefront ? (
                    <span style={{ fontSize: 10, fontWeight: 600, color: "#0f766e" }}>Promo</span>
                  ) : null}
                </span>
              ) : (
                <span style={styles.price}>€ {Number(product.prezzo).toFixed(2)}</span>
              )}
              {canAdd && showModifica && !isDisabled && (
                <button
                  type="button"
                  style={styles.editBtn}
                  onClick={(e) => {
                    e.stopPropagation()
                    onModifica?.(product)
                  }}
                >
                  Modifica pizza
                </button>
              )}
              {canAdd ? (
                <button
                  type="button"
                  style={isDisabled ? styles.addBtnDisabled : styles.addBtn}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (!isDisabled) onAdd(product)
                  }}
                  disabled={isDisabled}
                  title={isDisabled ? "Pizza non disponibile (ingrediente esaurito)" : undefined}
                >
                  Aggiungi
                </button>
              ) : (
                <button type="button" style={styles.addBtnDisabled} title="Accedi per ordinare" disabled>
                  Aggiungi
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

ProductGrid.propTypes = {
  products: PropTypes.array.isRequired,
  ingredientiMap: PropTypes.object,
  rowBackground: PropTypes.string,
  onAdd: PropTypes.func.isRequired,
  onModifica: PropTypes.func,
  canAdd: PropTypes.bool,
  showModifica: PropTypes.bool,
  disabledProductIds: PropTypes.oneOfType([PropTypes.instanceOf(Set), PropTypes.array]),
  storefront: PropTypes.bool,
}

const styles = {
  list: {
    marginTop: 12,
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  row: {
    display: "flex",
    alignItems: "stretch",
    justifyContent: "space-between",
    gap: 12,
    padding: "10px 14px",
    borderRadius: 8,
    border: "1px solid #e0e0e0",
  },
  rowLeft: {
    flex: 1,
    minWidth: 0,
  },
  pizzaNameRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  pizzaName: {
    fontWeight: 600,
    fontSize: 15,
  },
  esauritoBadge: {
    fontSize: 11,
    fontWeight: 600,
    color: "#c62828",
    background: "#ffebee",
    padding: "2px 6px",
    borderRadius: 4,
    marginLeft: 8,
  },
  pizzaDesc: {
    margin: "4px 0 0 0",
    fontSize: 13,
    color: "#555",
  },
  rowRight: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  price: {
    fontWeight: 600,
    fontSize: 15,
    marginRight: 4,
  },
  editBtn: {
    padding: "6px 10px",
    borderRadius: 6,
    border: "1px solid #ccc",
    background: "#fff",
    cursor: "pointer",
    fontSize: 13,
  },
  addBtn: {
    padding: "8px 14px",
    borderRadius: 6,
    border: "none",
    background: "#2e7d32",
    color: "#fff",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 600,
  },
  addBtnDisabled: {
    padding: "8px 14px",
    borderRadius: 6,
    border: "1px solid #ccc",
    background: "#e0e0e0",
    color: "#888",
    cursor: "not-allowed",
    fontSize: 14,
    fontWeight: 600,
  },
}