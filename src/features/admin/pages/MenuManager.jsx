import { useCallback, useEffect, useState } from "react"
import { useTenant } from "@/app/contexts/TenantContext"
import Loader from "@/components/feedback/Loader"
import ErrorState from "@/components/feedback/ErrorState"
import {
  getProducts,
  createProduct,
  toggleProductActive,
} from "@/features/admin/services/adminService"
import { formatPrice } from "@/utils/format"

export default function MenuManager() {
  const { tenantId } = useTenant()

  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [newName, setNewName] = useState("")
  const [newPrice, setNewPrice] = useState("")

  const loadProducts = useCallback(async () => {
    try {
      setLoading(true)
      const data = await getProducts(tenantId)
      setProducts(data)
    } catch (err) {
      console.error(err)
      setError("Errore nel caricamento prodotti.")
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => {
    if (tenantId) void loadProducts()
  }, [tenantId, loadProducts])

  async function handleCreate() {
    if (!newName || !newPrice) return

    await createProduct({
      tenantId,
      nome: newName,
      prezzo: Number(newPrice),
      attivo: true,
    })

    setNewName("")
    setNewPrice("")
    loadProducts()
  }

  async function handleToggle(id, current) {
    await toggleProductActive(id, !current)
    loadProducts()
  }

  if (loading) return <Loader />
  if (error) return <ErrorState message={error} />

  return (
    <div style={styles.wrapper}>
      <h1>Gestione Menu</h1>

      <div style={styles.createBox}>
        <input
          placeholder="Nome prodotto"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <input
          placeholder="Prezzo"
          type="number"
          value={newPrice}
          onChange={(e) => setNewPrice(e.target.value)}
        />
        <button type="button" onClick={handleCreate}>Aggiungi</button>
      </div>

      {products.map((p) => (
        <div key={p.id} style={styles.productRow}>
          <div>
            <strong>{p.nome}</strong>
            <div>€ {formatPrice(p.prezzo)}</div>
          </div>

          <button
            type="button"
            onClick={() => handleToggle(p.id, p.attivo)}
            style={{
              background: p.attivo ? "#4caf50" : "#f44336",
              color: "white",
              border: "none",
              padding: "6px 10px",
              borderRadius: "4px",
            }}
          >
            {p.attivo ? "Attivo" : "Disattivato"}
          </button>
        </div>
      ))}
    </div>
  )
}

const styles = {
  wrapper: {
    padding: "30px",
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  createBox: {
    display: "flex",
    gap: "10px",
  },
  productRow: {
    display: "flex",
    justifyContent: "space-between",
    padding: "15px",
    border: "1px solid #eee",
    borderRadius: "8px",
  },
}
