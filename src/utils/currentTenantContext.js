/**
 * Ultimo tenantId noto lato client, fuori da React — serve al listener globale
 * window.onerror/unhandledrejection (in `src/app/main.jsx`) per sapere a quale tenant attribuire
 * un crash JS, dato che quel listener vive fuori dall'albero dei componenti e non può leggere
 * `useTenant()`/`useAuth()` direttamente.
 *
 * Aggiornato da `TenantContext.jsx` (sessioni autenticate: admin/operative/superadmin/cliente) e da
 * `PublicLayout.jsx` (visitatori anonimi della vetrina, tramite `publicTenantId`). Se nessuno dei
 * due l'ha ancora impostato (es. pagine di marketing senza tenant, superadmin non loggato), resta
 * null e `registraErroreOperativo` scarta silenziosamente l'errore: la tabella
 * `log_errori_operativi` richiede un tenant_id valido per definizione (l'alert riguarda "errori nei
 * tenant operativi", non un log generico di piattaforma).
 */
let currentTenantId = null

export function setCurrentTenantId(tenantId) {
  currentTenantId = tenantId || null
}

export function getCurrentTenantId() {
  return currentTenantId
}
