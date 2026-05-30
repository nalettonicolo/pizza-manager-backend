import { describe, it, expect, vi, afterEach, beforeEach } from "vitest"
import {
  isAuthFetchNetworkFailure,
  isSupabaseBuildConfigured,
  resolveSupabaseUrlForRuntime,
  getSupabaseConfiguredHostname,
  supabaseLoginNetworkHelpMessage,
} from "@/lib/supabaseEnv"

describe("resolveSupabaseUrlForRuntime", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("rimuove slash finali", () => {
    expect(resolveSupabaseUrlForRuntime("https://abc.supabase.co///")).toBe(
      "https://abc.supabase.co",
    )
  })

  it("in produzione HTTPS promuove http://*.supabase.co a https://", () => {
    vi.stubEnv("PROD", true)
    vi.stubGlobal("window", { location: { protocol: "https:" } })
    expect(
      resolveSupabaseUrlForRuntime("http://flfhrwzlrftuhkrfwzse.supabase.co"),
    ).toBe("https://flfhrwzlrftuhkrfwzse.supabase.co")
  })

  it("non altera http:// localhost in dev", () => {
    vi.stubEnv("PROD", false)
    expect(resolveSupabaseUrlForRuntime("http://127.0.0.1:54321")).toBe(
      "http://127.0.0.1:54321",
    )
  })
})

describe("isSupabaseBuildConfigured", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("false se URL o key mancanti", () => {
    vi.stubEnv("VITE_SUPABASE_URL", "")
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "key")
    expect(isSupabaseBuildConfigured()).toBe(false)
  })

  it("true con URL https e key presenti", () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://abc.supabase.co")
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "eyJ-test")
    expect(isSupabaseBuildConfigured()).toBe(true)
  })
})

describe("isAuthFetchNetworkFailure", () => {
  it("riconosce TypeError Failed to fetch", () => {
    expect(isAuthFetchNetworkFailure(new TypeError("Failed to fetch"))).toBe(true)
  })

  it("riconosce messaggio network request failed", () => {
    expect(isAuthFetchNetworkFailure({ message: "Network request failed" })).toBe(true)
  })

  it("false su errore credenziali", () => {
    expect(isAuthFetchNetworkFailure({ message: "Invalid login credentials" })).toBe(
      false,
    )
  })
})

describe("getSupabaseConfiguredHostname", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("estrae hostname dal URL configurato", () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://flfhrwzlrftuhkrfwzse.supabase.co")
    expect(getSupabaseConfiguredHostname()).toBe("flfhrwzlrftuhkrfwzse.supabase.co")
  })
})

describe("supabaseLoginNetworkHelpMessage", () => {
  const originalWindow = globalThis.window

  beforeEach(() => {
    vi.stubEnv("PROD", true)
    vi.stubEnv("VITE_SUPABASE_URL", "http://flfhrwzlrftuhkrfwzse.supabase.co")
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "key")
    vi.stubGlobal("window", { location: { protocol: "https:" } })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.stubGlobal("window", originalWindow)
  })

  it("include guida .env.production e hostname risolto", () => {
    const msg = supabaseLoginNetworkHelpMessage()
    expect(msg).toMatch(/\.env\.production/)
    expect(msg).toMatch(/flfhrwzlrftuhkrfwzse\.supabase\.co/)
    expect(msg).toMatch(/https:\/\//)
  })
})
