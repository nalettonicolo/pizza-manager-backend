import {
  apiClient,
  getNestJwt,
  setNestJwt,
  clearNestJwt,
} from "@/app/api/client.js"

function axiosErrMessage(err) {
  const d = err.response?.data
  if (typeof d?.message === "string") return d.message
  if (Array.isArray(d?.message)) return d.message.join(", ")
  return err.message || "Errore di rete"
}

/**
 * Login Nest → salva JWT in localStorage (`pm_nest_jwt`) per le richieste successive.
 * Restituisce la stessa forma di `supabase.auth.signInWithPassword` (`{ data, error }`).
 */
export async function nestAuthLogin(email, password) {
  try {
    const { data } = await apiClient.post("/api/auth/login", { email, password })
    if (data?.token) setNestJwt(data.token)
    const u = data?.user
    return {
      data: {
        user: u ? { id: u.id, email: u.email, ...u } : null,
        session: data?.token ? { access_token: data.token } : null,
      },
      error: null,
    }
  } catch (err) {
    return {
      data: { user: null, session: null },
      error: { message: axiosErrMessage(err) },
    }
  }
}

export async function nestAuthMe() {
  const { data } = await apiClient.get("/api/auth/me")
  return data
}

/**
 * Rinnova JWT Nest (Bearer attuale richiesto). Aggiorna `pm_nest_jwt` se ok.
 * @returns {{ token?: string } | null}
 */
export async function nestAuthRefresh() {
  if (!getNestJwt()) return null
  try {
    const { data } = await apiClient.post("/api/auth/refresh")
    if (data?.token) setNestJwt(data.token)
    return data ?? null
  } catch {
    return null
  }
}

/** Chiama POST /api/auth/logout (best-effort) e rimuove il JWT locale. */
export async function nestAuthLogout() {
  if (getNestJwt()) {
    try {
      await apiClient.post("/api/auth/logout")
    } catch {
      /* rete / 401: pulizia locale resta prioritaria */
    }
  }
  clearNestJwt()
}
