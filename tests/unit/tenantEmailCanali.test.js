import { describe, it, expect } from "vitest"
import {
  emailDomainForTenantForm,
  suggestedMailboxAddresses,
  mergeTenantEmailCanaliIntoParametri,
  tenantEmailCanaliFromParametri,
  normalizeEmailDomainHost,
} from "@/features/superadmin/utils/tenantEmailCanali"

describe("tenantEmailCanali", () => {
  it("normalizza hostname da URL", () => {
    expect(normalizeEmailDomainHost("https://www.FrancyPizza.it/menu")).toBe("francypizza.it")
  })

  it("preferisce dominio personalizzato allo slug piattaforma", () => {
    expect(emailDomainForTenantForm({ public_domain: "francypizza.it", slug: "francy" })).toBe(
      "francypizza.it",
    )
    expect(emailDomainForTenantForm({ public_domain: "", slug: "francy" })).toBe(
      "francy.pizzamanager.it",
    )
  })

  it("suggerisce le tre caselle sul dominio del locale", () => {
    expect(suggestedMailboxAddresses("francypizza.it")).toEqual({
      email_noreply: "no-reply@francypizza.it",
      email_info: "info@francypizza.it",
      email_support: "support@francypizza.it",
    })
  })

  it("in modifica conserva smtp_pass se il campo password è vuoto", () => {
    const merged = mergeTenantEmailCanaliIntoParametri(
      { smtp_host: "old.example", smtp_pass: "segreto", email_info: "a@b.it" },
      {
        email_noreply: "no-reply@francypizza.it",
        email_info: "info@francypizza.it",
        email_support: "support@francypizza.it",
        smtp_host: "authsmtp.securemail.pro",
        smtp_port: "465",
        smtp_user: "info@francypizza.it",
        smtp_pass: "",
      },
    )
    expect(merged.smtp_pass).toBe("segreto")
    expect(merged.smtp_host).toBe("authsmtp.securemail.pro")
    expect(merged.email_noreply).toBe("no-reply@francypizza.it")
  })

  it("non espone la password nel form di lettura", () => {
    const form = tenantEmailCanaliFromParametri({ smtp_pass: "segreto", email_info: "x@y.it" })
    expect(form.smtp_pass).toBe("")
    expect(form.smtp_pass_impostata).toBe(true)
    expect(form.email_info).toBe("x@y.it")
  })
})
