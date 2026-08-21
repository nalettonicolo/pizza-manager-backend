import { Link } from "react-router-dom"
import { formatPrice } from "@/utils/format"
import { usePublicCart } from "@/app/contexts/PublicCartContext"

/**
 * Carrello vetrina cliente: colonna fissa a destra (stile cassa, meno controlli).
 */
export default function PublicStoreCartSidebar({
  canCheckout = true,
  accent = "#0f766e",
  onEditPizza,
}) {
  const { items, total, totalQty, setQty, removeLine, clearCart, lineKey } = usePublicCart()

  return (
    <aside className="public-store-cart" aria-label="Carrello">
      <div className="public-store-cart__inner">
        <h2 className="public-store-cart__title">Carrello</h2>
        <p className="public-store-cart__meta">
          Consegna a domicilio
          {totalQty > 0 ? (
            <>
              {" · "}
              <strong>
                {totalQty} {totalQty === 1 ? "articolo" : "articoli"}
              </strong>
            </>
          ) : null}
        </p>

        {items.length === 0 ? (
          <p className="public-store-cart__empty">Nessun prodotto nel carrello</p>
        ) : (
          <ul className="public-store-cart__list">
            {items.map((item) => {
              const key = lineKey(item)
              return (
                <li key={key} className="public-store-cart__item">
                  <div className="public-store-cart__item-main">
                    <strong className="public-store-cart__item-name">{item.nome}</strong>
                    {item.formatoNome ? (
                      <span className="public-store-cart__item-sub">{item.formatoNome}</span>
                    ) : null}
                    {item.ingredientiCotturaSummary ? (
                      <span className="public-store-cart__item-sub">{item.ingredientiCotturaSummary}</span>
                    ) : null}
                    <span className="public-store-cart__item-price">
                      € {formatPrice(item.prezzo)} × {item.qty}
                    </span>
                  </div>
                  <div className="public-store-cart__item-actions">
                    {typeof onEditPizza === "function" ? (
                      <button
                        type="button"
                        className="public-store-cart__qty-btn"
                        aria-label="Modifica pizza"
                        title="Modifica pizza"
                        onClick={() => onEditPizza(item, key)}
                      >
                        ✎
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="public-store-cart__qty-btn"
                      aria-label="Diminuisci quantità"
                      onClick={() => setQty(key, item.qty - 1)}
                    >
                      −
                    </button>
                    <span className="public-store-cart__qty">{item.qty}</span>
                    <button
                      type="button"
                      className="public-store-cart__qty-btn"
                      aria-label="Aumenta quantità"
                      onClick={() => setQty(key, item.qty + 1)}
                    >
                      +
                    </button>
                    <button
                      type="button"
                      className="public-store-cart__remove"
                      aria-label="Rimuovi"
                      onClick={() => removeLine(key)}
                    >
                      ✕
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        <div className="public-store-cart__footer">
          <div className="public-store-cart__total">
            Totale <strong>€ {formatPrice(total)}</strong>
          </div>
          {items.length > 0 ? (
            <button type="button" className="public-store-cart__clear" onClick={() => clearCart()}>
              Svuota
            </button>
          ) : null}
          {canCheckout ? (
            <Link
              to="/ordina"
              className="public-store-cart__checkout"
              style={{ background: accent, borderColor: accent }}
              aria-disabled={items.length === 0}
              onClick={(e) => {
                if (items.length === 0) e.preventDefault()
              }}
            >
              Completa l&apos;ordine
            </Link>
          ) : (
            <p className="public-store-cart__blocked">
              Gli ordini online non sono disponibili per questo locale.
            </p>
          )}
        </div>
      </div>
    </aside>
  )
}
