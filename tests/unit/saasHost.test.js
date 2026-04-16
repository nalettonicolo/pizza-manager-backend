import { describe, it, expect, vi, afterEach } from "vitest"
import { isSaaSHostname } from "@/utils/saasHost"

describe("isSaaSHostname", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("riconosce localhost e dominio ufficiale", () => {
    expect(isSaaSHostname("localhost")).toBe(true)
    expect(isSaaSHostname("app.pizzamanager.it")).toBe(true)
    expect(isSaaSHostname("pizzamanager.it")).toBe(true)
  })

  it("riconosce Firebase Hosting del progetto default", () => {
    expect(isSaaSHostname("pizzeria-da-nicolo.web.app")).toBe(true)
    expect(isSaaSHostname("pizzeria-da-nicolo.firebaseapp.com")).toBe(true)
  })

  it("dominio vetrina cliente non è SaaS platform", () => {
    expect(isSaaSHostname("pizzeria-rossi.it")).toBe(false)
  })

  it("usa VITE_FULL_APP_HOSTNAMES se impostato", () => {
    vi.stubEnv("VITE_FULL_APP_HOSTNAMES", "foo.web.app, bar.firebaseapp.com")
    expect(isSaaSHostname("foo.web.app")).toBe(true)
    expect(isSaaSHostname("bar.firebaseapp.com")).toBe(true)
    expect(isSaaSHostname("other.web.app")).toBe(false)
  })
})
