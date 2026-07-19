#!/usr/bin/env node
/**
 * Ping leggero verso Supabase per resettare il timer di inattività (piano Free).
 * Usabile in locale, CI (GitHub Actions) o cron esterno.
 *
 * Env: SUPABASE_URL (o VITE_SUPABASE_URL) e opzionale SUPABASE_ANON_KEY (o VITE_SUPABASE_ANON_KEY).
 * In CI: secrets SUPABASE_URL + SUPABASE_ANON_KEY (Settings → Actions secrets).
 */

import fs from "node:fs";
import path from "node:path";

const MAX_ATTEMPTS = 3;
const RETRY_MS = 4_000;
const REQ_TIMEOUT_MS = 25_000;

/** @param {string} file */
function loadEnvFile(file) {
  const p = path.join(process.cwd(), file);
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] == null || process.env[key] === "") {
      process.env[key] = val;
    }
  }
}

loadEnvFile(".env.production");
loadEnvFile(".env");

const rawUrl = (
  process.env.SUPABASE_URL ??
  process.env.VITE_SUPABASE_URL ??
  ""
).trim();
const anonKey = (
  process.env.SUPABASE_ANON_KEY ??
  process.env.VITE_SUPABASE_ANON_KEY ??
  ""
).trim();

const baseUrl = rawUrl.replace(/\/+$/g, "");

function fail(msg, code = 1) {
  console.error(`[supabase-keepalive] ${msg}`);
  process.exit(code);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

if (!baseUrl) {
  fail(
    "Manca SUPABASE_URL (o VITE_SUPABASE_URL). In GitHub: Settings → Secrets → Actions → SUPABASE_URL = https://<ref>.supabase.co",
  );
}

let hostname;
try {
  const u = new URL(baseUrl);
  if (!u.hostname.endsWith(".supabase.co")) {
    fail(`Host non Supabase hosted: ${u.hostname}`);
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") {
    fail(`Protocollo non valido: ${u.protocol}`);
  }
  hostname = u.hostname;
} catch {
  fail(`URL non valido: ${baseUrl}`);
}

/**
 * @param {string} reqPath
 * @param {Record<string, string>} [headers]
 * @returns {Promise<{ status: number, ok: boolean, snippet: string, error?: string }>}
 */
async function get(reqPath, headers = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQ_TIMEOUT_MS);
  try {
    const res = await fetch(`${baseUrl}${reqPath}`, {
      method: "GET",
      headers: { Accept: "application/json", ...headers },
      signal: controller.signal,
    });
    const text = await res.text().catch(() => "");
    return { status: res.status, ok: res.ok, snippet: text.slice(0, 120) };
  } catch (e) {
    const msg = e?.name === "AbortError" ? "timeout" : String(e?.message || e);
    return { status: 0, ok: false, snippet: "", error: msg };
  } finally {
    clearTimeout(timeout);
  }
}

/** Qualsiasi risposta HTTP dal progetto conta come attività (anche 401/404). */
function isUsefulResponse(r) {
  return r && Number(r.status) > 0 && Number(r.status) < 600;
}

async function pingOnce() {
  const results = [];
  const authHeaders = anonKey
    ? { apikey: anonKey, Authorization: `Bearer ${anonKey}` }
    : {};

  const health = await get("/auth/v1/health", authHeaders);
  results.push({ name: "auth/health", ...health });

  if (anonKey) {
    const rest = await get("/rest/v1/", {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    });
    results.push({ name: "rest/v1", ...rest });
  } else {
    // Senza anon key: ping root Auth (può rispondere 401 ma conferma che il progetto è su)
    results.push({ name: "rest/v1", status: 0, ok: false, error: "no_anon_key" });
  }

  return results;
}

console.log(
  `[supabase-keepalive] ${new Date().toISOString()} → ${hostname}`,
);
if (!anonKey) {
  console.warn(
    "[supabase-keepalive] SUPABASE_ANON_KEY assente: userò solo auth/health. In CI aggiungi anche il secret anon.",
  );
}

let lastResults = [];
let success = false;

for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
  lastResults = await pingOnce();
  for (const r of lastResults) {
    const extra = r.error ? ` (${r.error})` : r.ok ? " (ok)" : "";
    console.log(`  [try ${attempt}/${MAX_ATTEMPTS}] ${r.name}: HTTP ${r.status}${extra}`);
  }
  if (lastResults.some(isUsefulResponse)) {
    success = true;
    break;
  }
  if (attempt < MAX_ATTEMPTS) {
    console.warn(
      `[supabase-keepalive] Nessuna risposta utile — retry tra ${RETRY_MS}ms (progetto in pausa o rete).`,
    );
    await sleep(RETRY_MS);
  }
}

if (!success) {
  fail(
    "Nessuna risposta utile da Supabase dopo i retry (progetto in pausa, URL/secret errati o rete). Verifica Dashboard e secrets SUPABASE_URL / SUPABASE_ANON_KEY.",
  );
}

console.log("[supabase-keepalive] Ping completato (attività registrata).");
process.exit(0);
