#!/usr/bin/env node
/**
 * Ping leggero verso Supabase per resettare il timer di inattività (piano Free).
 * Usabile in locale, CI (GitHub Actions) o cron esterno.
 *
 * Env: SUPABASE_URL (o VITE_SUPABASE_URL) e opzionale SUPABASE_ANON_KEY (o VITE_SUPABASE_ANON_KEY).
 */

import fs from "node:fs";
import path from "node:path";

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

if (!baseUrl) {
  fail(
    "Manca SUPABASE_URL (o VITE_SUPABASE_URL). Esempio: https://<ref>.supabase.co",
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

/** @param {string} path @param {Record<string, string>} [headers] */
async function get(path, headers = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  try {
    const res = await fetch(`${baseUrl}${path}`, {
      method: "GET",
      headers: { Accept: "application/json", ...headers },
      signal: controller.signal,
    });
    const text = await res.text().catch(() => "");
    return { status: res.status, ok: res.ok, snippet: text.slice(0, 120) };
  } finally {
    clearTimeout(timeout);
  }
}

const results = [];

const health = await get("/auth/v1/health");
results.push({ name: "auth/health", ...health });

if (anonKey) {
  const rest = await get("/rest/v1/", {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
  });
  results.push({ name: "rest/v1", ...rest });
}

const anyReachable = results.some((r) => r.status > 0 && r.status < 500);
const authOk = health.status >= 200 && health.status < 400;

console.log(
  `[supabase-keepalive] ${new Date().toISOString()} → ${hostname}`,
);
for (const r of results) {
  console.log(
    `  ${r.name}: HTTP ${r.status}${r.ok ? " (ok)" : ""}`,
  );
}

if (!anyReachable) {
  fail(
    "Nessuna risposta utile da Supabase (progetto in pausa, URL errato o rete).",
  );
}

if (!authOk) {
  console.warn(
    "[supabase-keepalive] auth/health non 2xx — il progetto risponde; verifica stato in Dashboard.",
  );
}

console.log("[supabase-keepalive] Ping completato (attività registrata).");
process.exit(0);
