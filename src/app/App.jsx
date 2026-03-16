// 📍 src/App.jsx

import { Routes, Route, Navigate } from "react-router-dom"

import Landing from "@/app/pages/Landing"
import Login from "@/app/pages/Login"

// STAFF
import SuperAdmin from "@/app/pages/superadmin/Dashboard"
import Admin from "@/app/pages/admin/Dashboard"

import Cassa from "@/app/pages/operative/Cassa"
import Bancone from "@/app/pages/operative/Bancone"
import Cucina from "@/app/pages/operative/Cucina"
import Pizzaiolo from "@/app/pages/operative/Pizzaiolo"
import Delivery from "@/app/pages/operative/Delivery"

// CLIENTI
import ClienteDashboard from "@/app/pages/cliente/Dashboard"
import ClienteOrdini from "@/app/pages/cliente/Ordini"
import ClienteProfilo from "@/app/pages/cliente/Profilo"

import ProtectedRoute from "@/components/ProtectedRoute"
import CustomerRoute from "@/components/CustomerRoute"

function App() {
  return (
    <Routes>

        {/* ===================== PUBLIC ===================== */}
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />

        {/* ===================== AREA CLIENTI ===================== */}
        <Route element={<CustomerRoute />}>
          <Route path="/cliente/dashboard" element={<ClienteDashboard />} />
          <Route path="/cliente/ordini" element={<ClienteOrdini />} />
          <Route path="/cliente/profilo" element={<ClienteProfilo />} />
        </Route>

        {/* ===================== SUPERADMIN ===================== */}
        <Route element={<ProtectedRoute allowedRoles={["superadmin"]} />}>
          <Route path="/superadmin" element={<SuperAdmin />} />
        </Route>

        {/* ===================== ADMIN ===================== */}
        <Route element={<ProtectedRoute allowedRoles={["admin"]} />}>
          <Route path="/admin" element={<Admin />} />
        </Route>

        {/* ===================== OPERATIVE (DEMO INTERNO) ===================== */}
        {/* SOLO dominio @pizzamanager.it */}

        <Route element={<ProtectedRoute allowedRoles={["cassa"]} demoOnly />}>
          <Route path="/operative/cassa" element={<Cassa />} />
        </Route>

        <Route element={<ProtectedRoute allowedRoles={["bancone"]} demoOnly />}>
          <Route path="/operative/bancone" element={<Bancone />} />
        </Route>

        <Route element={<ProtectedRoute allowedRoles={["cucina"]} demoOnly />}>
          <Route path="/operative/cucina" element={<Cucina />} />
        </Route>

        <Route element={<ProtectedRoute allowedRoles={["pizzaiolo"]} demoOnly />}>
          <Route path="/operative/pizzaiolo" element={<Pizzaiolo />} />
        </Route>

        <Route element={<ProtectedRoute allowedRoles={["delivery"]} demoOnly />}>
          <Route path="/operative/delivery" element={<Delivery />} />
        </Route>

        {/* ===================== FALLBACK ===================== */}
        <Route path="*" element={<Navigate to="/" replace />} />

      </Routes>
  )
}

export default App