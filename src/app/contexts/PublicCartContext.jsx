import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"

/**
 * Carrello vetrina (dominio pizzeria). Persistenza sessione per tab.
 * @typedef {{
 *   id: string,
 *   nome: string,
 *   prezzo: number,
 *   qty: number,
 *   formatoNome?: string,
 *   ingredientiCotturaSummary?: string,
 *   ingredientiModifiche?: object,
 *   extraIngredienti?: object[],
 *   impastoId?: string,
 *   impastoNome?: string,
 *   formatoId?: string,
 *   cotturaId?: string,
 *   cotturaNome?: string,
 *   _modsKey?: string,
 *   _lineId?: string,
 * }} PublicCartItem
 */

const PublicCartContext = createContext(null)

function storageKey(tenantId) {
  return `pm_public_cart_${tenantId || "unknown"}`
}

function lineKey(p) {
  if (p?._lineId) return p._lineId
  return `${p.id}::${p.formatoNome || ""}::${p.ingredientiCotturaSummary || ""}::${p._modsKey || ""}`
}

function newLineId() {
  return `pcl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function buildCartLine(product, addQty) {
  const prezzo = Number(product.prezzo) || 0
  const nome = String(product.nome || "Prodotto").trim()
  const formatoNome = product.formatoNome ?? product.formato_nome ?? undefined
  const ingredientiCotturaSummary =
    String(product.ingredientiCotturaSummary ?? product.ingredienti_cottura_summary ?? "").trim() ||
    undefined
  const _modsKey = product._modsKey
  return {
    id: product.id,
    nome,
    prezzo,
    qty: addQty,
    formatoNome,
    ingredientiCotturaSummary,
    ingredientiModifiche: product.ingredientiModifiche,
    extraIngredienti: product.extraIngredienti,
    impastoId: product.impastoId,
    impastoNome: product.impastoNome,
    formatoId: product.formatoId,
    cotturaId: product.cotturaId,
    cotturaNome: product.cotturaNome,
    _modsKey,
    _lineId: product._lineId || newLineId(),
  }
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
    [tenantId],
  )

  const addItem = useCallback(
    (product) => {
      if (!product?.id) return
      const formatoNome = product.formatoNome ?? product.formato_nome ?? undefined
      const ingredientiCotturaSummary =
        String(product.ingredientiCotturaSummary ?? product.ingredienti_cottura_summary ?? "").trim() ||
        undefined
      const modsKey = product._modsKey || ""
      const addQty = Math.max(1, Math.floor(Number(product.qty) || 1))
      setItems((prev) => {
        const idx = prev.findIndex(
          (p) =>
            p.id === product.id &&
            (p.formatoNome || "") === (formatoNome || "") &&
            (p.ingredientiCotturaSummary || "") === (ingredientiCotturaSummary || "") &&
            (p._modsKey || "") === modsKey,
        )
        let next
        if (idx >= 0) {
          next = [...prev]
          next[idx] = { ...next[idx], qty: next[idx].qty + addQty }
        } else {
          next = [...prev, buildCartLine(product, addQty)]
        }
        try {
          sessionStorage.setItem(storageKey(tenantId), JSON.stringify(next))
        } catch {
          /* ignore */
        }
        return next
      })
    },
    [tenantId],
  )

  /** Sostituisce una riga (es. dopo modifica pizza) o aggiunge se assente. */
  const replaceLine = useCallback(
    (oldKey, product) => {
      if (!product?.id) return
      const line = buildCartLine(product, Math.max(1, Math.floor(Number(product.qty) || 1)))
      setItems((prev) => {
        const without = oldKey ? prev.filter((p) => lineKey(p) !== oldKey) : prev
        const next = [...without, line]
        try {
          sessionStorage.setItem(storageKey(tenantId), JSON.stringify(next))
        } catch {
          /* ignore */
        }
        return next
      })
    },
    [tenantId],
  )

  const setQty = useCallback(
    (key, qty) => {
      setItems((prev) => {
        const next = prev
          .map((p) => {
            if (lineKey(p) !== key) return p
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
    [tenantId],
  )

  const removeLine = useCallback(
    (key) => {
      setItems((prev) => {
        const next = prev.filter((p) => lineKey(p) !== key)
        try {
          sessionStorage.setItem(storageKey(tenantId), JSON.stringify(next))
        } catch {
          /* ignore */
        }
        return next
      })
    },
    [tenantId],
  )

  const clearCart = useCallback(() => {
    persist([])
  }, [persist])

  const total = useMemo(
    () => items.reduce((s, p) => s + (Number(p.prezzo) || 0) * (Number(p.qty) || 0), 0),
    [items],
  )

  const totalQty = useMemo(() => items.reduce((s, p) => s + (Number(p.qty) || 0), 0), [items])

  const value = useMemo(
    () => ({
      items,
      addItem,
      replaceLine,
      setQty,
      removeLine,
      clearCart,
      total,
      totalQty,
      lineKey,
    }),
    [items, addItem, replaceLine, setQty, removeLine, clearCart, total, totalQty],
  )

  return <PublicCartContext.Provider value={value}>{children}</PublicCartContext.Provider>
}

export function usePublicCart() {
  const ctx = useContext(PublicCartContext)
  if (!ctx) {
    return {
      items: [],
      addItem: () => {},
      replaceLine: () => {},
      setQty: () => {},
      removeLine: () => {},
      clearCart: () => {},
      total: 0,
      totalQty: 0,
      lineKey,
    }
  }
  return ctx
}
