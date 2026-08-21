import { useEffect, useState, useCallback, useMemo, useLayoutEffect } from "react"
import { Link, useLocation } from "react-router-dom"
import { usePreservedNavigate } from "@/hooks/usePreservedNavigate"
import { withPreservedSupportSearch } from "@/utils/supportTenantOverride"
import { useTenant } from "@/app/contexts/TenantContext"
import { useCassaHeader } from "@/app/contexts/CassaHeaderContext"
import { useTenantServizi } from "@/app/hooks/useTenantServizi"
import {
  getIngredients,
  updateIngredient,
  getCategories,
  getProductsByCategory,
  getImpasti,
  updateTenantSettings,
} from "@/features/admin/services/adminService"
import {
  cassaTipoOrdineBtn,
  cassaTipoOrdineBtnActive,
  cassaNuovoClienteBtn,
  cassaToolbarCompactBtn,
} from "@/features/operative/cassa/cassaToolbarButtonStyles"

const PRODUCT_SECTION_NAMES = ["Fritti", "Bibite", "Dolci"]
const TIPO_ORDINE = { NEGOZIO: "negozio", DELIVERY: "delivery" }

export default function ProdottiEsauritiPage() {
  const { tenantId, tenantData, refreshTenant } = useTenant()
  const location = useLocation()
  const navigate = usePreservedNavigate()
  const { hasServizio, enforcementActive } = useTenantServizi()
  const fidelityServizioOk = !enforcementActive || hasServizio("fidelity_card")
  const [ingredients, setIngredients] = useState([])
  const [impastiList, setImpastiList] = useState([])
  const [sectionsProducts, setSectionsProducts] = useState({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [updatingIngId, setUpdatingIngId] = useState(null)
  const [updatingImpastoId, setUpdatingImpastoId] = useState(null)
  const [updatingProdId, setUpdatingProdId] = useState(null)
  const [error, setError] = useState(null)
  const [tipoOrdine, setTipoOrdine] = useState(TIPO_ORDINE.NEGOZIO)

  const prodottiEsauritiIds = useMemo(() => {
    const raw = tenantData?.parametri_operativi?.prodotti_esauriti
    return Array.isArray(raw) ? raw : []
  }, [tenantData?.parametri_operativi?.prodotti_esauriti])

  const impastiEsauritiIds = useMemo(() => {
    const raw = tenantData?.parametri_operativi?.impasti_esauriti
    return Array.isArray(raw) ? raw : []
  }, [tenantData?.parametri_operativi?.impasti_esauriti])

  const loadData = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    setError(null)
    try {
      const [ingData, impastiData, catData] = await Promise.all([
        getIngredients(tenantId),
        getImpasti(tenantId),
        getCategories(tenantId),
      ])
      setIngredients(Array.isArray(ingData) ? ingData : [])
      setImpastiList(Array.isArray(impastiData) ? impastiData : [])
      const cats = Array.isArray(catData) ? catData : []

      const key = (n) => (n || "").toLowerCase().trim()
      const byName = {}
      for (const c of cats) {
        byName[key(c.nome)] = c
      }
      const sectionCategories = PRODUCT_SECTION_NAMES.map((nome) => ({
        nome,
        id: byName[key(nome)]?.id,
      }))

      const productsBySection = {}
      for (const { nome, id } of sectionCategories) {
        if (!id) {
          productsBySection[nome] = []
          continue
        }
        const prods = await getProductsByCategory(tenantId, id)
        productsBySection[nome] = Array.isArray(prods) ? prods : []
      }
      setSectionsProducts(productsBySection)
    } catch (e) {
      console.error(e)
      setError(e?.message ?? "Errore caricamento.")
      setIngredients([])
      setImpastiList([])
      setSectionsProducts({})
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleToggleIngredient = async (ing) => {
    if (!tenantId || !ing?.id) return
    const nuovoStato = ing.attivo !== false
    setUpdatingIngId(ing.id)
    try {
      await updateIngredient(ing.id, { attivo: nuovoStato })
      setIngredients((prev) =>
        prev.map((i) => (i.id === ing.id ? { ...i, attivo: nuovoStato } : i))
      )
    } catch (e) {
      console.error(e)
      setError(e?.message ?? "Errore aggiornamento ingrediente.")
    } finally {
      setUpdatingIngId(null)
    }
  }

  const handleToggleImpasto = async (impastoId) => {
    if (!tenantId || !impastoId) return
    const current = Array.isArray(tenantData?.parametri_operativi?.impasti_esauriti)
      ? tenantData.parametri_operativi.impasti_esauriti
      : []
    const isEsaurito = current.includes(impastoId)
    const next = isEsaurito ? current.filter((id) => id !== impastoId) : [...current, impastoId]
    setUpdatingImpastoId(impastoId)
    try {
      const existing = tenantData?.parametri_operativi && typeof tenantData.parametri_operativi === "object"
        ? tenantData.parametri_operativi
        : {}
      await updateTenantSettings(tenantId, {
        parametri_operativi: { ...existing, impasti_esauriti: next },
      })
      await refreshTenant()
    } catch (e) {
      console.error(e)
      setError(e?.message ?? "Errore aggiornamento impasto.")
    } finally {
      setUpdatingImpastoId(null)
    }
  }

  const handleToggleProdotto = async (productId) => {
    if (!tenantId || !productId) return
    const current = Array.isArray(tenantData?.parametri_operativi?.prodotti_esauriti)
      ? tenantData.parametri_operativi.prodotti_esauriti
      : []
    const isEsaurito = current.includes(productId)
    const next = isEsaurito ? current.filter((id) => id !== productId) : [...current, productId]
    setUpdatingProdId(productId)
    try {
      const existing = tenantData?.parametri_operativi && typeof tenantData.parametri_operativi === "object"
        ? tenantData.parametri_operativi
        : {}
      await updateTenantSettings(tenantId, {
        parametri_operativi: { ...existing, prodotti_esauriti: next },
      })
      await refreshTenant()
    } catch (e) {
      console.error(e)
      setError(e?.message ?? "Errore aggiornamento prodotto.")
    } finally {
      setUpdatingProdId(null)
    }
  }

  const q = (search || "").toLowerCase().trim()
  const filteredIngredients = useMemo(() => {
    if (!q) return ingredients
    return ingredients.filter((i) => (i.nome || "").toLowerCase().includes(q))
  }, [ingredients, q])
  const filteredImpasti = useMemo(() => {
    if (!q) return impastiList
    return impastiList.filter((i) => (i.nome || "").toLowerCase().includes(q))
  }, [impastiList, q])
  const filteredSections = useMemo(() => {
    if (!q) return sectionsProducts
    const out = {}
    for (const [nome, list] of Object.entries(sectionsProducts)) {
      out[nome] = list.filter((p) => (p.nome || "").toLowerCase().includes(q))
    }
    return out
  }, [sectionsProducts, q])

  const setCassaHeader = useCassaHeader()?.setContent
  useLayoutEffect(() => {
    if (!setCassaHeader) return
    const toolbar = (
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <button
            type="button"
            style={{
              ...cassaTipoOrdineBtn,
              ...(tipoOrdine === TIPO_ORDINE.NEGOZIO ? cassaTipoOrdineBtnActive : {}),
            }}
            onClick={() => { setTipoOrdine(TIPO_ORDINE.NEGOZIO); navigate("/operative/cassa"); }}
          >
            In negozio
          </button>
          <button
            type="button"
            style={{
              ...cassaTipoOrdineBtn,
              ...(tipoOrdine === TIPO_ORDINE.DELIVERY ? cassaTipoOrdineBtnActive : {}),
            }}
            onClick={() => { setTipoOrdine(TIPO_ORDINE.DELIVERY); navigate("/operative/cassa"); }}
          >
            Delivery
          </button>
          <button type="button" onClick={() => navigate("/operative/cassa")} style={cassaNuovoClienteBtn}>
            Nuovo cliente
          </button>
          <button
            type="button"
            onClick={() => navigate("/operative/cassa")}
            style={{ ...cassaToolbarCompactBtn, background: "#5d4037", color: "#fff", fontWeight: 600 }}
          >
            Ordini
          </button>
          <button
            type="button"
            onClick={() => navigate("/operative/cassa/fidelity")}
            style={{
              ...cassaToolbarCompactBtn,
              background: fidelityServizioOk ? "#7b1fa2" : "#9e9e9e",
              color: "#fff",
              fontWeight: 600,
            }}
            title={
              fidelityServizioOk
                ? "Fidelity Card — punti e tessere clienti"
                : "Fidelity: servizio non attivo sul piano"
            }
          >
            Fidelity
          </button>
        </div>
      </div>
    )
    setCassaHeader(toolbar)
    return () => setCassaHeader(null)
  }, [setCassaHeader, tipoOrdine, navigate, fidelityServizioOk])

  return (
    <div style={styles.wrapper}>
      <p style={{ margin: "0 0 12px 0" }}>
        <Link to={withPreservedSupportSearch("/operative/cassa", location.search)} style={{ color: "#1565c0", fontSize: 14 }}>← Torna a Cassa</Link>
      </p>
      <h2 style={styles.title}>Prodotti esauriti</h2>
      <p style={styles.hint}>
        Segna come esauriti ingredienti e prodotti temporaneamente non disponibili. Non potranno essere aggiunti alla cassa.
      </p>

      <div style={styles.searchWrap}>
        <input
          type="text"
          placeholder="Cerca in tutta la pagina..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={styles.searchInput}
        />
      </div>

      {error && <div style={styles.error}>{error}</div>}

      {loading ? (
        <p style={styles.loading}>Caricamento...</p>
      ) : (
        <div style={styles.twoCol}>
          <div style={styles.colLeft}>
            <h3 style={styles.sectionTitle}>Ingredienti esauriti</h3>
            {filteredIngredients.length === 0 ? (
              <p style={styles.empty}>Nessun ingrediente{ q ? " trovato" : "" }.</p>
            ) : (
              <ul style={styles.list}>
                {filteredIngredients.map((ing) => {
                  const esaurito = ing.attivo === false
                  const isUpdating = updatingIngId === ing.id
                  return (
                    <li key={ing.id} style={styles.item}>
                      <span style={{ ...styles.nome, ...(esaurito ? styles.nomeEsaurito : {}) }}>
                        {ing.nome ?? "—"}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleToggleIngredient(ing)}
                        disabled={isUpdating}
                        style={{
                          ...styles.toggleBtn,
                          ...(esaurito ? styles.toggleBtnEsaurito : styles.toggleBtnDisponibile),
                        }}
                      >
                        {isUpdating ? "..." : esaurito ? "Esaurito" : "Disponibile"}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
          <div style={styles.colRight}>
            {/* Tipi di impasto (da getImpasti) */}
            <div style={styles.sectionBlock}>
              <h3 style={styles.sectionTitle}>Impasti</h3>
              {filteredImpasti.length === 0 ? (
                <p style={styles.empty}>
                  {impastiList.length === 0 ? "Nessun tipo di impasto configurato. Aggiungili da Admin → Menu → Impasti." : "Nessun impasto trovato."}
                </p>
              ) : (
                <ul style={styles.list}>
                  {filteredImpasti.map((imp) => {
                    const esaurito = impastiEsauritiIds.includes(imp.id)
                    const isUpdating = updatingImpastoId === imp.id
                    return (
                      <li key={imp.id} style={styles.item}>
                        <span style={{ ...styles.nome, ...(esaurito ? styles.nomeEsaurito : {}) }}>
                          {imp.nome ?? "—"}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleToggleImpasto(imp.id)}
                          disabled={isUpdating}
                          style={{
                            ...styles.toggleBtn,
                            ...(esaurito ? styles.toggleBtnEsaurito : styles.toggleBtnDisponibile),
                          }}
                        >
                          {isUpdating ? "..." : esaurito ? "Esaurito" : "Disponibile"}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
            {PRODUCT_SECTION_NAMES.map((sectionName) => {
              const list = filteredSections[sectionName] || []
              return (
                <div key={sectionName} style={styles.sectionBlock}>
                  <h3 style={styles.sectionTitle}>{sectionName}</h3>
                  {list.length === 0 ? (
                    <p style={styles.empty}>Nessun prodotto{ q ? " trovato" : "" }.</p>
                  ) : (
                    <ul style={styles.list}>
                      {list.map((p) => {
                        const esaurito = prodottiEsauritiIds.includes(p.id)
                        const isUpdating = updatingProdId === p.id
                        return (
                          <li key={p.id} style={styles.item}>
                            <span style={{ ...styles.nome, ...(esaurito ? styles.nomeEsaurito : {}) }}>
                              {p.nome ?? "—"}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleToggleProdotto(p.id)}
                              disabled={isUpdating}
                              style={{
                                ...styles.toggleBtn,
                                ...(esaurito ? styles.toggleBtnEsaurito : styles.toggleBtnDisponibile),
                              }}
                            >
                              {isUpdating ? "..." : esaurito ? "Esaurito" : "Disponibile"}
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

const styles = {
  wrapper: {
    padding: 20,
    maxWidth: 1200,
  },
  title: {
    margin: "0 0 8px 0",
    fontSize: 18,
    fontWeight: 600,
  },
  hint: {
    margin: "0 0 16px 0",
    fontSize: 13,
    color: "#555",
  },
  searchWrap: {
    marginBottom: 16,
  },
  searchInput: {
    width: "100%",
    maxWidth: 400,
    padding: "10px 14px",
    borderRadius: 8,
    border: "1px solid #ddd",
    fontSize: 14,
  },
  error: {
    marginBottom: 16,
    padding: 10,
    background: "#ffebee",
    color: "#c62828",
    borderRadius: 6,
    fontSize: 13,
  },
  loading: {
    color: "#666",
    fontSize: 14,
  },
  twoCol: {
    display: "flex",
    gap: 24,
    alignItems: "flex-start",
  },
  colLeft: {
    flex: "0 0 280px",
    minWidth: 0,
  },
  colRight: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: 20,
  },
  sectionBlock: {
    background: "#fff",
    border: "1px solid #e0e0e0",
    borderRadius: 8,
    padding: 12,
  },
  sectionTitle: {
    margin: "0 0 10px 0",
    fontSize: 15,
    fontWeight: 600,
  },
  empty: {
    color: "#666",
    fontSize: 13,
    margin: 0,
  },
  list: {
    listStyle: "none",
    padding: 0,
    margin: 0,
  },
  item: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: "8px 10px",
    marginBottom: 4,
    background: "#fafafa",
    border: "1px solid #eee",
    borderRadius: 6,
  },
  nome: {
    fontWeight: 500,
    fontSize: 14,
  },
  nomeEsaurito: {
    color: "#999",
    textDecoration: "line-through",
  },
  toggleBtn: {
    padding: "6px 12px",
    borderRadius: 6,
    border: "none",
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
  },
  toggleBtnDisponibile: {
    background: "#c8e6c9",
    color: "#2e7d32",
  },
  toggleBtnEsaurito: {
    background: "#ffcdd2",
    color: "#c62828",
  },
}
