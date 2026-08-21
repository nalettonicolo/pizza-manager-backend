import { useEffect, useMemo, useState } from "react"
import { formatPrice } from "@/utils/format"
import CartItem from "./CartItem"
import {
  getTodayOrari,
  buildSlotsInOpeningHours,
  PLANNING_GRID_SLOT_MINUTES,
} from "@/features/operative/cassa/utils/planningUtils"
import { isTipoPagamentoLink } from "@/features/operative/cassa/utils/cassaPaymentDisplay"
import {
  CASSA_SLOT_GRACE_AFTER_START_MIN,
  isCassaSlotLocked,
  isSlotPast,
} from "@/features/operative/cassa/utils/slotCapacityUtils"

const TIPI_MISTO_RIGA = ["Contanti", "Carta", "Altro"]
const TIPI_PAGAMENTO_ORDINE = ["Contanti", "Carta", "Misto", "Da pagare", "Altro"]

function slotColor(pizzeCount, maxPizze, sogliaGiallo) {
  if (maxPizze <= 0) return "#e8f5e9"
  if (pizzeCount >= maxPizze) return "#ffcdd2"
  if (pizzeCount >= maxPizze - sogliaGiallo) return "#fff9c4"
  return "#c8e6c9"
}

function parseEuroInput(s) {
  return Number(String(s ?? "").replace(",", ".")) || 0
}

function sumMistoRighe(righe) {
  return (righe || []).reduce((acc, r) => acc + parseEuroInput(r?.importo), 0)
}

