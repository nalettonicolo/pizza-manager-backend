import { useCallback, useEffect, useState } from "react"
import { isOfflineCapable, listPendingActions } from "@/offline/offlineDb"
import { flushOfflineQueue, scheduleOfflineFlush } from "@/offline/syncQueue"

/**
 * Hook operativo: profondità coda offline + flush manuale/automatico al ritorno online.
 */
export function useOfflineSync(tenantId) {
  const [pendingCount, setPendingCount] = useState(0)
  const [lastFlush, setLastFlush] = useState(null)
  const [flushing, setFlushing] = useState(false)

  const refreshCount = useCallback(async () => {
    if (!tenantId || !isOfflineCapable()) {
      setPendingCount(0)
      return
    }
    const rows = await listPendingActions(tenantId)
    setPendingCount(rows.length)
  }, [tenantId])

  const flush = useCallback(async () => {
    if (!tenantId) return { flushed: 0, errors: [] }
    setFlushing(true)
    try {
      const result = await flushOfflineQueue(tenantId)
      setLastFlush(result)
      await refreshCount()
      return result
    } finally {
      setFlushing(false)
    }
  }, [tenantId, refreshCount])

  useEffect(() => {
    void refreshCount()
  }, [refreshCount])

  useEffect(() => {
    if (!tenantId) return undefined
    return scheduleOfflineFlush(tenantId, (result) => {
      setLastFlush(result)
      void refreshCount()
    })
  }, [tenantId, refreshCount])

  return {
    offlineCapable: isOfflineCapable(),
    pendingCount,
    flushing,
    lastFlush,
    refreshCount,
    flush,
    isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
  }
}
