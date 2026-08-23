import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { useAuth } from "@/app/contexts/AuthContext"
import {
  upsertCarrelloSospeso,
  deleteCarrelloSospeso,
  getCarrelloSospesoCliente,
} from "@/features/admin/services/adminService"
import { listClienteOrdini } from "@/features/public/services/clienteAuthService"

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

/** Flag: bozza salvata su DB in questa sessione (per rilevare delete da cassa). */
function draftSyncedKey(tenantId) {
  return `pm_public_cart_draft_synced_${tenantId || "unknown"}`
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

function markDraftSynced(tenantId) {
  try {
    sessionStorage.setItem(draftSyncedKey(tenantId), "1")
  } catch {
    /* ignore */
  }
}

function clearDraftSynced(tenantId) {
  try {
    sessionStorage.removeItem(draftSyncedKey(tenantId))
  } catch {
    /* ignore */
  }
}

function hadDraftSynced(tenantId) {
  try {
    return sessionStorage.getItem(draftSyncedKey(tenantId)) === "1"
  } catch {
    return false
  }
}

function cartTotal(items) {
  return (items || []).reduce(
    (s, p) => s + (Number(p.prezzo) || 0) * (Number(p.qty) || 0),
    0,
  )
}

export function PublicCartProvider({ children, tenantId }) {
  const [items, setItems] = useState(() => loadFromStorage(tenantId))
  const { user, tipoUtente } = useAuth()
  const clienteId = tipoUtente === "cliente" ? user?.id || null : null
  const itemsRef = useRef(items)
  itemsRef.current = items
  const reconcileBusyRef = useRef(false)

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

  const clearCart = useCallback(() => {
    persist([])
    clearDraftSynced(tenantId)
    // Carrello svuotato (ordine confermato o svuotamento manuale): la bozza in sospeso non serve più.
    if (tenantId && clienteId) {
      void deleteCarrelloSospeso(tenantId, clienteId).catch(() => {
        /* best-effort */
      })
    }
  }, [persist, tenantId, clienteId])

  /**
   * Se cassa ha già chiuso l'ordine (bozza DB cancellata / ordine in "Ultimi ordini"),
   * svuota il sessionStorage locale che altrimenti resterebbe pieno al refresh.
   */
  const reconcileAfterCassaOrder = useCallback(async () => {
    if (!tenantId || !clienteId || reconcileBusyRef.current) return
    const local = itemsRef.current
    if (!Array.isArray(local) || local.length === 0) return

    reconcileBusyRef.current = true
    try {
      if (hadDraftSynced(tenantId)) {
        try {
          const remote = await getCarrelloSospesoCliente(tenantId, clienteId)
          const remoteCart = remote && typeof remote === "object" ? remote.cart : null
          const remoteEmpty =
            remote == null ||
            !Array.isArray(remoteCart) ||
            remoteCart.length === 0
          if (remoteEmpty) {
            clearCart()
            return
          }
        } catch {
          /* best-effort */
        }
      }

      const localTot = cartTotal(local)
      const { data: orders } = await listClienteOrdini({ limit: 15, offset: 0 })
      if (!Array.isArray(orders) || orders.length === 0) return
      const match = orders.find((o) => {
        const created = new Date(o.created_at || o.createdAt || 0).getTime()
        if (!Number.isFinite(created)) return false
        if (Date.now() - created > 36 * 60 * 60 * 1000) return false
        return Math.abs(Number(o.totale) - localTot) < 0.051
      })
      if (match) clearCart()
    } finally {
      reconcileBusyRef.current = false
    }
  }, [tenantId, clienteId, clearCart])

  /**
   * CA-15: se il cliente inizia un ordine da casa (carrello con articoli) ma non conferma e poi
   * richiama il negozio, cassa deve poterlo ritrovare cercandolo. Salvataggio solo "quando si esce
   * dal carrello" (cambio tab/app, chiusura pagina) — non ad ogni singola modifica.
   */
  useEffect(() => {
    if (!tenantId || !clienteId) return undefined
    const saveDraft = () => {
      const current = itemsRef.current
      if (!Array.isArray(current) || current.length === 0) return
      markDraftSynced(tenantId)
      void upsertCarrelloSospeso(tenantId, clienteId, { origine: "web", cart: current }).catch(() => {
        /* best-effort: il cliente non deve accorgersi di un fallimento di sincronizzazione */
      })
    }
    const onVisibility = () => {
      if (document.visibilityState === "hidden") saveDraft()
      if (document.visibilityState === "visible") void reconcileAfterCassaOrder()
    }
    document.addEventListener("visibilitychange", onVisibility)
    window.addEventListener("pagehide", saveDraft)
    return () => {
      document.removeEventListener("visibilitychange", onVisibility)
      window.removeEventListener("pagehide", saveDraft)
    }
  }, [tenantId, clienteId, reconcileAfterCassaOrder])

  useEffect(() => {
    if (!tenantId || !clienteId) return
    void reconcileAfterCassaOrder()
  }, [tenantId, clienteId, reconcileAfterCassaOrder])

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
