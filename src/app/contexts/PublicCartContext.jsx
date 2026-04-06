import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"

/**
 * Carrello vetrina (dominio pizzeria). Persistenza sessione per tab.
 * @typedef {{ id: string, nome: string, prezzo: number, qty: number, formatoNome?: string }} PublicCartItem
 */

const PublicCartContext = createContext(null)

function storageKey(tenantId) {
  return `pm_public_cart_${tenantId || "unknown"}`
}

function loadFromStorage(tenantId) {
  try {
    const raw = sessionStorage.getItem(storageKey(tenantId))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function PublicCartProvider({ children, tenantId }) {
  const [items, setItems] = useState(() => loadFromStorage(tenantId))

  useEffect(() => {
    if (!tenantId) return
    setItems(loadFromStorage(tenantId))
  }, [tenantId])

  const persist = useCallback(
    (next) => {
      setItems(next)
      try {
        sessionStorage.setItem(storageKey(tenantId), JSON.stringify(next))
      } catch {
        /* ignore */
      }
    },
    [tenantId]
  )

  const addItem = useCallback(
    (product) => {
      if (!product?.id) return
      const prezzo = Number(product.prezzo) || 0
      const nome = String(product.nome || "Prodotto").trim()
      const formatoNome = product.formatoNome ?? product.formato_nome ?? undefined
      setItems((prev) => {
        const idx = prev.findIndex(
          (p) => p.id === product.id && (p.formatoNome || "") === (formatoNome || "")
        )
        let next
        if (idx >= 0) {
          next = [...prev]
          next[idx] = { ...next[idx], qty: next[idx].qty + 1 }
        } else {
          next = [...prev, { id: product.id, nome, prezzo, qty: 1, formatoNome }]
        }
        try {
          sessionStorage.setItem(storageKey(tenantId), JSON.stringify(next))
        } catch {
          /* ignore */
        }
        return next
      })
    },
    [tenantId]
  )

  const setQty = useCallback(
    (lineKey, qty) => {
      setItems((prev) => {
        const next = prev
          .map((p) => {
            const k = `${p.id}::${p.formatoNome || ""}`
            if (k !== lineKey) return p
            return { ...p, qty: Math.max(0, Math.floor(Number(qty) || 0)) }
          })
          .filter((p) => p.qty > 0)
        try {
          sessionStorage.setItem(storageKey(tenantId), JSON.stringify(next))
        } catch {
          /* ignore */
        }
        return next
      })
    },
    [tenantId]
  )

  const removeLine = useCallback(
    (lineKey) => {
      setItems((prev) => {
        const next = prev.filter((p) => `${p.id}::${p.formatoNome || ""}` !== lineKey)
        try {
          sessionStorage.setItem(storageKey(tenantId), JSON.stringify(next))
        } catch {
          /* ignore */
        }
        return next
      })
    },
    [tenantId]
  )

  const clearCart = useCallback(() => {
    persist([])
  }, [persist])

  const total = useMemo(
    () => items.reduce((s, p) => s + (Number(p.prezzo) || 0) * (Number(p.qty) || 0), 0),
    [items]
  )

  const totalQty = useMemo(() => items.reduce((s, p) => s + (Number(p.qty) || 0), 0), [items])

  const value = useMemo(
    () => ({
      items,
      addItem,
      setQty,
      removeLine,
      clearCart,
      total,
      totalQty,
    }),
    [items, addItem, setQty, removeLine, clearCart, total, totalQty]
  )

  return <PublicCartContext.Provider value={value}>{children}</PublicCartContext.Provider>
}

export function usePublicCart() {
  const ctx = useContext(PublicCartContext)
  if (!ctx) {
    return {
      items: [],
      addItem: () => {},
      setQty: () => {},
      removeLine: () => {},
      clearCart: () => {},
      total: 0,
      totalQty: 0,
    }
  }
  return ctx
}
