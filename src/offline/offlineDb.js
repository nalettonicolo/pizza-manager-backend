/**
 * Persistenza locale ordini/checkout in attesa di rete (Blocco B — coda offline).
 * IndexedDB via idb-keyval pattern minimale (no dipendenze extra).
 */

const DB_NAME = "pm_offline_v1"
const STORE = "pending_actions"
const DB_VERSION = 1

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("indexedDB_non_disponibile"))
      return
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onerror = () => reject(req.error)
    req.onsuccess = () => resolve(req.result)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        const os = db.createObjectStore(STORE, { keyPath: "id" })
        os.createIndex("tenant_id", "tenant_id", { unique: false })
        os.createIndex("created_at", "created_at", { unique: false })
      }
    }
  })
}

/** @returns {Promise<object[]>} */
export async function listPendingActions(tenantId) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly")
    const store = tx.objectStore(STORE)
    const req = store.getAll()
    req.onsuccess = () => {
      const all = req.result || []
      resolve(tenantId ? all.filter((r) => r.tenant_id === tenantId) : all)
    }
    req.onerror = () => reject(req.error)
  })
}

/** @param {object} action */
export async function enqueuePendingAction(action) {
  const db = await openDb()
  const row = {
    id: action.id || crypto.randomUUID(),
    tenant_id: action.tenant_id,
    type: action.type,
    payload: action.payload,
    idempotency_key: action.idempotency_key,
    attempts: 0,
    last_error: null,
    created_at: new Date().toISOString(),
  }
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite")
    tx.objectStore(STORE).put(row)
    tx.oncomplete = () => resolve(row)
    tx.onerror = () => reject(tx.error)
  })
}

export async function removePendingAction(id) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite")
    tx.objectStore(STORE).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function updatePendingAction(id, patch) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite")
    const store = tx.objectStore(STORE)
    const getReq = store.get(id)
    getReq.onsuccess = () => {
      const cur = getReq.result
      if (!cur) {
        resolve(null)
        return
      }
      const next = { ...cur, ...patch }
      store.put(next)
    }
    getReq.onerror = () => reject(getReq.error)
    tx.oncomplete = () => resolve(true)
    tx.onerror = () => reject(tx.error)
  })
}

export function isOfflineCapable() {
  return typeof indexedDB !== "undefined"
}
