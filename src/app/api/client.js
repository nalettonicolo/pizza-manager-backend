import axios from "axios"
import { logHttpError } from "@/utils/logSupabaseError.js"

/** Chiave localStorage per JWT Nest (Fase 1+ verso taglio Supabase). */
export const NEST_JWT_STORAGE_KEY = "pm_nest_jwt"

/**
 * Base URL del backend Nest (senza slash finale), da `import.meta.env.VITE_API_URL`.
 * @type {string}
 */
const baseURL =
  typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace(/\/$/, "")
    : ""

export function getNestJwt() {
  if (typeof localStorage === "undefined") return null
  return localStorage.getItem(NEST_JWT_STORAGE_KEY)
}

export function setNestJwt(token) {
  if (!token || typeof localStorage === "undefined") return
  localStorage.setItem(NEST_JWT_STORAGE_KEY, token)
}

export function clearNestJwt() {
  if (typeof localStorage === "undefined") return
  localStorage.removeItem(NEST_JWT_STORAGE_KEY)
}

/**
 * Client HTTP verso il backend SaaS (auth, integrazioni). **Non** usare per Supabase REST:
 * per quello usare `src/lib/supabaseClient` e `unwrapSupabase` / `logSupabaseError`.
 * @type {import('axios').AxiosInstance}
 */
export const apiClient = axios.create({ baseURL })

apiClient.interceptors.request.use((config) => {
  if (!baseURL) return config
  const token = getNestJwt()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status
    const url = err.config?.url
    logHttpError("apiClient", err, {
      status,
      url,
      method: err.config?.method,
    })
    return Promise.reject(err)
  }
)
