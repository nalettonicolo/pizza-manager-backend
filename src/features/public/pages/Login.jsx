// 📍 src/features/public/pages/Login.jsx

import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "@/app/contexts/AuthContext"
import { devLog } from "@/lib/devLog"

export default function Login() {
  const { login, ruolo, tipoUtente, user, loading } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  // ===================================================
  // REDIRECT AUTOMATICO DOPO LOGIN
  // ===================================================

  useEffect(() => {
    if (loading) return
    if (!user || !tipoUtente) return

    devLog("Login", "redirect check", { tipoUtente, ruolo, email: user?.email })

    // ================= CLIENTE =================
    if (tipoUtente === "cliente") {
      devLog("Login", "redirect → /cliente/dashboard")
      navigate("/cliente/dashboard", { replace: true })
      return
    }

    // ================= STAFF =================
    if (tipoUtente === "staff") {
      const roleRoutes = {
        superadmin: "/superadmin/dashboard",
        admin: "/admin/dashboard",
        operatore: "/operative/dashboard",
        cassa: "/operative/cassa",
        bancone: "/operative/bancone",
        cucina: "/operative/cucina",
        pizzaiolo: "/operative/dashboard",
        delivery: "/operative/delivery",
        pony: "/operative/pony",
      }
      const targetRoute = roleRoutes[ruolo] || "/operative/dashboard"

      devLog("Login", "redirect →", targetRoute, { ruolo })
      navigate(targetRoute, { replace: true })
      return
    }

    devLog("Login", "fallback redirect → /")
    navigate("/", { replace: true })
  }, [user, ruolo, tipoUtente, loading, navigate])

  // ===================================================
  // SUBMIT LOGIN
  // ===================================================

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    devLog("Login", "submit", { email })

    const { data, error } = await login(email, password)

    if (error) {
      devLog("Login", "submit error", error.message)
      setError(error.message)
    } else {
      devLog("Login", "submit ok, in attesa redirect", { userId: data?.user?.id })
    }
    setSubmitting(false)
  }

  // ===================================================
  // LOADING SESSIONE
  // ===================================================

  if (loading) {
    devLog("Login", "in attesa sessione (loading=true)...")
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Verifica sessione...</p>
      </div>
    )
  }

  // ===================================================
  // UI
  // ===================================================

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded shadow-md w-96">
        <h1 className="text-xl font-bold mb-6 text-center">
          Login
        </h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="border p-2 rounded"
            required
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="border p-2 rounded"
            required
          />

          {error && (
            <p className="text-red-600 text-sm">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="bg-black text-white p-2 rounded disabled:opacity-50"
          >
            {submitting ? "Accesso..." : "Accedi"}
          </button>

        </form>
      </div>
    </div>
  )
}