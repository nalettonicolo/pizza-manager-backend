import { useMemo } from "react"
import { formatPrice } from "@/utils/format"
import CartItem from "./CartItem"
import { getTodayOrari, buildSlotsInOpeningHours } from "@/features/operative/cassa/utils/planningUtils"

const TIPI_PAGAMENTO = ["Contanti", "Carta", "Altro"]

function slotColor(pizzeCount, maxPizze, sogliaGiallo) {
  if (maxPizze <= 0) return "#e8f5e9"
  if (pizzeCount >= maxPizze) return "#ffcdd2"
  if (pizzeCount >= maxPizze - sogliaGiallo) return "#fff9c4"
  return "#c8e6c9"
}

export default function RiepilogoOrdinePage({
  cart,
  total,
  tipoOrdine,
  deliverySearch,
  checkoutNote,
  onCheckoutNoteChange,
  checkoutTipoPagamento,
  onCheckoutTipoPagamentoChange,
  checkoutNomeCliente = "",
  onCheckoutNomeClienteChange,
  selectedSlot = null,
  onSlotSelect,
  tipiPagamento = TIPI_PAGAMENTO,
  parametri = {},
  orariSettimana,
  onConfirm,
  onBack,
  loading,
  checkoutError,
  onIncrease,
  onDecrease,
  onRemove,
  pizzePerSlotFromOrders = {},
}) {
  const slotMinutes = tipoOrdine === "delivery"
    ? (Number(parametri.consegne_ogni_min) || 15)
    : (Number(parametri.ritiro_ogni_min) || 5)
  const pizzeOgni15 = Number(parametri.pizze_ogni_15_min) || 8
  const sogliaGiallo = Number(parametri.soglia_giallo_pizze) || 10
  const maxPizzePerSlot = Math.max(1, Math.round((pizzeOgni15 * slotMinutes) / 15))

  const orariOggi = useMemo(() => getTodayOrari(orariSettimana), [orariSettimana])
  const slots = useMemo(
    () => buildSlotsInOpeningHours(slotMinutes, orariOggi, 24),
    [slotMinutes, orariOggi]
  )

  const pizzePerSlot = useMemo(() => {
    const map = {}
    slots.forEach((s) => {
      map[s.key] = pizzePerSlotFromOrders[s.key] ?? 0
    })
    return map
  }, [slots, pizzePerSlotFromOrders])

  const noSlotDisponibili = !orariOggi.aperto || slots.length === 0
  const totalPizzeOrdine = (cart || []).reduce((s, i) => s + (i.qty || 0), 0)
  const nomeClienteObbligatorio = tipoOrdine === "negozio" && !(checkoutNomeCliente || "").trim()
  const canConfirm = cart.length > 0 && !loading && selectedSlot && !noSlotDisponibili && !nomeClienteObbligatorio

  return (
    <div style={styles.wrapper}>
      <div style={styles.header}>
        <button type="button" style={styles.backBtn} onClick={onBack}>
          ← Torna alla cassa
        </button>
        <h2 style={styles.title}>Riepilogo ordine</h2>
      </div>

      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Contenuto</h3>
        {tipoOrdine && (
          <p style={styles.tipoInfo}>
            {tipoOrdine === "negozio" ? "Ritiro in negozio" : `Consegna${deliverySearch ? `: ${deliverySearch}` : ""}`}
          </p>
        )}
        {cart.length === 0 ? (
          <p style={{ color: "#666" }}>Nessun prodotto. Aggiungi articoli dalla cassa.</p>
        ) : (
          <ul style={styles.cartList}>
            {cart.map((item, idx) => (
              <li key={item.id + "-" + idx + (item._modsKey ?? "")} style={styles.cartListItem}>
                <CartItem
                  item={item}
                  onIncrease={onIncrease}
                  onDecrease={onDecrease}
                  onRemove={onRemove}
                />
              </li>
            ))}
          </ul>
        )}
        <p style={styles.totale}>Totale: € {formatPrice(total)}</p>
      </div>

      {tipoOrdine === "negozio" && (
        <div style={styles.section}>
          <label style={styles.label}>Nome cliente (ritiro in negozio) <span style={{ color: "#c62828" }}>*</span></label>
          <input
            type="text"
            value={checkoutNomeCliente}
            onChange={(e) => onCheckoutNomeClienteChange?.(e.target.value)}
            placeholder="Nome del cliente che ritira"
            style={styles.input}
          />
        </div>
      )}

      <div style={styles.section}>
        <label style={styles.label}>Tipo pagamento</label>
        <select
          value={checkoutTipoPagamento}
          onChange={(e) => onCheckoutTipoPagamentoChange?.(e.target.value)}
          style={styles.select}
        >
          {(tipiPagamento || []).map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      <div style={styles.section}>
        <label style={styles.label}>Note ordine</label>
        <textarea
          value={checkoutNote}
          onChange={(e) => onCheckoutNoteChange?.(e.target.value)}
          placeholder="Note per la cucina..."
          rows={3}
          style={styles.textarea}
        />
      </div>

      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>
          {tipoOrdine === "delivery" ? "Fasce orarie consegna" : "Fasce orarie ritiro"}
        </h3>
        <p style={styles.pizzeOrdine}>
          Il tuo ordine: <strong>{totalPizzeOrdine} {totalPizzeOrdine === 1 ? "pizza" : "pizze"}</strong>
        </p>
        <p style={styles.hint}>
          Seleziona un orario (obbligatorio). Solo fasce nell’orario di apertura; oltre la chiusura non è disponibile nessun orario. Max {maxPizzePerSlot} pizze ogni {slotMinutes} min. In ogni fascia il numero indica le pizze già impegnate oggi per quell’orario ({tipoOrdine === "delivery" ? "solo consegne" : "solo ritiro in negozio"}), per organizzare il carico.
        </p>
        {noSlotDisponibili && (
          <p style={{ color: "#c62828", fontWeight: 600, marginBottom: 12 }}>
            {!orariOggi.aperto ? "Oggi chiuso: nessun orario disponibile." : "Oltre orario di chiusura: nessun orario disponibile."}
          </p>
        )}
        <div style={styles.slotsGrid}>
          {slots.map((slot) => {
            const count = pizzePerSlot[slot.key] ?? 0
            const color = slotColor(count, maxPizzePerSlot, sogliaGiallo)
            const isSelected = selectedSlot?.key === slot.key
            return (
              <button
                key={slot.key}
                type="button"
                onClick={() => onSlotSelect?.(slot)}
                style={{
                  ...styles.slotBox,
                  backgroundColor: color,
                  borderColor: isSelected ? "#1565c0" : (count >= maxPizzePerSlot ? "#c62828" : "#81c784"),
                  borderWidth: isSelected ? 3 : 2,
                  cursor: "pointer",
                }}
              >
                <div style={styles.slotTime}>{slot.label}</div>
                <div style={styles.slotCount}>{count} {count === 1 ? "pizza già prenotata" : "pizze già prenotate"}</div>
                {isSelected && <div style={{ fontSize: 11, marginTop: 4, color: "#1565c0", fontWeight: 600 }}>✓</div>}
              </button>
            )
          })}
        </div>
      </div>

      {checkoutError && (
        <div style={styles.error}>{checkoutError}</div>
      )}

      <div style={styles.actions}>
        <button
          type="button"
          style={styles.confirmBtn}
          disabled={!canConfirm}
          onClick={onConfirm}
        >
          {loading
            ? "Conferma in corso..."
            : nomeClienteObbligatorio
              ? "Inserisci nome cliente"
              : noSlotDisponibili
                ? "Nessun orario disponibile"
                : !selectedSlot
                  ? "Seleziona un orario"
                  : "Conferma ordine"}
        </button>
      </div>
    </div>
  )
}

const styles = {
  wrapper: {
    padding: "20px",
    maxWidth: 720,
    margin: "0 auto",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    marginBottom: 24,
  },
  backBtn: {
    padding: "8px 14px",
    background: "#f5f5f5",
    border: "1px solid #ddd",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 14,
  },
  title: {
    margin: 0,
    fontSize: 22,
    fontWeight: 600,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    margin: "0 0 8px 0",
    fontSize: 16,
    fontWeight: 600,
  },
  tipoInfo: {
    fontSize: 13,
    color: "#666",
    marginBottom: 12,
  },
  cartList: {
    listStyle: "none",
    padding: 0,
    margin: "0 0 12px 0",
  },
  cartListItem: {
    marginBottom: 8,
  },
  totale: {
    fontWeight: 600,
    fontSize: 18,
  },
  label: {
    display: "block",
    marginBottom: 6,
    fontSize: 14,
    fontWeight: 500,
  },
  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid #ddd",
    boxSizing: "border-box",
    fontSize: 14,
  },
  textarea: {
    width: "100%",
    padding: 10,
    resize: "vertical",
    borderRadius: 8,
    border: "1px solid #ddd",
    boxSizing: "border-box",
  },
  select: {
    width: "100%",
    maxWidth: 200,
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid #ddd",
  },
  hint: {
    fontSize: 12,
    color: "#666",
    marginBottom: 12,
  },
  pizzeOrdine: {
    fontSize: 14,
    marginBottom: 8,
    color: "#333",
  },
  slotsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))",
    gap: 10,
  },
  slotBox: {
    padding: "12px",
    borderRadius: 8,
    border: "2px solid",
    textAlign: "center",
  },
  slotTime: {
    fontWeight: 600,
    fontSize: 14,
  },
  slotCount: {
    fontSize: 12,
    marginTop: 4,
    color: "#333",
  },
  error: {
    marginBottom: 16,
    padding: 12,
    background: "#ffebee",
    color: "#c62828",
    borderRadius: 8,
    fontSize: 13,
  },
  actions: {
    marginTop: 24,
  },
  confirmBtn: {
    width: "100%",
    padding: "14px 20px",
    background: "#2e7d32",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 16,
    fontWeight: 600,
    cursor: "pointer",
  },
}
