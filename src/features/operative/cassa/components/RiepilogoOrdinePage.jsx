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
  checkoutMistoContanti = "",
  checkoutMistoCarta = "",
  onCheckoutMistoContantiChange,
  onCheckoutMistoCartaChange,
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
  /** Fedeltà (solo ritiro in negozio, se servizio attivo) */
  fidelityAbilitato = false,
  fidelityQuery = "",
  onFidelityQueryChange,
  fidelityLoading = false,
  fidelityHits = [],
  fidelitySearchDone = false,
  selectedFidelity = null,
  onSelectFidelity,
  onNuovaFidelityCliente,
}) {
  const capacityWindowMin =
    tipoOrdine === "delivery"
      ? Number(parametri.consegne_ogni_min) || 15
      : Number(parametri.ritiro_ogni_min) || 15
  const pizzeOgni15 = Number(parametri.pizze_ogni_15_min) || 8
  const sogliaGiallo = Number(parametri.soglia_giallo_pizze) || 10
  const maxPizzePerSlot = Math.max(1, Math.round((pizzeOgni15 * capacityWindowMin) / 15))

  const orariOggi = useMemo(() => getTodayOrari(orariSettimana), [orariSettimana])
  const slots = useMemo(
    () => buildSlotsInOpeningHours(orariOggi, 24),
    [orariOggi],
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
  const isMisto = checkoutTipoPagamento === "Misto"
  const mistoC1 = Number(String(checkoutMistoContanti).replace(",", ".")) || 0
  const mistoC2 = Number(String(checkoutMistoCarta).replace(",", ".")) || 0
  const mistoSumOk = Math.abs(mistoC1 + mistoC2 - Number(total)) <= 0.02
  const mistoImportiOk = mistoC1 >= 0 && mistoC2 >= 0 && (mistoC1 > 0 || mistoC2 > 0)
  const mistoOk = !isMisto || (mistoSumOk && mistoImportiOk)
  const canConfirm =
    cart.length > 0 && !loading && selectedSlot && !noSlotDisponibili && !nomeClienteObbligatorio && mistoOk

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
        {isMisto ? (
          <div style={{ marginTop: 14 }}>
            <p style={{ fontSize: 13, color: "#555", margin: "0 0 10px", lineHeight: 1.45 }}>
              Indica gli importi: la somma deve essere uguale al totale (€ {formatPrice(total)}).
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
              <div style={{ flex: "1 1 140px" }}>
                <label style={styles.label}>Contanti (€)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={checkoutMistoContanti}
                  onChange={(e) => onCheckoutMistoContantiChange?.(e.target.value)}
                  placeholder="0,00"
                  style={styles.input}
                />
              </div>
              <div style={{ flex: "1 1 140px" }}>
                <label style={styles.label}>Carta (€)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={checkoutMistoCarta}
                  onChange={(e) => onCheckoutMistoCartaChange?.(e.target.value)}
                  placeholder="0,00"
                  style={styles.input}
                />
              </div>
            </div>
            {!mistoOk && isMisto ? (
              <p style={{ fontSize: 13, color: "#c62828", margin: "10px 0 0", fontWeight: 600 }}>
                {!mistoImportiOk
                  ? "Indica almeno un importo tra contanti e carta."
                  : "La somma non coincide con il totale ordine."}
              </p>
            ) : null}
          </div>
        ) : null}
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

      {fidelityAbilitato && tipoOrdine === "negozio" && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Riepilogo fedeltà</h3>
          <p style={styles.fidelityHint}>
            Cerca con telefono, codice carta, testo letto da QR, nome o email.
          </p>
          <div style={styles.fidelityRow}>
            <input
              type="text"
              value={fidelityQuery}
              onChange={(e) => onFidelityQueryChange?.(e.target.value)}
              placeholder="Telefono, codice tessera, QR, nome o email…"
              style={styles.fidelityInput}
              autoComplete="off"
            />
            {fidelitySearchDone &&
              !fidelityLoading &&
              (fidelityQuery || "").trim().length >= 2 &&
              (fidelityHits || []).length === 0 &&
              !selectedFidelity && (
                <button
                  type="button"
                  style={styles.fidelityNuovaBtn}
                  onClick={() => onNuovaFidelityCliente?.()}
                >
                  Nuova
                </button>
              )}
          </div>
          {fidelityLoading && (
            <p style={styles.fidelityMeta}>Ricerca in corso…</p>
          )}
          {!fidelityLoading && (fidelityHits || []).length > 0 && !selectedFidelity && (
            <ul style={styles.fidelityHits}>
              {(fidelityHits || []).map((row) => {
                const ac = row.anagrafica_clienti
                const a = Array.isArray(ac) ? ac[0] : ac
                const label = [a?.nome, a?.telefono].filter(Boolean).join(" · ") || row.codice_carta || "Cliente"
                return (
                  <li key={row.id}>
                    <button
                      type="button"
                      style={styles.fidelityHitBtn}
                      onClick={() => onSelectFidelity?.(row)}
                    >
                      <span style={styles.fidelityHitMain}>{label}</span>
                      <span style={styles.fidelityHitSub}>
                        Carta {row.codice_carta ?? "—"} · {row.punti ?? 0} punti
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          {selectedFidelity && (() => {
            const ac = selectedFidelity.anagrafica_clienti
            const a = Array.isArray(ac) ? ac[0] : ac
            return (
              <div style={styles.fidelitySelected}>
                <div style={{ fontWeight: 600 }}>
                  {a?.nome ?? "Cliente"} · carta {selectedFidelity.codice_carta ?? "—"}
                </div>
                <div style={styles.fidelityMeta}>
                  {a?.telefono ? `${a.telefono} · ` : ""}
                  {selectedFidelity.punti ?? 0} punti
                  {a?.email ? ` · ${a.email}` : ""}
                </div>
                <button
                  type="button"
                  style={styles.fidelityClearBtn}
                  onClick={() => onSelectFidelity?.(null)}
                >
                  Rimuovi collegamento
                </button>
              </div>
            )
          })()}
        </div>
      )}

      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>
          {tipoOrdine === "delivery" ? "Fasce orarie consegna" : "Fasce orarie ritiro"}
        </h3>
        <p style={styles.pizzeOrdine}>
          Il tuo ordine: <strong>{totalPizzeOrdine} {totalPizzeOrdine === 1 ? "pizza" : "pizze"}</strong>
        </p>
        <p style={styles.hint}>
          Seleziona un orario (obbligatorio). Fasce su quarti d’ora (:00, :15, :30, :45). Solo nell’orario di apertura; oltre la chiusura non è disponibile nessun orario. Capacità stimata: max {maxPizzePerSlot} pizze ogni {capacityWindowMin} min (parametri). In ogni fascia il numero indica le pizze già impegnate oggi per quell’orario ({tipoOrdine === "delivery" ? "solo consegne" : "solo ritiro in negozio"}), per organizzare il carico.
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
                  : isMisto && !mistoOk
                    ? "Correggi importi pagamento misto"
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
  fidelityHint: {
    fontSize: 12,
    color: "#666",
    margin: "0 0 10px 0",
  },
  fidelityRow: {
    display: "flex",
    alignItems: "stretch",
    gap: 10,
    flexWrap: "wrap",
  },
  fidelityInput: {
    flex: "1 1 200px",
    minWidth: 0,
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid #ddd",
    boxSizing: "border-box",
    fontSize: 14,
  },
  fidelityNuovaBtn: {
    flexShrink: 0,
    padding: "10px 16px",
    borderRadius: 8,
    border: "1px solid #1565c0",
    background: "#e3f2fd",
    color: "#0d47a1",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },
  fidelityMeta: {
    fontSize: 13,
    color: "#555",
    marginTop: 8,
  },
  fidelityHits: {
    listStyle: "none",
    padding: 0,
    margin: "10px 0 0 0",
    maxHeight: 220,
    overflowY: "auto",
    border: "1px solid #e0e0e0",
    borderRadius: 8,
    background: "#fafafa",
  },
  fidelityHitBtn: {
    display: "block",
    width: "100%",
    textAlign: "left",
    padding: "10px 12px",
    border: "none",
    borderBottom: "1px solid #eee",
    background: "transparent",
    cursor: "pointer",
    fontSize: 14,
  },
  fidelityHitMain: {
    display: "block",
    fontWeight: 600,
  },
  fidelityHitSub: {
    display: "block",
    fontSize: 12,
    color: "#666",
    marginTop: 2,
  },
  fidelitySelected: {
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    background: "#e8f5e9",
    border: "1px solid #a5d6a7",
  },
  fidelityClearBtn: {
    marginTop: 8,
    padding: "6px 12px",
    fontSize: 13,
    borderRadius: 6,
    border: "1px solid #81c784",
    background: "#fff",
    cursor: "pointer",
  },
}
