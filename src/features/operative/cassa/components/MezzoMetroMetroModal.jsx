/**
 * Modale Mezzo metro / Metro: rettangolo diviso in N spicchi (N da impostazioni).
 * Ogni spicchio = un gusto. Prezzo fisso da admin. Solo se formato abilitato (gustiMax > 0).
 */
import { useState, useMemo, useCallback, useEffect } from "react"

function toNum(v) {
  if (v === null || v === undefined || v === "") return 0
  const n = Number(String(v).replace(",", "."))
  return Number.isNaN(n) ? 0 : n
}

const RECT_HEIGHT = 72

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1100,
    padding: 16,
  },
  modal: {
    background: "#fff",
    borderRadius: 16,
    padding: 24,
    maxWidth: 480,
    width: "100%",
    maxHeight: "90vh",
    overflow: "auto",
    boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
  },
  title: { margin: "0 0 8px", fontSize: 18, fontWeight: 700 },
  subtitle: { margin: "0 0 16px", fontSize: 13, color: "#666" },
  rectWrap: {
    display: "flex",
    width: "100%",
    height: RECT_HEIGHT,
    borderRadius: 10,
    overflow: "hidden",
    border: "2px solid #ddd",
    marginBottom: 16,
    background: "#f5f5f5",
  },
  segment: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    borderRight: "1px solid #ddd",
    padding: "4px 6px",
    textAlign: "center",
  },
  segmentLast: { borderRight: "none" },
  segmentLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: "#333",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  pickerWrap: {
    marginTop: 8,
    padding: 12,
    background: "#f5f5f5",
    borderRadius: 10,
  },
  pickerLabel: { fontSize: 12, fontWeight: 600, marginBottom: 8, color: "#555" },
  productList: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    maxHeight: 180,
    overflowY: "auto",
  },
  productBtn: {
    display: "block",
    width: "100%",
    padding: "8px 12px",
    textAlign: "left",
    border: "1px solid #ddd",
    borderRadius: 8,
    background: "#fff",
    cursor: "pointer",
    fontSize: 14,
  },
  productBtnActive: { background: "#e3f2fd", borderColor: "#1976d2", color: "#0d47a1" },
  footer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 20,
    paddingTop: 16,
    borderTop: "1px solid #eee",
  },
  priceBox: { fontSize: 18, fontWeight: 700 },
  btnAnnulla: {
    padding: "10px 18px",
    background: "#fff",
    border: "1px solid #ccc",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 14,
  },
  btnConferma: {
    padding: "10px 24px",
    background: "#1976d2",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 600,
  },
  btnConfermaDisabled: { opacity: 0.5, cursor: "not-allowed" },
}

export default function MezzoMetroMetroModal({
  open,
  onClose,
  type,
  gustiMax,
  prezzoFisso,
  productsList = [],
  onConfirm,
}) {
  const numSegments = Math.max(1, Math.min(10, Math.floor(Number(gustiMax) || 0)))
  const [gusti, setGusti] = useState(() => Array(numSegments).fill(null))
  const [pickerIndex, setPickerIndex] = useState(null)

  useEffect(() => {
    if (open && numSegments > 0) {
      setGusti(Array(numSegments).fill(null))
      setPickerIndex(null)
    }
  }, [open, numSegments])

  const isMetro = type === "metro"
  const titolo = isMetro ? "Pizza Metro" : "Mezzo metro"
  const formatoLabel = isMetro ? "Metro" : "Mezzo metro"
  const selectedProducts = useMemo(() => gusti.filter(Boolean), [gusti])
  const numSelected = selectedProducts.length
  const productsActive = useMemo(
    () => (productsList || []).filter((p) => p.attivo !== false),
    [productsList]
  )
  const prezzo = Math.max(0, toNum(prezzoFisso))
  const formatoNome = useMemo(() => {
    const names = selectedProducts.map((p) => p?.nome ?? "—").filter(Boolean)
    if (names.length === 0) return formatoLabel
    return `${formatoLabel} (${names.join(", ")})`
  }, [selectedProducts, formatoLabel])

  const setGusto = useCallback((index, prod) => {
    setGusti((prev) => {
      const next = [...prev]
      next[index] = prod
      return next
    })
    setPickerIndex(null)
  }, [])

  const handleConfirm = useCallback(() => {
    if (numSelected < 1) return
    const first = selectedProducts[0]
    if (!first) return
    onConfirm({
      gustiProducts: selectedProducts,
      prezzoCalcolato: prezzo,
      formatoNome,
      productForCart: first,
      formatoSpecial: type,
    })
    onClose()
  }, [numSelected, selectedProducts, prezzo, formatoNome, type, onConfirm, onClose])

  const resetGusti = useCallback(() => {
    setGusti(Array(numSegments).fill(null))
    setPickerIndex(null)
  }, [numSegments])

  if (!open || numSegments < 1) return null

  return (
    <div style={styles.overlay} onClick={onClose} role="dialog" aria-modal="true" aria-label={`${titolo} - Scegli ${numSegments} gusti`}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 style={styles.title}>{titolo}</h2>
        <p style={styles.subtitle}>
          Scegli fino a {numSegments} gusti. Ogni segmento è un gusto. Tocca un segmento per selezionare la pizza.
        </p>

        <div style={styles.rectWrap}>
          {gusti.map((prod, i) => (
            <div
              key={i}
              style={{
                ...styles.segment,
                ...(i === gusti.length - 1 ? styles.segmentLast : {}),
                background: prod ? "#bbdefb" : "#f5f5f5",
                borderColor: prod ? "#1976d2" : "#ddd",
              }}
              onClick={(e) => {
                e.stopPropagation()
                setPickerIndex(pickerIndex === i ? null : i)
              }}
            >
              <span style={styles.segmentLabel}>
                {prod ? (prod.nome?.length > 10 ? prod.nome.slice(0, 10) + "…" : prod.nome) : i + 1}
              </span>
            </div>
          ))}
        </div>

        {pickerIndex !== null && (
          <div style={styles.pickerWrap}>
            <div style={styles.pickerLabel}>Segmento {pickerIndex + 1} – Scegli gusto</div>
            <div style={styles.productList}>
              {productsActive.map((p) => {
                const isActive = gusti[pickerIndex]?.id === p.id
                return (
                  <button
                    key={p.id}
                    type="button"
                    style={{
                      ...styles.productBtn,
                      ...(isActive ? styles.productBtnActive : {}),
                    }}
                    onClick={() => setGusto(pickerIndex, p)}
                  >
                    {p.nome ?? "—"} {toNum(p.prezzo) > 0 ? `(€ ${toNum(p.prezzo).toFixed(2)})` : ""}
                  </button>
                )
              })}
            </div>
            <button
              type="button"
              style={{ ...styles.productBtn, marginTop: 8 }}
              onClick={() => setGusto(pickerIndex, null)}
            >
              Svuota segmento
            </button>
          </div>
        )}

        <div style={styles.footer}>
          <span style={styles.priceBox}>
            {numSelected > 0 ? `€ ${prezzo.toFixed(2)}` : "Seleziona almeno un gusto"}
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" style={styles.btnAnnulla} onClick={resetGusti}>
              Reset
            </button>
            <button type="button" style={styles.btnAnnulla} onClick={onClose}>
              Annulla
            </button>
            <button
              type="button"
              style={{
                ...styles.btnConferma,
                ...(numSelected < 1 ? styles.btnConfermaDisabled : {}),
              }}
              onClick={handleConfirm}
              disabled={numSelected < 1}
            >
              Aggiungi {titolo}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
