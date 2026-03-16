import React from "react"
import ReactDOM from "react-dom/client"
import { BrowserRouter } from "react-router-dom"

import AppRouter from "@/router/AppRouter"

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
