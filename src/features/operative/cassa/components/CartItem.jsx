import { formatPrice } from "@/utils/format"
import { extractModificheFromIngredientiSummary } from "@/features/operative/cassa/utils/comandaIngredientiSummary"

function IconGear({ size = 18, color = "#334155" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
        stroke={color}
        strokeWidth="1.75"
      />
      <path
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82 1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"
        stroke={color}
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function CartItem({
  item,
  onIncrease,
  onDecrease,
  onRemove,
  onEditPizza,
  variant = "default",
}) {
  const mobile = variant === "mobile"
  const metaFs = mobile ? 13 : 11
  const btnStyle = mobile ? styles.actionBtnMobile : styles.actionBtn
  const legacyMods = Boolean(item._modsKey || item.ingredientiModifiche || item.ingredientiCotturaSummary)
  const modsCliente = String(item.ingredientiModificheClienteSummary || "").trim()
  const modsDisplay =
    modsCliente || extractModificheFromIngredientiSummary(item.ingredientiCotturaSummary || "")
  /** Mostra modifica se non disabilitata esplicitamente (bibite/fritti/dolci). Include righe senza flag (bozze/ripristino). */
  const showEditGear =
    typeof onEditPizza === "function" &&
    item.modificaCassaDisponibile !== false &&
    (item.modificaCassaDisponibile === true || item.modificaCassaDisponibile == null || legacyMods)
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
        {modsDisplay ? (
          <div
            style={{
              fontSize: metaFs,
              color: "#b71c1c",
              marginTop: 4,
              fontWeight: 700,
              lineHeight: 1.35,
            }}
          >
            {modsDisplay}
          </div>
        ) : null}
        <div style={{ fontSize: mobile ? 15 : undefined, marginTop: 4 }}>
          € {formatPrice(item.prezzo)} x {item.qty}
        </div>
      </div>

      <div style={styles.actions}>
        {showEditGear ? (
          <button
            type="button"
            style={{ ...btnStyle, ...styles.gearBtn }}
            aria-label="Modifica pizza"
            title={
              Number(item.qty) > 1
                ? "Modifica solo una pizza: al salvataggio la riga si divide (le altre restano come erano)."
                : "Modifica ingredienti"
            }
            onClick={() => onEditPizza(item)}
          >
            <IconGear size={mobile ? 22 : 18} />
          </button>
        ) : null}
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
  gearBtn: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#334155",
  },
}
