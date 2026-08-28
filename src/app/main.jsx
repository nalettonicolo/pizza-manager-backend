import React from "react"
import ReactDOM from "react-dom/client"
import { BrowserRouter } from "react-router-dom"

import { initSentry } from "@/utils/initSentry.js"
import { registraErroreOperativo } from "@/utils/registraErroreOperativo"
import AppRouter from "@/router/AppRouter"

/**
 * Cattura i crash JS non gestiti (bucket "errori JS lato client" dell'alert email al supporto, vedi
 * sql/modules/102_alert_errori_supporto.sql). Complementa Sentry (che richiede un DSN configurato e
 * gestisce i propri alert separatamente): questo listener alimenta invece il digest email unico via
 * notifiche_outbox, indipendentemente da Sentry. Silenzioso se il tenant corrente non è noto (vedi
 * src/utils/currentTenantContext.js) — non logga nulla per pagine senza contesto tenant.
 */
window.addEventListener("error", (event) => {
  registraErroreOperativo({
    origine: "frontend:window.onerror",
    messaggio: String(event?.message || event?.error?.message || "Errore JS non gestito").slice(0, 500),
    gravita: "medio",
    dettaglio: {
      stack: String(event?.error?.stack || "").slice(0, 2000),
      url: typeof location !== "undefined" ? location.pathname : "",
    },
  })
})
window.addEventListener("unhandledrejection", (event) => {
  const reason = event?.reason
  registraErroreOperativo({
    origine: "frontend:unhandledrejection",
    messaggio: String(reason?.message || reason || "Promise rifiutata senza handler").slice(0, 500),
    gravita: "medio",
    dettaglio: {
      stack: String(reason?.stack || "").slice(0, 2000),
      url: typeof location !== "undefined" ? location.pathname : "",
    },
  })
})

/** Sentry fuori dal critical path: non compete con first paint (chunk async ~450KB solo se c’è DSN). */
function scheduleInitSentry() {
  const run = () => void initSentry()
  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(run, { timeout: 4000 })
  } else {
    setTimeout(run, 1)
  }
}
scheduleInitSentry()

import { AuthProvider } from "@/app/contexts/AuthContext"
import { UserProvider } from "@/app/contexts/UserContext"
import { TenantProvider } from "@/app/contexts/TenantContext"
import { PvProvider } from "@/app/contexts/PvContext"
import { ThemeProvider } from "@/app/contexts/ThemeContext"
import AppDialogHost from "@/components/ui/AppDialogHost"
import { installAppDialogWindowBridge } from "@/utils/appDialog"

import "@/style.css"
import "@/styles/cassa-mobile.css"

installAppDialogWindowBridge()

const routerFuture = {
  v7_startTransition: true,
  v7_relativeSplatPath: true,
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter future={routerFuture}>
      <AuthProvider>
        <UserProvider>
          <TenantProvider>
            <PvProvider>
              <ThemeProvider>
                <AppRouter />
                <AppDialogHost />
              </ThemeProvider>
            </PvProvider>
          </TenantProvider>
        </UserProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
)
