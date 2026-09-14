// Preload minimale: nessun ponte IPC necessario oggi (l'app web non chiede funzioni native).
// Espone un flag per far sapere al sito che gira dentro l'app desktop (usato per nascondere link
// e banner senza senso lì, es. "torna alla home" o "installa la PWA" — si è già dentro l'app) e,
// se presenti, i dati del tenant "riconosciuto" via Partita IVA in fase di installazione (vedi
// electron/build/installer.nsh e main.cjs) — solo nome/indirizzo/logo, mai credenziali.
const { contextBridge } = require("electron")

function readTenantBindingArg() {
  const prefix = "--pm-tenant-binding="
  const arg = process.argv.find((a) => a.startsWith(prefix))
  if (!arg) return null
  try {
    return JSON.parse(arg.slice(prefix.length))
  } catch {
    return null
  }
}

contextBridge.exposeInMainWorld("pizzaManagerDesktop", {
  isDesktopApp: true,
  tenantHint: readTenantBindingArg(),
})
