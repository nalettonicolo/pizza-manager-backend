/**
 * Risolve project-ref e token Management API per gli script SQL (apply / log-attivita).
 * Funziona su Linux (Cursor cloud) e Windows (`supabase login` nel Credential Manager).
 */
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const DEFAULT_PROJECT_REF = "flfhrwzlrftuhkrfwzse"

export function repoRootFromHere(metaUrl = import.meta.url) {
  return join(dirname(fileURLToPath(metaUrl)), "..", "..")
}

function readTrim(path) {
  try {
    return readFileSync(path, "utf8").trim()
  } catch {
    return ""
  }
}

function refFromSupabaseUrl(url) {
  const m = String(url || "").match(/https?:\/\/([a-z0-9]+)\.supabase\.co/i)
  return m ? m[1].toLowerCase() : ""
}

function readEnvFileValue(filePath, key) {
  const raw = readTrim(filePath)
  if (!raw) return ""
  const re = new RegExp(`^${key}=(.*)$`, "m")
  const m = raw.match(re)
  if (!m) return ""
  return m[1].trim().replace(/^['"]|['"]$/g, "")
}

export function resolveSupabaseProjectRef(root) {
  const fromEnv =
    process.env.SUPABASE_PROJECT_REF?.trim() ||
    refFromSupabaseUrl(process.env.SUPABASE_URL) ||
    refFromSupabaseUrl(process.env.VITE_SUPABASE_URL)
  if (fromEnv) return fromEnv

  const tempRef = readTrim(join(root, "supabase", ".temp", "project-ref"))
  if (tempRef) return tempRef

  for (const file of [".env.production", ".env", ".env.local"]) {
    const ref = refFromSupabaseUrl(readEnvFileValue(join(root, file), "VITE_SUPABASE_URL"))
    if (ref) return ref
  }

  return DEFAULT_PROJECT_REF
}

function tokenFromSupabaseCliFiles() {
  const home = homedir()
  const candidates = [
    join(home, ".supabase", "access-token"),
    join(home, "AppData", "Roaming", "supabase", "access-token"),
  ]
  for (const p of candidates) {
    const t = readTrim(p)
    if (t) return t
  }
  return ""
}

function tokenFromPowershellHelper(root) {
  const helper = join(root, "scripts", "lib", "supabase-cli-token.ps1")
  if (!existsSync(helper)) return ""
  try {
    return execFileSync(
      "powershell",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", helper],
      { encoding: "utf8" },
    ).trim()
  } catch {
    return ""
  }
}

export function getSupabaseAccessToken(root) {
  const envTok = process.env.SUPABASE_ACCESS_TOKEN?.trim()
  if (envTok) return envTok
  const fileTok = tokenFromSupabaseCliFiles()
  if (fileTok) return fileTok
  return tokenFromPowershellHelper(root) || null
}

export async function runSupabaseDatabaseQuery({ root, sql }) {
  const projectRef = resolveSupabaseProjectRef(root)
  const token = getSupabaseAccessToken(root)
  if (!token) {
    throw new Error("Token mancante. Esegui `npx supabase login` oppure imposta SUPABASE_ACCESS_TOKEN.")
  }
  const url = `https://api.supabase.com/v1/projects/${projectRef}/database/query`
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  })
  const text = await res.text()
  if (!res.ok) {
    const err = new Error(`Query Supabase fallita (${res.status}): ${text}`)
    err.status = res.status
    err.body = text
    throw err
  }
  return { projectRef, text, json: text ? JSON.parse(text) : null }
}
