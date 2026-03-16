/**
 * Modale Pizza Famiglia: cerchio diviso in 4 spicchi, ogni spicchio = un gusto.
 * Se non si selezionano tutti e 4 gli spicchi si usa la logica prezzo (1, 2, 3, 4 gusti).
 */
import { useState, useMemo, useCallback } from "react"
import { getFormatiSpecialiParametri, calcPrezzoFamiglia } from "@/features/operative/cassa/utils/formatiSpeciali"

function toNum(v) {
  if (v === null || v === undefined || v === "") return 0
  const n = Number(String(v).replace(",", "."))
  return Number.isNaN(n) ? 0 : n
}

const CENTER = 100
const RADIUS = 90
const SLICE_ANGLES = [0, 90, 180, 270] // gradi: ogni spicchio parte da qui

function slicePath(startDeg, endDeg) {
  const start = (startDeg * Math.PI) / 180
  const end = (endDeg * Math.PI) / 180
  const x1 = CENTER + RADIUS * Math.cos(start)
  const y1 = CENTER - RADIUS * Math.sin(start)
  const x2 = CENTER + RADIUS * Math.cos(end)
  const y2 = CENTER - RADIUS * Math.sin(end)
  const large = endDeg - startDeg > 180 ? 1 : 0
  return `M ${CENTER} ${CENTER} L ${x1} ${y1} A ${RADIUS} ${RADIUS} 0 ${large} 1 ${x2} ${y2} Z`
}

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
    maxWidth: 420,
    width: "100%",
    maxHeight: "90vh",
    overflow: "auto",
    boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
  },
  title: { margin: "0 0 8px", fontSize: 18, fontWeight: 700 },
  subtitle: { margin: "0 0 16px", fontSize: 13, color: "#666" },
  circleWrap: {
    position: "relative",
    width: 200,
    height: 200,
    margin: "0 auto 20px",
  },
  slice: {
    position: "absolute",
    inset: 0,
    cursor: "pointer",
  },
  sliceSvg: {
    width: "100%",
    height: "100%",
    overflow: "visible",
  },
  sliceText: {
    position: "absolute",
    left: "50%",
    top: "50%",
    transform: "translate(-50%, -50%)",
    fontSize: 11,
    fontWeight: 600,
    textAlign: "center",
    pointerEvents: "none",
    maxWidth: "70%",
  },
  sliceLabel: {
    position: "absolute",
    fontSize: 10,
    color: "#333",
    pointerEvents: "none",
    fontWeight: 500,
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
    maxHeight: 200,
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
  productBtnActive: { background: "#e8f5e9", borderColor: "#2e7d32", color: "#1b5e20" },
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
    background: "#2e7d32",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 600,
  },
  btnConfermaDisabled: { opacity: 0.5, cursor: "not-allowed" },
}

export default function FamigliaModal({
  open,
  onClose,
  product: initialProduct,
  tenantId,
  parametri,
  productsList = [],
  onConfirm,
}) {
  const [gusti, setGusti] = useState([null, null, null, null])
  const [pickerIndex, setPickerIndex] = useState(null)

  const famigliaParams = useMemo(
    () => (parametri ? getFormatiSpecialiParametri(parametri).famiglia : null),
    [parametri]
  )

  const numGusti = useMemo(() => gusti.filter(Boolean).length, [gusti])
  const selectedProducts = useMemo(() => gusti.filter(Boolean), [gusti])
  const productsActive = useMemo(
    () => (productsList || []).filter((p) => p.attivo !== false),
    [productsList]
  )

  const prezzoTotale = useMemo(() => {
    if (!famigliaParams || numGusti < 1) return 0
    if (numGusti === 1) {
      const p = gusti.find(Boolean)
      return Math.max(0, calcPrezzoFamiglia(famigliaParams, 1, toNum(p?.prezzo)))
    }
    const somma = selectedProducts.reduce((s, p) => s + toNum(p?.prezzo), 0)
    return Math.max(0, calcPrezzoFamiglia(famigliaParams, numGusti, 0, somma))
  }, [famigliaParams, numGusti, gusti, selectedProducts])

  const formatoNome = useMemo(() => {
    const names = selectedProducts.map((p) => p?.nome ?? "—").filter(Boolean)
    if (names.length === 0) return "Famiglia"
    return `Famiglia (${names.join(", ")})`
  }, [selectedProducts])

  const setGusto = useCallback((index, prod) => {
    setGusti((prev) => {
      const next = [...prev]
      next[index] = prod
      return next
    })
    setPickerIndex(null)
  }, [])

  const handleConfirm = useCallback(() => {
    if (numGusti < 1) return
    const first = selectedProducts[0]
    if (!first) return
    onConfirm({
      famigliaGusti: selectedProducts,
      prezzoCalcolato: prezzoTotale,
      formatoNome,
      productForCart: first,
    })
    onClose()
  }, [numGusti, selectedProducts, prezzoTotale, formatoNome, onConfirm, onClose])

  const resetGusti = useCallback(() => {
    setGusti([null, null, null, null])
    setPickerIndex(null)
  }, [])

  if (!open) return null

  return (
    <div style={styles.overlay} onClick={onClose} role="dialog" aria-modal="true" aria-label="Pizza Famiglia - Scegli 4 gusti">
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 style={styles.title}>Pizza Famiglia</h2>
        <p style={styles.subtitle}>
          Scegli da 1 a 4 gusti. Ogni spicchio è un gusto. Tocca uno spicchio per selezionare la pizza.
        </p>

        <div style={styles.circleWrap}>
          <svg viewBox="0 0 200 200" style={styles.sliceSvg}>
            {[0, 1, 2, 3].map((i) => {
              const startDeg = SLICE_ANGLES[i]
              const endDeg = startDeg + 90
              const prod = gusti[i]
              const fill = prod ? "#c8e6c9" : "#f5f5f5"
              const stroke = prod ? "#2e7d32" : "#ddd"
              const labelX = CENTER + (RADIUS * 0.55) * Math.cos(((startDeg + 45) * Math.PI) / 180)
              const labelY = CENTER - (RADIUS * 0.55) * Math.sin(((startDeg + 45) * Math.PI) / 180)
              return (
                <g key={i}>
                  <path
                    d={slicePath(startDeg, endDeg)}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={2}
                    style={{ cursor: "pointer" }}
                    onClick={(e) => {
                      e.stopPropagation()
                      setPickerIndex(pickerIndex === i ? null : i)
                    }}
                  />
                  <text
                    x={labelX}
                    y={labelY}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="10"
                    fontWeight="600"
                    fill="#333"
                  >
                    {prod ? (prod.nome?.length > 8 ? prod.nome.slice(0, 8) + "…" : prod.nome) : `${i + 1}`}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>

        {pickerIndex !== null && (
          <div style={styles.pickerWrap}>
            <div style={styles.pickerLabel}>Spicchio {pickerIndex + 1} – Scegli gusto</div>
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
              Svuota spicchio
            </button>
          </div>
        )}

        <div style={styles.footer}>
          <span style={styles.priceBox}>
            {numGusti > 0 ? `€ ${prezzoTotale.toFixed(2)}` : "Seleziona almeno un gusto"}
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
                ...(numGusti < 1 ? styles.btnConfermaDisabled : {}),
              }}
              onClick={handleConfirm}
              disabled={numGusti < 1}
            >
              Aggiungi Famiglia
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
