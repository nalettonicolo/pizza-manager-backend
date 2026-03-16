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
  const [noProfileError, setNoProfileError] = useState(false)

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
      const ruoloNorm = (ruolo && typeof ruolo === "string") ? ruolo.toLowerCase().trim() : ""
      const targetRoute = roleRoutes[ruoloNorm] || "/operative/dashboard"

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
    setNoProfileError(false)
    setSubmitting(true)
    devLog("Login", "submit", { email })

    const result = await login(email, password)
    const err = result?.error
    const data = result?.data

    if (err) {
      devLog("Login", "submit error", err.message)
      setError(err.message || "Errore di accesso")
    } else {
      devLog("Login", "submit ok, in attesa redirect", { userId: data?.user?.id })
    }
    setSubmitting(false)
  }

  // Messaggio se autenticato ma senza profilo (utenti_ruoli/clienti)
  useEffect(() => {
    if (!loading && user && tipoUtente === null && ruolo === null) {
      setNoProfileError(true)
    } else {
      setNoProfileError(false)
    }
  }, [loading, user, tipoUtente, ruolo])

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
          {noProfileError && (
            <p className="text-amber-700 text-sm bg-amber-50 p-2 rounded mt-2">
              Accesso effettuato ma nessun profilo attivo. Verifica in Supabase che il tuo utente sia presente in <strong>public.utenti_ruoli</strong> (campo <strong>ruolo</strong> = superadmin) con il tuo user_id.
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