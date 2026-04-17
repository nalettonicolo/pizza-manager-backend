import { useState, useMemo, useEffect } from "react"
import Modal from "@/components/dashboard/Modal"
import {
  getIngredients,
  getProductIngredienti,
  getImpasti,
  getFormati,
  getCottura,
  getProducts,
} from "@/features/admin/services/adminService"
import { getFormatiSpecialiParametri, getFormatiSpecialiList, calcPrezzoFamiglia, FORMATO_SPECIALE_ID } from "@/features/operative/cassa/utils/formatiSpeciali"
import FamigliaModal from "@/features/operative/cassa/components/FamigliaModal"
import MezzoMetroMetroModal from "@/features/operative/cassa/components/MezzoMetroMetroModal"
import { buildComandaIngredientiSummary } from "@/features/operative/cassa/utils/comandaIngredientiSummary"

const VARIANTI = [
  { value: "normale", label: "Normale" },
  { value: "poco", label: "Poco" },
  { value: "abbondante", label: "Abbondante" },
  { value: "senza", label: "Senza" },
]

const COTTURE = [
  { value: "in_cottura", label: "In cottura" },
  { value: "fine_cottura", label: "A fine cottura" },
]

function toNum(v) {
  if (v === null || v === undefined || v === "") return 0
  const n = Number(String(v).replace(",", "."))
  return Number.isNaN(n) ? 0 : n
}
function formatEuro(n) {
  const v = toNum(n)
  if (v >= 0) return `+${v.toFixed(2)}€`
  return `${v.toFixed(2)}€`
}

function normName(v) {
  return String(v || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
}

function parseLegacyIngredientNames(product) {
  const raw = product?.ingredienti ?? product?.descrizione_ingredienti ?? ""
  if (!raw) return []
  return String(raw)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
}

function normalizeIngredientRow(ing) {
  return {
    ...ing,
    nome: ing?.nome ?? "",
    vaInCottura: ing?.vaInCottura === true || ing?.va_in_cottura === true,
    prepCucina: ing?.prepCucina === true || ing?.prep_cucina === true,
  }
}

const s = {
  body: {
    padding: "16px 20px 20px",
    background: "#f3f9f4",
  },
  chipsRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
    marginBottom: 12,
  },
  topRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    flexWrap: "wrap",
    marginBottom: 14,
  },
  productThumb: {
    width: 56,
    height: 56,
    borderRadius: 8,
    background: "#e8f5e9",
    border: "1px solid #c8e6c9",
    objectFit: "cover",
    flexShrink: 0,
  },
  productThumbPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 8,
    background: "linear-gradient(135deg, #fff8e1 0%, #ffecb3 100%)",
    border: "1px solid #ffcc80",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 24,
  },
  productNameBtn: {
    padding: "8px 14px",
    borderRadius: 8,
    border: "none",
    background: "#e65100",
    color: "#fff",
    fontSize: 15,
    fontWeight: 700,
    flexShrink: 0,
  },
  sectionSimple: {
    marginBottom: 14,
  },
  sectionSimpleLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: "#555",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: "0.03em",
  },
  sectionSimpleChips: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
  },
  ingChip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "6px 10px",
    background: "#fff",
    borderRadius: 8,
    border: "1px solid #e0e0e0",
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
    boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
  },
  ingChipGear: {
    marginLeft: 2,
    opacity: 0.8,
    fontSize: 12,
  },
  impastoChip: {
    padding: "6px 12px",
    borderRadius: 20,
    border: "2px solid #e0e0e0",
    background: "#fff",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 500,
  },
  impastoChipActive: {
    background: "#2e7d32",
    color: "#fff",
    borderColor: "#2e7d32",
  },
  addIngRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
    marginBottom: 12,
  },
  addIngLabel: {
    fontSize: 14,
    fontWeight: 500,
    color: "#333",
    flexShrink: 0,
  },
  searchWrap: {
    flex: "1 1 200px",
    minWidth: 0,
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
  },
  searchInput: {
    width: "100%",
    padding: "10px 36px 10px 12px",
    borderRadius: 8,
    border: "1px solid #ddd",
    fontSize: 14,
    boxSizing: "border-box",
    background: "#fff",
  },
  searchIcon: {
    position: "absolute",
    right: 10,
    top: "50%",
    transform: "translateY(-50%)",
    color: "#c62828",
    fontSize: 16,
    pointerEvents: "none",
  },
  expandCard: {
    background: "#fff",
    border: "1px solid #e0e0e0",
    borderRadius: 10,
    padding: "10px 12px",
    marginBottom: 8,
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
  },
  expandTitle: {
    fontWeight: 600,
    fontSize: 13,
    marginBottom: 8,
  },
  chipRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
  },
  chip: {
    padding: "6px 12px",
    borderRadius: 20,
    border: "2px solid #e0e0e0",
    background: "#fff",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 500,
  },
  chipActive: {
    background: "#2e7d32",
    color: "#fff",
    borderColor: "#2e7d32",
  },
  chipSenza: { borderColor: "#c62828", color: "#c62828" },
  chipSenzaActive: { background: "#c62828", color: "#fff" },
  extraChip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 10px",
    background: "#e8f5e9",
    borderRadius: 20,
    border: "1px solid #a5d6a7",
    marginRight: 6,
    marginBottom: 6,
    fontSize: 13,
  },
  footer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 12,
    flexWrap: "wrap",
    marginTop: 16,
    paddingTop: 14,
    borderTop: "1px solid #e0e0e0",
  },
  priceBox: {
    padding: "10px 16px",
    background: "#fff",
    borderRadius: 8,
    border: "1px solid #e0e0e0",
    fontSize: 16,
    fontWeight: 700,
  },
  btnReset: {
    padding: "8px 14px",
    background: "#fff",
    border: "1px solid #ccc",
    borderRadius: 8,
    fontSize: 13,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
  },
  btnAggiungi: {
    padding: "12px 24px",
    background: "#2e7d32",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
  },
  loadingWrap: {
    padding: 32,
    textAlign: "center",
    color: "#666",
    fontSize: 14,
  },
}

