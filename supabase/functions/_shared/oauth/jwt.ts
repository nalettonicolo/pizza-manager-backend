/**
 * JWT HS256 minimale con Web Crypto nativo (nessuna libreria esterna: non presente in
 * supabase/functions/deno.json import map). Usato dal flow OAuth client_credentials
 * (edge function `oauth-token`) e verificato dalle API partner (`api-v1-ordini`).
 */

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = ""
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function base64UrlDecode(input: string): Uint8Array {
  const pad = (4 - (input.length % 4)) % 4
  const padded = input.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(pad)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function textToBytes(s: string): Uint8Array {
  return new TextEncoder().encode(s)
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", textToBytes(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ])
}

export interface JwtPayload {
  [key: string]: unknown
  exp?: number
  iat?: number
}

/** Firma un JWT HS256. `expiresInSec` calcola `exp` da `iat` (default: adesso). */
export async function signJwt(payload: JwtPayload, secret: string, expiresInSec: number): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" }
  const iat = payload.iat ?? Math.floor(Date.now() / 1000)
  const full: JwtPayload = { ...payload, iat, exp: iat + expiresInSec }
  const headerPart = base64UrlEncode(textToBytes(JSON.stringify(header)))
  const payloadPart = base64UrlEncode(textToBytes(JSON.stringify(full)))
  const signingInput = `${headerPart}.${payloadPart}`
  const key = await importHmacKey(secret)
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, textToBytes(signingInput)))
  return `${signingInput}.${base64UrlEncode(signature)}`
}

/** Verifica firma + scadenza; lancia se il token non è valido/scaduto. Ritorna il payload. */
export async function verifyJwt(token: string, secret: string): Promise<JwtPayload> {
  const parts = token.split(".")
  if (parts.length !== 3) throw new Error("jwt_malformato")
  const [headerPart, payloadPart, signaturePart] = parts
  const signingInput = `${headerPart}.${payloadPart}`
  const key = await importHmacKey(secret)
  const valid = await crypto.subtle.verify("HMAC", key, base64UrlDecode(signaturePart), textToBytes(signingInput))
  if (!valid) throw new Error("jwt_firma_non_valida")
  const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(payloadPart))) as JwtPayload
  if (typeof payload.exp === "number" && Math.floor(Date.now() / 1000) >= payload.exp) {
    throw new Error("jwt_scaduto")
  }
  return payload
}
