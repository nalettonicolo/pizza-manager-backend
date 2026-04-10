import axios from "axios"
import { logHttpError } from "@/utils/logSupabaseError.js"

/**
 * Base URL del backend Nest (senza slash finale), da `import.meta.env.VITE_API_URL`.
 * @type {string}
 */
const baseURL =
  typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace(/\/$/, "")
    : ""

/**
 * Client HTTP verso il backend SaaS (auth, integrazioni). **Non** usare per Supabase REST:
 * per quello usare `src/lib/supabaseClient` e `unwrapSupabase` / `logSupabaseError`.
 * @type {import('axios').AxiosInstance}
 */
export const apiClient = axios.create({ baseURL })

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