export default function ModificaPizzaModal({
  open,
  onClose,
  product,
  tenantId,
  tipoOrdine = "negozio",
  parametri,
  onConfirm,
}) {
  const [productIngredienti, setProductIngredienti] = useState([])
  const [allIngredients, setAllIngredients] = useState([])
  const [impasti, setImpasti] = useState([])
  const [formati, setFormati] = useState([])
  const [cotturaList, setCotturaList] = useState([])
  const [selectedImpastoId, setSelectedImpastoId] = useState(null)
  const [selectedFormatoId, setSelectedFormatoId] = useState(null)
  const [selectedCotturaId, setSelectedCotturaId] = useState(null)
  const [modifiche, setModifiche] = useState({})
  const [extraIngredienti, setExtraIngredienti] = useState([])
  const [searchExtra, setSearchExtra] = useState("")
  const [loading, setLoading] = useState(false)
  const [expandedIngId, setExpandedIngId] = useState(null)
  const [showFamigliaModal, setShowFamigliaModal] = useState(false)
  const [famigliaProductsList, setFamigliaProductsList] = useState([])
  const [specialRectModal, setSpecialRectModal] = useState(null) // 'mezzo_metro' | 'metro' | null

  useEffect(() => {
    if (!open || !product?.id || !tenantId) return
    let cancelled = false
    setLoading(true)
    setExpandedIngId(null)
    Promise.all([
      getProductIngredienti(tenantId, product.id),
      getIngredients(tenantId),
      getImpasti(tenantId),
      getFormati(tenantId).catch(() => []),
      getCottura(tenantId).catch(() => []),
    ]).then(([ingProd, ingAll, impastiList, formatiList, cotturaData]) => {
      if (cancelled) return
      const ingAllList = (ingAll || []).map((ing) => normalizeIngredientRow(ing))
      const ingProdList = (ingProd || []).map((ing) => normalizeIngredientRow(ing))
      const hasProductRecipe = ingProdList.length > 0
      const legacyNames = hasProductRecipe ? [] : parseLegacyIngredientNames(product)
      const byName = new Map(ingAllList.map((ing) => [normName(ing.nome), ing]))
      const fallbackFromLegacy = legacyNames.map((name, idx) => {
        const found = byName.get(normName(name))
        if (found) {
          return {
            ...found,
            nome: found.nome ?? name,
            vaInCottura: found.vaInCottura === true || found.va_in_cottura === true,
            prepCucina: found.prepCucina === true || found.prep_cucina === true,
          }
        }
        return {
          id: `legacy:${normName(name) || idx}`,
          nome: name,
          vaInCottura: true,
          costo_senza: 0,
          costo_poco: 0,
          costo_abbondante: 0,
        }
      })
      const effectiveProductIngredienti = hasProductRecipe ? ingProdList : fallbackFromLegacy
      setProductIngredienti(effectiveProductIngredienti)
      setAllIngredients(ingAll || [])
      const activeImpasti = (impastiList || []).filter((i) => i.attivo !== false)
      setImpasti(activeImpasti)
      if (activeImpasti.length) setSelectedImpastoId(activeImpasti[0].id)
      else setSelectedImpastoId(null)
      const activeFormati = (formatiList || []).filter((f) => f.attivo !== false)
      const specialFormati = getFormatiSpecialiList(parametri || {}, tipoOrdine)
      const formatiMerged = [...activeFormati, ...specialFormati]
      setFormati(formatiMerged)
      if (formatiMerged.length) setSelectedFormatoId(formatiMerged[0].id)
      else setSelectedFormatoId(null)
      const activeCottura = (cotturaData || []).filter((c) => c.attivo !== false)
      setCotturaList(activeCottura)
      if (activeCottura.length) setSelectedCotturaId(activeCottura[0].id)
      else setSelectedCotturaId(null)
      const initial = {}
      effectiveProductIngredienti.forEach((ing) => {
        initial[ing.id] = {
          variante: "normale",
          cottura: ing.vaInCottura ? "in_cottura" : "fine_cottura",
        }
      })
      setModifiche(initial)
      setExtraIngredienti([])
      setSearchExtra("")
    }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [open, product?.id, tenantId, tipoOrdine, parametri])

  useEffect(() => {
    if (!showFamigliaModal || !tenantId) return
    let cancelled = false
    getProducts(tenantId).then((list) => {
      if (!cancelled) setFamigliaProductsList(list || [])
    })
    return () => { cancelled = true }
  }, [showFamigliaModal, tenantId])

  const productIngIds = useMemo(
    () => new Set((productIngredienti || []).map((i) => i.id)),
    [productIngredienti]
  )
  const filteredAllForExtra = useMemo(() => {
    const q = (searchExtra || "").toLowerCase().trim()
    return (allIngredients || []).filter(
      (i) => !productIngIds.has(i.id) && (!q || (i.nome || "").toLowerCase().includes(q))
    )
  }, [allIngredients, productIngIds, searchExtra])

  const prezzoTotale = useMemo(() => {
    /* Prezzo listino (no promo calendario): la promo non si somma alle modifiche ingredienti. */
    const baseListino = toNum(product?.prezzo_listino_originale ?? product?.prezzo) || 0
    const basePriceNoFormato =
      baseListino +
      toNum(impasti.find((i) => i.id === selectedImpastoId)?.costo_base) +
      (productIngredienti || []).reduce((s, ing) => {
        const m = modifiche[ing.id]
        if (!m) return s
        if (m.variante === "senza") return s + toNum(ing.costo_senza)
        if (m.variante === "poco") return s + toNum(ing.costo_poco)
        if (m.variante === "abbondante") return s + Math.max(0, toNum(ing.costo_abbondante))
        return s
      }, 0) +
      (extraIngredienti || []).reduce((s, e) => {
        const ing = allIngredients.find((i) => i.id === e.id)
        if (e.variante === "senza") return s + toNum(ing?.costo_senza)
        if (e.variante === "poco") return s + toNum(ing?.costo_poco)
        if (e.variante === "abbondante") return s + Math.max(0, toNum(ing?.costo_abbondante))
        return s + (ing ? toNum(ing.costo_unitario) : 0)
      }, 0)

    const selectedFormato = formati.find((f) => f.id === selectedFormatoId)
    const isFamiglia = selectedFormatoId === FORMATO_SPECIALE_ID.FAMIGLIA
    const isMezzoMetro = selectedFormatoId === FORMATO_SPECIALE_ID.MEZZO_METRO
    const isMetro = selectedFormatoId === FORMATO_SPECIALE_ID.METRO

    if (isFamiglia && parametri) {
      const { famiglia } = getFormatiSpecialiParametri(parametri)
      return Math.max(0, calcPrezzoFamiglia(famiglia, 1, basePriceNoFormato))
    }
    if (isMezzoMetro && parametri) {
      const { mezzoMetroPrezzo } = getFormatiSpecialiParametri(parametri)
      return Math.max(0, mezzoMetroPrezzo > 0 ? mezzoMetroPrezzo : basePriceNoFormato)
    }
    if (isMetro && parametri) {
      const { metroPrezzo } = getFormatiSpecialiParametri(parametri)
      return Math.max(0, metroPrezzo > 0 ? metroPrezzo : basePriceNoFormato)
    }

    let total = basePriceNoFormato
    if (selectedFormato != null && selectedFormato._special == null) total += toNum(selectedFormato.prezzo)
    return Math.max(0, total)
  }, [product?.prezzo, product?.prezzo_listino_originale, impasti, selectedImpastoId, formati, selectedFormatoId, modifiche, productIngredienti, extraIngredienti, allIngredients, parametri])

  const setModifica = (ingId, field, value) => {
    setModifiche((prev) => ({
      ...prev,
      [ingId]: {
        ...(prev[ingId] || { variante: "normale", cottura: "in_cottura" }),
        [field]: value,
      },
    }))
  }

  const addExtraIngredient = (ing) => {
    if (extraIngredienti.some((e) => e.id === ing.id)) return
    const inCottura = ing?.vaInCottura === true || ing?.va_in_cottura === true
    setExtraIngredienti((prev) => [
      ...prev,
      { id: ing.id, nome: ing.nome ?? "", variante: "normale", cottura: inCottura ? "in_cottura" : "fine_cottura" },
    ])
    setSearchExtra("")
  }

  const removeExtraIngredient = (id) => {
    setExtraIngredienti((prev) => prev.filter((e) => e.id !== id))
  }

  const setExtraModifica = (id, field, value) => {
    setExtraIngredienti((prev) =>
      prev.map((e) => (e.id === id ? { ...e, [field]: value } : e))
    )
  }

  const handleReset = () => {
    const initial = {}
    productIngredienti.forEach((ing) => {
      initial[ing.id] = {
        variante: "normale",
        cottura: ing.vaInCottura ? "in_cottura" : "fine_cottura",
      }
    })
    setModifiche(initial)
    setExtraIngredienti([])
    setSearchExtra("")
    setExpandedIngId(null)
    if (impasti.length) setSelectedImpastoId(impasti[0].id)
    if (formati.length) setSelectedFormatoId(formati[0].id)
    if (cotturaList.length) setSelectedCotturaId(cotturaList[0].id)
  }

  const handleConfirm = () => {
    if (selectedFormatoId === FORMATO_SPECIALE_ID.FAMIGLIA) {
      setShowFamigliaModal(true)
      return
    }
    if (selectedFormatoId === FORMATO_SPECIALE_ID.MEZZO_METRO) {
      setSpecialRectModal("mezzo_metro")
      return
    }
    if (selectedFormatoId === FORMATO_SPECIALE_ID.METRO) {
      setSpecialRectModal("metro")
      return
    }
    const selectedImpasto = impasti.find((i) => i.id === selectedImpastoId)
    const selectedFormato = formati.find((f) => f.id === selectedFormatoId)
    const selectedCottura = cotturaList.find((c) => c.id === selectedCotturaId)
    const payload = {
      ingredientiModifiche: { ...modifiche },
      extraIngredienti: [...extraIngredienti],
      ingredientiCotturaSummary: buildComandaIngredientiSummary(
        productIngredienti,
        modifiche,
        extraIngredienti,
      ),
      impastoId: selectedImpastoId || undefined,
      impastoNome: selectedImpasto?.nome ?? undefined,
      formatoId: selectedFormatoId || undefined,
      formatoNome: selectedFormato?.nome ?? undefined,
      formatoSpecial: selectedFormato?._special ?? undefined,
      cotturaId: selectedCotturaId || undefined,
      cotturaNome: selectedCottura?.nome ?? undefined,
      prezzoCalcolato: prezzoTotale,
    }
    onConfirm(payload)
    onClose()
  }

  if (!product) return null

  return (
    <Modal open={open} onClose={onClose} title="" wide tall>
      <div style={s.body}>
        {loading ? (
          <div style={s.loadingWrap}>Caricamento...</div>
        ) : (
          <>
            {/* Riga superiore: immagine + nome pizza + ingredienti con ingranaggio */}
            <div style={s.topRow}>
              {product.immagine_url ? (
                <img src={product.immagine_url} alt="" style={s.productThumb} />
              ) : (
                <div style={s.productThumbPlaceholder}>🍕</div>
              )}
              <span style={s.productNameBtn}>
                Pizza: {product.nome}
              </span>
            </div>
            <div style={s.chipsRow}>
              {productIngredienti.map((ing) => {
                const m = modifiche[ing.id] || { variante: "normale", cottura: "in_cottura" }
                const label = m.variante !== "normale" ? `${ing.nome} (${m.variante})` : ing.nome
                return (
                  <button
                    key={ing.id}
                    type="button"
                    style={s.ingChip}
                    onClick={() => setExpandedIngId(expandedIngId === ing.id ? null : ing.id)}
                  >
                    {label}
                    <span style={s.ingChipGear} aria-hidden>⚙</span>
                  </button>
                )
              })}
            </div>

            {productIngredienti.map((ing) => {
              if (expandedIngId !== ing.id) return null
              const m = modifiche[ing.id] || { variante: "normale", cottura: "in_cottura" }
              return (
                <div key={ing.id} style={s.expandCard}>
                  <div style={s.expandTitle}>Modifica ingrediente: {ing.nome}</div>
                  <div style={s.chipRow}>
                    {VARIANTI.map((v) => {
                      const isSenza = v.value === "senza"
                      const isActive = m.variante === v.value
                      let priceLabel = ""
                      if (v.value === "senza" && (ing.costo_senza != null || ing.costo_senza === 0)) priceLabel = ` (${formatEuro(ing.costo_senza)})`
                      else if (v.value === "poco" && (ing.costo_poco != null || ing.costo_poco === 0)) priceLabel = ` (${formatEuro(ing.costo_poco)})`
                      else if (v.value === "abbondante" && (ing.costo_abbondante != null || ing.costo_abbondante === 0)) priceLabel = ` (${formatEuro(ing.costo_abbondante)})`
                      return (
                        <button
                          key={v.value}
                          type="button"
                          style={{
                            ...s.chip,
                            ...(isActive && !isSenza ? s.chipActive : {}),
                            ...(isSenza ? s.chipSenza : {}),
                            ...(isSenza && isActive ? s.chipSenzaActive : {}),
                          }}
                          onClick={() => setModifica(ing.id, "variante", v.value)}
                        >
                          {v.label}
                          {priceLabel}
                        </button>
                      )
                    })}
                  </div>
                  {m.variante !== "senza" && (
                    <div style={{ ...s.chipRow, marginTop: 6 }}>
                      {COTTURE.map((c) => (
                        <button
                          key={c.value}
                          type="button"
                          style={{
                            ...s.chip,
                            ...(m.cottura === c.value ? s.chipActive : {}),
                          }}
                          onClick={() => setModifica(ing.id, "cottura", c.value)}
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}

            {/* Sezioni semplici: Impasto, Dimensione, Cottura */}
            {impasti.length > 0 && (
              <div style={s.sectionSimple}>
                <div style={s.sectionSimpleLabel}>Impasto</div>
                <div style={s.sectionSimpleChips}>
                  {impasti.map((imp) => {
                    const costo = toNum(imp.costo_base)
                    const priceLabel = costo !== 0 ? ` (${costo > 0 ? "+" : ""}${costo.toFixed(2)}€)` : ""
                    return (
                      <button
                        key={imp.id}
                        type="button"
                        style={{
                          ...s.impastoChip,
                          ...(selectedImpastoId === imp.id ? s.impastoChipActive : {}),
                        }}
                        onClick={() => setSelectedImpastoId(imp.id)}
                      >
                        {imp.nome ?? "—"}
                        {priceLabel}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {formati.length > 0 && (
              <div style={s.sectionSimple}>
                <div style={s.sectionSimpleLabel}>Dimensione</div>
                <div style={s.sectionSimpleChips}>
                  {formati.map((f) => {
                    const isSpecial = f._special != null
                    const prezzo = isSpecial ? (f.id === FORMATO_SPECIALE_ID.FAMIGLIA ? "" : "—") : toNum(f.prezzo)
                    const priceLabel = isSpecial
                      ? (f.id === FORMATO_SPECIALE_ID.FAMIGLIA
                        ? " (prezzo in base a 1 gusto)"
                        : (Number(f.prezzo) > 0 ? ` (€ ${Number(f.prezzo).toFixed(2)})` : (f.gustiMax ? ` (max ${f.gustiMax} gusti)` : "")))
                      : (prezzo !== 0 ? ` (${prezzo > 0 ? "+" : ""}${Number(prezzo).toFixed(2)}€)` : "")
                    return (
                      <button
                        key={f.id}
                        type="button"
                        style={{
                          ...s.impastoChip,
                          ...(selectedFormatoId === f.id ? s.impastoChipActive : {}),
                        }}
                        onClick={() => {
                          if (f.id === FORMATO_SPECIALE_ID.FAMIGLIA) {
                            setSelectedFormatoId(f.id)
                            setShowFamigliaModal(true)
                          } else if (f.id === FORMATO_SPECIALE_ID.MEZZO_METRO) {
                            setSelectedFormatoId(f.id)
                            setSpecialRectModal("mezzo_metro")
                          } else if (f.id === FORMATO_SPECIALE_ID.METRO) {
                            setSelectedFormatoId(f.id)
                            setSpecialRectModal("metro")
                          } else {
                            setSelectedFormatoId(f.id)
                          }
                        }}
                      >
                        {f.nome ?? "—"}
                        {priceLabel}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {cotturaList.length > 0 && (
              <div style={s.sectionSimple}>
                <div style={s.sectionSimpleLabel}>Cottura</div>
                <div style={s.sectionSimpleChips}>
                  {cotturaList.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      style={{
                        ...s.impastoChip,
                        ...(selectedCotturaId === c.id ? s.impastoChipActive : {}),
                      }}
                      onClick={() => setSelectedCotturaId(c.id)}
                    >
                      {c.nome ?? "—"}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Aggiungi un ingrediente + ricerca */}
            <div style={s.addIngRow}>
              <span style={s.addIngLabel}>▶ Aggiungi un ingrediente:</span>
              <div style={s.searchWrap}>
                <input
                  type="text"
                  placeholder="Cerca ingrediente..."
                  value={searchExtra}
                  onChange={(e) => setSearchExtra(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && filteredAllForExtra[0] && addExtraIngredient(filteredAllForExtra[0])}
                  style={s.searchInput}
                />
                <span style={s.searchIcon} aria-hidden>🔍</span>
              </div>
            </div>
            {filteredAllForExtra.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                {filteredAllForExtra.slice(0, 10).map((ing) => (
                  <button
                    key={ing.id}
                    type="button"
                    style={{
                      padding: "6px 12px",
                      background: "#fff",
                      border: "2px solid #2e7d32",
                      color: "#2e7d32",
                      borderRadius: 20,
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                    onClick={() => addExtraIngredient(ing)}
                  >
                    + {ing.nome}
                    {(ing.prepCucina === true || ing.prep_cucina === true) ? " · prep cucina" : ""}
                  </button>
                ))}
              </div>
            )}
            {extraIngredienti.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                {extraIngredienti.map((e) => (
                  <span key={e.id} style={s.extraChip}>
                    {e.nome}
                    <select
                      value={e.cottura}
                      onChange={(ev) => setExtraModifica(e.id, "cottura", ev.target.value)}
                      style={{ padding: "2px 6px", borderRadius: 6, border: "1px solid #a5d6a7", fontSize: 12 }}
                      onClick={(ev) => ev.stopPropagation()}
                    >
                      {COTTURE.map((c) => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                    <select
                      value={e.variante}
                      onChange={(ev) => setExtraModifica(e.id, "variante", ev.target.value)}
                      style={{ padding: "2px 6px", borderRadius: 6, border: "1px solid #a5d6a7", fontSize: 12 }}
                      onClick={(ev) => ev.stopPropagation()}
                    >
                      {VARIANTI.map((v) => (
                        <option key={v.value} value={v.value}>{v.label}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      style={{ background: "none", border: "none", cursor: "pointer", padding: "0 2px", fontSize: 14, color: "#666", lineHeight: 1 }}
                      onClick={() => removeExtraIngredient(e.id)}
                      aria-label="Rimuovi"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Footer: Reset, Prezzo, Aggiungi */}
            <div style={s.footer}>
              <button type="button" style={s.btnReset} onClick={handleReset}>
                ↻ Reset
              </button>
              <span style={s.priceBox}>€ {prezzoTotale.toFixed(2)}</span>
              <button type="button" style={s.btnAggiungi} onClick={handleConfirm}>
                🛒 Aggiungi
              </button>
            </div>
          </>
        )}
      </div>
      {showFamigliaModal && (
        <FamigliaModal
          open={showFamigliaModal}
          onClose={() => setShowFamigliaModal(false)}
          product={product}
          tenantId={tenantId}
          parametri={parametri}
          productsList={famigliaProductsList}
          onConfirm={(payload) => {
            onConfirm({
              famigliaGusti: payload.famigliaGusti,
              productForCart: payload.productForCart,
              formatoNome: payload.formatoNome,
              prezzoCalcolato: payload.prezzoCalcolato,
              formatoSpecial: "famiglia",
            })
            setShowFamigliaModal(false)
            onClose()
          }}
        />
      )}
      {specialRectModal && (
        <MezzoMetroMetroModal
          open={!!specialRectModal}
          onClose={() => setSpecialRectModal(null)}
          type={specialRectModal}
          gustiMax={
            specialRectModal === "mezzo_metro"
              ? getFormatiSpecialiParametri(parametri || {}).mezzoMetroGustiMax
              : getFormatiSpecialiParametri(parametri || {}).metroGustiMax
          }
          prezzoFisso={
            specialRectModal === "mezzo_metro"
              ? getFormatiSpecialiParametri(parametri || {}).mezzoMetroPrezzo
              : getFormatiSpecialiParametri(parametri || {}).metroPrezzo
          }
          productsList={famigliaProductsList}
          onConfirm={(payload) => {
            onConfirm({
              gustiProducts: payload.gustiProducts,
              productForCart: payload.productForCart,
              formatoNome: payload.formatoNome,
              prezzoCalcolato: payload.prezzoCalcolato,
              formatoSpecial: payload.formatoSpecial,
            })
            setSpecialRectModal(null)
            onClose()
          }}
        />
      )}
    </Modal>
  )
}