export default function RiepilogoOrdinePage({
  cart,
  total,
  totalCheckout = total,
  scontoEuroApplicato = 0,
  scontoManualeEuro = 0,
  scontoPremioFidelityEuro = 0,
  checkoutScontoGlobale = "",
  onCheckoutScontoGlobaleChange,
  tipoOrdine,
  deliverySearch,
  checkoutNote,
  onCheckoutNoteChange,
  checkoutTipoPagamento,
  onCheckoutTipoPagamentoChange,
  mistoRighe = [],
  onMistoRigaChange,
  onAddMistoRiga,
  onRemoveMistoRiga,
  maxMistoRighe = 15,
  cassaArrotonda5Cent = false,
  checkoutNomeCliente = "",
  onCheckoutNomeClienteChange,
  checkoutTelefonoCliente = "",
  onCheckoutTelefonoClienteChange,
  selectedSlot = null,
  onSlotSelect,
  tipiPagamento = TIPI_PAGAMENTO_ORDINE,
  parametri = {},
  orariSettimana,
  onConfirm,
  onBack,
  loading,
  checkoutError,
  onIncrease,
  onDecrease,
  onRemove,
  onEditPizza,
  pizzePerSlotFromOrders = {},
  /** Tetto pizze/forno per fascia 15 min (allineato al planning). Se omesso, calcolo da parametri canale. */
  maxPizzeFornoPerSlot = null,
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
  fidelityRedeemInfo = null,
  fidelityRedeemPuntiCost = null,
  fidelityPremioDescrizione = null,
  margheritaPrezzoCatalogo = 0,
  fidelityPremioActive = false,
  onFidelityPremioActiveChange,
  /** Cassa: consente fasce dopo la chiusura (e in giorno “chiuso” in calendario) per inserimenti operativi */
  staffOverrideClosing = false,
}) {
  const capacityWindowMin =
    tipoOrdine === "delivery"
      ? Number(parametri.consegne_ogni_min) || 15
      : Number(parametri.ritiro_ogni_min) || 15
  const pizzeOgni15 = Number(parametri.pizze_ogni_15_min) || 8
  const sogliaGiallo = Number(parametri.soglia_giallo_pizze) || 10
  const maxPizzeCanale = Math.max(1, Math.round((pizzeOgni15 * capacityWindowMin) / 15))
  const maxPizzePerSlot =
    maxPizzeFornoPerSlot != null && Number(maxPizzeFornoPerSlot) > 0
      ? Number(maxPizzeFornoPerSlot)
      : maxPizzeCanale

  const orariOggi = useMemo(() => getTodayOrari(orariSettimana), [orariSettimana])
  const [slotTick, setSlotTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setSlotTick((n) => n + 1), 30 * 1000)
    return () => clearInterval(id)
  }, [])

  const slots = useMemo(
    () => buildSlotsInOpeningHours(orariOggi, 24, { staffOverrideClosing }),
    [orariOggi, staffOverrideClosing],
  )

  const nowForSlots = useMemo(() => {
    void slotTick
    return new Date()
  }, [slotTick])

  useEffect(() => {
    if (!selectedSlot) return
    if (isCassaSlotLocked(selectedSlot, nowForSlots)) {
      onSlotSelect?.(null)
    }
  }, [selectedSlot, nowForSlots, onSlotSelect])

  const pizzePerSlot = useMemo(() => {
    const map = {}
    slots.forEach((s) => {
      map[s.key] = pizzePerSlotFromOrders[s.key] ?? 0
    })
    return map
  }, [slots, pizzePerSlotFromOrders])

  const noSlotDisponibili = slots.length === 0
  const totalPizzeOrdine = (cart || []).reduce((s, i) => s + (i.qty || 0), 0)
  const nomeClienteObbligatorio = tipoOrdine === "negozio" && !(checkoutNomeCliente || "").trim()
  const isMisto = checkoutTipoPagamento === "Misto"
  const mistoSum = sumMistoRighe(mistoRighe)
  const tc = Number(totalCheckout ?? total) || 0
  const mistoSumOk = Math.abs(mistoSum - tc) <= 0.02
  const mistoImportiOk =
    !isMisto ||
    (mistoRighe || []).some((r) => parseEuroInput(r.importo) > 0.001)
  const mistoOk = !isMisto || (mistoSumOk && mistoImportiOk)
  const canConfirm =
    cart.length > 0 &&
    !loading &&
    selectedSlot &&
    !isCassaSlotLocked(selectedSlot, nowForSlots) &&
    !noSlotDisponibili &&
    !nomeClienteObbligatorio &&
    mistoOk

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
                  onEditPizza={onEditPizza}
                />
              </li>
            ))}
          </ul>
        )}
        <p style={styles.totale}>Totale articoli: € {formatPrice(total)}</p>
        {scontoManualeEuro > 0 ? (
          <p style={{ ...styles.totale, fontSize: 14, marginTop: 4, color: "#555" }}>
            Sconto a cassa: −€ {formatPrice(scontoManualeEuro)}
          </p>
        ) : null}
        {scontoPremioFidelityEuro > 0 ? (
          <p style={{ ...styles.totale, fontSize: 14, marginTop: 4, color: "#2e7d32", fontWeight: 600 }}>
            Premio fedeltà (margherita): −€ {formatPrice(scontoPremioFidelityEuro)}
          </p>
        ) : null}
        {(scontoEuroApplicato > 0 || Math.abs(tc - total) > 0.001) && (
          <p style={{ ...styles.totale, fontSize: 15, marginTop: 6, color: "#333" }}>
            Totale da incassare: € {formatPrice(tc)}
            {cassaArrotonda5Cent ? (
              <span style={{ fontSize: 12, fontWeight: 400, color: "#666", marginLeft: 8 }}>
                (arrotondato a 0,05 €)
              </span>
            ) : null}
          </p>
        )}
      </div>

      <div style={styles.section}>
        <label style={styles.label}>Sconto a cassa (€, opzionale)</label>
        <input
          type="text"
          inputMode="decimal"
          value={checkoutScontoGlobale}
          onChange={(e) => onCheckoutScontoGlobaleChange?.(e.target.value)}
          placeholder="0 — massimo pari al totale articoli"
          style={styles.input}
        />
        {scontoManualeEuro > 0 ? (
          <p style={{ fontSize: 12, color: "#555", marginTop: 6, lineHeight: 1.4 }}>
            In nota ordine: <strong>[Sconto cassa €{scontoManualeEuro.toFixed(2)}]</strong>
            {scontoPremioFidelityEuro > 0 ? (
              <>
                {" "}
                e premio fedeltà (margherita).
              </>
            ) : null}
          </p>
        ) : null}
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
          <label style={{ ...styles.label, marginTop: 14 }}>
            Telefono (opzionale, per contatto / pay-by-link)
          </label>
          <input
            type="tel"
            value={checkoutTelefonoCliente}
            onChange={(e) => onCheckoutTelefonoClienteChange?.(e.target.value)}
            placeholder="es. +39… — non obbligatorio"
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
        {isTipoPagamentoLink(checkoutTipoPagamento) ? (
          <p style={{ fontSize: 13, color: "#1565c0", marginTop: 10, lineHeight: 1.45 }}>
            Dopo la conferma compare in basso la finestra per <strong>registrare o inviare</strong> il pagamento online
            (carta da casa). Se il flusso non è ancora attivo, dalla stessa finestra puoi aprire le impostazioni.
          </p>
        ) : null}
        {isMisto ? (
          <div style={{ marginTop: 14 }}>
            <p style={{ fontSize: 13, color: "#555", margin: "0 0 10px", lineHeight: 1.45 }}>
              Aggiungi righe (Contanti / Carta / Altro): la somma deve essere uguale al totale da incassare (€{" "}
              {formatPrice(tc)}).
            </p>
            {(mistoRighe || []).map((row) => (
              <div
                key={row.id}
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 10,
                  alignItems: "flex-end",
                  marginBottom: 10,
                }}
              >
                <div style={{ flex: "1 1 120px" }}>
                  <label style={styles.label}>Tipo</label>
                  <select
                    value={row.tipo || "Contanti"}
                    onChange={(e) => onMistoRigaChange?.(row.id, { tipo: e.target.value })}
                    style={styles.select}
                  >
                    {TIPI_MISTO_RIGA.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ flex: "1 1 100px" }}>
                  <label style={styles.label}>Importo (€)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={row.importo}
                    onChange={(e) => onMistoRigaChange?.(row.id, { importo: e.target.value })}
                    placeholder="0,00"
                    style={styles.input}
                  />
                </div>
                <button
                  type="button"
                  style={styles.mistoRemoveBtn}
                  disabled={(mistoRighe || []).length <= 1}
                  onClick={() => onRemoveMistoRiga?.(row.id)}
                >
                  Rimuovi
                </button>
              </div>
            ))}
            <button
              type="button"
              style={styles.mistoAddBtn}
              disabled={(mistoRighe || []).length >= maxMistoRighe}
              onClick={() => onAddMistoRiga?.()}
            >
              + Aggiungi riga
            </button>
            {!mistoOk && isMisto ? (
              <p style={{ fontSize: 13, color: "#c62828", margin: "10px 0 0", fontWeight: 600 }}>
                {!mistoImportiOk
                  ? "Indica almeno un importo in una riga."
                  : "La somma non coincide con il totale da incassare."}
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
          {!selectedFidelity ? (
            <>
              <p style={styles.fidelityHint}>
                Cerca con telefono, codice carta, testo letto da QR, nome o email. Una sola tessera per ordine.
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
                  (fidelityHits || []).length === 0 && (
                    <button
                      type="button"
                      style={styles.fidelityNuovaBtn}
                      onClick={() => onNuovaFidelityCliente?.()}
                    >
                      Nuova
                    </button>
                  )}
              </div>
            </>
          ) : (
            <p style={{ ...styles.fidelityHint, marginBottom: 10 }}>
              Cliente fedeltà collegato. Rimuovi il collegamento per cercare un altro nominativo.
            </p>
          )}
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
            const punti = selectedFidelity.punti ?? 0
            const redeem = fidelityRedeemInfo || {
              cost: fidelityRedeemPuntiCost,
              premioLabel: fidelityPremioDescrizione,
              premiRaggiunti: [],
              prossimoPremio: null,
              suScheda: null,
              timbriSchedaTotale: 0,
              puntiSaldo: punti,
            }
            const cost = redeem.cost
            const premioLabel = redeem.premioLabel || fidelityPremioDescrizione
            const canRedeem = cost != null && Number(punti) >= Number(cost)
            const canApplySconto = canRedeem && margheritaPrezzoCatalogo > 0
            const suScheda = redeem.suScheda
            const totScheda = redeem.timbriSchedaTotale || 0
            const prossimo = redeem.prossimoPremio
            const altriRaggiunti = (redeem.premiRaggiunti || []).slice(1)

            return (
              <div style={styles.fidelitySelected}>
                <div style={{ fontWeight: 600 }}>
                  {a?.nome ?? "Cliente"} · carta {selectedFidelity.codice_carta ?? "—"}
                </div>
                <div style={styles.fidelityMeta}>
                  {a?.telefono ? `${a.telefono} · ` : ""}
                  {punti} punti
                  {totScheda >= 1 && suScheda != null
                    ? ` · scheda ${suScheda}/${totScheda} timbri`
                    : ""}
                  {a?.email ? ` · ${a.email}` : ""}
                </div>

                {canRedeem ? (
                  <div style={styles.fidelityPremioBox}>
                    <div style={styles.fidelityPremioTitle}>Premio raggiunto</div>
                    <div style={styles.fidelityPremioName}>{premioLabel || "Premio fedeltà"}</div>
                    {altriRaggiunti.length > 0 ? (
                      <div style={styles.fidelityPremioSub}>
                        Altri livelli già superati:{" "}
                        {altriRaggiunti.map((pr) => pr.descrizione || `soglia ${pr.soglia}`).join(" · ")}
                      </div>
                    ) : null}
                    {canApplySconto ? (
                      <label style={styles.fidelityPremioCheck}>
                        <input
                          type="checkbox"
                          checked={fidelityPremioActive}
                          onChange={(e) => onFidelityPremioActiveChange?.(e.target.checked)}
                          style={{ marginTop: 3 }}
                        />
                        <span>
                          <strong>Usa questo premio sull’ordine</strong>
                          <span style={{ display: "block", fontSize: 13, color: "#2e7d32", marginTop: 6 }}>
                            Sconto pari al prezzo listino margherita (€ {formatPrice(margheritaPrezzoCatalogo)});
                            alla conferma verranno scalati <strong>{cost}</strong> punti.
                          </span>
                        </span>
                      </label>
                    ) : (
                      <p style={{ ...styles.fidelityMeta, color: "#b71c1c", marginTop: 10, marginBottom: 0 }}>
                        Premio disponibile, ma nel listino non risulta un prodotto con nome «margherita» per calcolare lo
                        sconto. Aggiungi o rinomina la pizza nel catalogo, poi riprova.
                      </p>
                    )}
                  </div>
                ) : (
                  <div style={styles.fidelityPremioPending}>
                    {prossimo ? (
                      <>
                        <div style={{ ...styles.fidelityPremioTitle, color: "#f57f17" }}>Prossimo premio</div>
                        <div style={{ ...styles.fidelityPremioName, color: "#e65100" }}>{prossimo.descrizione}</div>
                        <div style={styles.fidelityPremioSub}>
                          {totScheda >= 1 && suScheda != null
                            ? `Mancano ${Math.max(0, prossimo.soglia - suScheda)} timbri sulla scheda (soglia ${prossimo.soglia}).`
                            : `Mancano ${Math.max(0, prossimo.soglia - Number(punti))} punti (soglia ${prossimo.soglia}).`}
                        </div>
                      </>
                    ) : (
                      <p style={{ ...styles.fidelityMeta, margin: 0 }}>
                        Nessun premio configurato nel programma fedeltà, oppure nessun premio ancora raggiungibile con
                        questo saldo.
                      </p>
                    )}
                  </div>
                )}

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
          Seleziona un orario (obbligatorio). Fasce su quarti d’ora (:00, :15, :30, :45).{" "}
          {staffOverrideClosing ? (
            <>
              <strong>Modalità cassa:</strong> puoi prenotare anche dopo l’orario di chiusura del locale (fino a fine
              giornata) e, se il giorno risulta chiuso in calendario, sono comunque disponibili fasce da adesso per
              ordini operativi. Le fasce già passate sono in grigio; dopo {CASSA_SLOT_GRACE_AFTER_START_MIN} minuti
              dall’orario non sono più selezionabili.{" "}
            </>
          ) : (
            <>Solo nell’orario di apertura; oltre la chiusura non è disponibile nessun orario. </>
          )}
          Capacità forno: max {maxPizzePerSlot} pizze ogni {PLANNING_GRID_SLOT_MINUTES} min. In ogni fascia vedi le pizze{" "}
          <strong>già prenotate oggi</strong> (consegna + ritiro). Se selezioni una fascia, il conteggio include anche
          le pizze di <strong>questo ordine</strong>.
        </p>
        {noSlotDisponibili && (
          <p style={{ color: "#c62828", fontWeight: 600, marginBottom: 12 }}>
            {!staffOverrideClosing && !orariOggi.aperto
              ? "Oggi chiuso: nessun orario disponibile."
              : !staffOverrideClosing
                ? "Oltre orario di chiusura: nessun orario disponibile."
                : "Nessuna fascia disponibile (fine giornata o orari non configurati)."}
          </p>
        )}
        <div style={styles.slotsGrid}>
          {slots.map((slot) => {
            const booked = pizzePerSlot[slot.key] ?? 0
            const isSelected = selectedSlot?.key === slot.key
            const withCart = isSelected ? booked + totalPizzeOrdine : booked
            const past = isSlotPast(slot, nowForSlots)
            const locked = isCassaSlotLocked(slot, nowForSlots)
            const color = past ? "#e2e8f0" : slotColor(withCart, maxPizzePerSlot, sogliaGiallo)
            const full = !past && withCart >= maxPizzePerSlot
            return (
              <button
                key={slot.key}
                type="button"
                disabled={locked}
                onClick={() => {
                  if (locked) return
                  onSlotSelect?.(slot)
                }}
                style={{
                  ...styles.slotBox,
                  backgroundColor: color,
                  borderColor: locked
                    ? "#94a3b8"
                    : isSelected
                      ? "#1565c0"
                      : full
                        ? "#c62828"
                        : past
                          ? "#cbd5e1"
                          : "#81c784",
                  borderWidth: isSelected ? 3 : 2,
                  cursor: locked ? "not-allowed" : "pointer",
                  opacity: locked ? 0.72 : 1,
                  color: past || locked ? "#64748b" : undefined,
                }}
                title={
                  locked
                    ? `Fascia non più selezionabile (oltre ${CASSA_SLOT_GRACE_AFTER_START_MIN} min dall’orario)`
                    : past
                      ? "Fascia già passata (ancora selezionabile per pochi minuti)"
                      : undefined
                }
              >
                <div style={styles.slotTime}>{slot.label}</div>
                <div style={styles.slotCount}>
                  {booked} {booked === 1 ? "pizza prenotata" : "pizze prenotate"}
                  {isSelected && totalPizzeOrdine > 0 ? (
                    <span style={{ display: "block", fontSize: 11, marginTop: 2, fontWeight: 600 }}>
                      +{totalPizzeOrdine} in questo ordine → {withCart} totali
                    </span>
                  ) : null}
                  {locked ? (
                    <span style={{ display: "block", fontSize: 10, marginTop: 2, fontWeight: 600, color: "#64748b" }}>
                      Non selezionabile
                    </span>
                  ) : past ? (
                    <span style={{ display: "block", fontSize: 10, marginTop: 2, color: "#64748b" }}>Passata</span>
                  ) : null}
                </div>
                {isSelected && !locked ? (
                  <div style={{ fontSize: 11, marginTop: 4, color: "#1565c0", fontWeight: 600 }}>✓</div>
                ) : null}
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
  mistoAddBtn: {
    marginTop: 4,
    padding: "8px 12px",
    borderRadius: 8,
    border: "1px solid #81c784",
    background: "#e8f5e9",
    color: "#1b5e20",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
  mistoRemoveBtn: {
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid #ddd",
    background: "#fafafa",
    fontSize: 13,
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
  fidelityPremioBox: {
    marginTop: 12,
    padding: "12px 14px",
    borderRadius: 8,
    background: "#fff",
    border: "1px solid #81c784",
  },
  fidelityPremioPending: {
    marginTop: 12,
    padding: "12px 14px",
    borderRadius: 8,
    background: "#fff8e1",
    border: "1px solid #ffe082",
  },
  fidelityPremioTitle: {
    fontSize: 12,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    color: "#558b2f",
    marginBottom: 4,
  },
  fidelityPremioName: {
    fontSize: 16,
    fontWeight: 700,
    color: "#1b5e20",
    lineHeight: 1.35,
  },
  fidelityPremioSub: {
    fontSize: 13,
    color: "#555",
    marginTop: 6,
    lineHeight: 1.4,
  },
  fidelityPremioCheck: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    marginTop: 12,
    padding: "10px 12px",
    background: "#e8f5e9",
    borderRadius: 8,
    border: "1px solid #a5d6a7",
    cursor: "pointer",
    fontSize: 14,
    lineHeight: 1.45,
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
