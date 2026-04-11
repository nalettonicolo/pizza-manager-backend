import React from "react"
import ReactDOM from "react-dom/client"
import { BrowserRouter } from "react-router-dom"

import { initSentry } from "@/utils/initSentry.js"
import AppRouter from "@/router/AppRouter"

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

import "@/style.css"

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
              </ThemeProvider>
            </PvProvider>
          </TenantProvider>
        </UserProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
)
