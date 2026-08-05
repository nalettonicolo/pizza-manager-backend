import fs from "node:fs"
import path from "node:path"

/** @param {string} file */
export function loadEnvFile(file) {
  const p = path.join(process.cwd(), file)
  if (!fs.existsSync(p)) return
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith("#")) continue
    const eq = t.indexOf("=")
    if (eq <= 0) continue
    const key = t.slice(0, eq).trim()
    let val = t.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (process.env[key] == null || process.env[key] === "") {
      process.env[key] = val
    }
  }
}

export function loadProjectEnv() {
  loadEnvFile(".env.production")
  loadEnvFile(".env")
}

export function getSupabasePublicConfig() {
  loadProjectEnv()
  const baseUrl = (
    process.env.SUPABASE_URL ??
    process.env.VITE_SUPABASE_URL ??
    ""
  )
    .trim()
    .replace(/\/+$/g, "")
  const anonKey = (
    process.env.SUPABASE_ANON_KEY ??
    process.env.VITE_SUPABASE_ANON_KEY ??
    ""
  ).trim()
  return { baseUrl, anonKey }
}
