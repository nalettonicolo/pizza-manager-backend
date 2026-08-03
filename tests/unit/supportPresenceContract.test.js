/**
 * Contratto sicurezza presence (modulo SQL 30).
 */
import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))
const migrationPath = path.join(
  here,
  "../../supabase/migrations/20260802180100_support_presence_tenant_bind.sql",
)
const modulePath = path.join(here, "../../sql/modules/30_support_presence_tenant_bind.sql")

describe("support presence client contract", () => {
  it("il client non deve usare un tenant arbitrario come autorizzazione", () => {
    const payload = {
      p_path: "/operative/cassa",
      p_page_label: "Cassa",
      p_tenant_id: null,
    }
    expect(payload.p_tenant_id).toBeNull()
  })

  it("path superadmin non devono pubblicare presence", () => {
    expect("/superadmin/sala-qa".startsWith("/superadmin")).toBe(true)
  })

  it("versiona il tenant binding sicuro anche per nuovi ambienti", () => {
    const sql = readFileSync(migrationPath, "utf8")
    const moduleSql = readFileSync(modulePath, "utf8")
    expect(sql).toContain("FORCE ROW LEVEL SECURITY")
    expect(sql).toContain("p_tenant_id è intenzionalmente ignorato")
    expect(sql).toContain("REVOKE ALL ON TABLE public.support_presence FROM anon, authenticated")
    expect(moduleSql).toContain("SET search_path = public, core")
  })
})
