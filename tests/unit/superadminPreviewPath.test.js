import { describe, it, expect } from "vitest"
import { sanitizeSuperadminPreviewPath } from "@/features/superadmin/utils/viewportTesterShared"

describe("sanitizeSuperadminPreviewPath", () => {
  it("accetta path interni", () => {
    expect(sanitizeSuperadminPreviewPath("/preview")).toBe("/preview")
    expect(sanitizeSuperadminPreviewPath("/admin/home")).toBe("/admin/home")
  })

  it("rifiuta assoluti e protocolli", () => {
    expect(sanitizeSuperadminPreviewPath("//evil.com")).toBe("/preview")
    expect(sanitizeSuperadminPreviewPath("https://x.com")).toBe("/preview")
  })

  it("normalizza senza hash", () => {
    expect(sanitizeSuperadminPreviewPath("/negozio#foo")).toBe("/negozio")
  })
})
