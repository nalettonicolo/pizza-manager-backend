import { useEffect, useState, useCallback } from "react"
import { Link } from "react-router-dom"
import { useTenant } from "@/app/contexts/TenantContext"
import { getIngredients, updateIngredient } from "@/features/admin/services/adminService"

export default function IngredientiEsauritiPage() {
  const { tenantId } = useTenant()
  const [ingredients, setIngredients] = useState([])
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState(null)
  const [error, setError] = useState(null)

  const loadIngredients = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    setError(null)
    try {
      const data = await getIngredients(tenantId)
      setIngredients(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error(e)
      setError(e?.message ?? "Errore caricamento ingredienti.")
      setIngredients([])
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => {
    loadIngredients()
  }, [loadIngredients])

  const handleToggleEsaurito = async (ing) => {
    if (!tenantId || !ing?.id) return
    const nuovoStato = ing.attivo !== false
    setUpdatingId(ing.id)
    try {
      await updateIngredient(ing.id, { attivo: nuovoStato })
      setIngredients((prev) =>
        prev.map((i) => (i.id === ing.id ? { ...i, attivo: nuovoStato } : i))
      )
    } catch (e) {
      console.error(e)
      if (e?.code === "PGRST204" || e?.message?.includes("attivo")) {
        setError("La tabella Ingrediente non ha la colonna 'attivo'. Aggiungila in Supabase (SQL Editor).")
      } else {
        setError(e?.message ?? "Errore aggiornamento.")
      }
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <div style={styles.wrapper}>
      <p style={{ margin: "0 0 12px 0" }}>
        <Link to="/operative/cassa" style={{ color: "#1565c0", fontSize: 14 }}>← Torna a Cassa</Link>
      </p>
      <h2 style={styles.title}>Ingredienti esauriti</h2>
      <p style={styles.hint}>
        Segna come esauriti gli ingredienti temporaneamente non disponibili. Le pizze che contengono un ingrediente esaurito non potranno essere aggiunte alla cassa.
      </p>
      {error && (
        <div style={styles.error}>{error}</div>
      )}
      {loading ? (
        <p style={styles.loading}>Caricamento...</p>
      ) : ingredients.length === 0 ? (
        <p style={styles.empty}>Nessun ingrediente presente.</p>
      ) : (
        <ul style={styles.list}>
          {ingredients.map((ing) => {
            const esaurito = ing.attivo === false
            const isUpdating = updatingId === ing.id
            return (
              <li key={ing.id} style={styles.item}>
                <span style={{ ...styles.nome, ...(esaurito ? styles.nomeEsaurito : {}) }}>
                  {ing.nome ?? "—"}
                </span>
                <button
                  type="button"
                  onClick={() => handleToggleEsaurito(ing)}
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
}

const styles = {
  wrapper: {
    padding: 20,
    maxWidth: 480,
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
  empty: {
    color: "#666",
    fontSize: 14,
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
    padding: "10px 12px",
    marginBottom: 6,
    background: "#fff",
    border: "1px solid #e0e0e0",
    borderRadius: 8,
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
