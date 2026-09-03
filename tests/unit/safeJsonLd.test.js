import { describe, expect, it } from "vitest"
import { safeJsonLdString } from "@/utils/safeJsonLd"

describe("safeJsonLdString", () => {
  it("serializza normalmente un oggetto senza caratteri pericolosi", () => {
    expect(safeJsonLdString({ a: 1, b: "ciao" })).toBe('{"a":1,"b":"ciao"}')
  })

  it("non lascia mai un < letterale nell'output (niente chiusura anticipata di </script>)", () => {
    const out = safeJsonLdString({ titolo: "Offerta</script><script>alert(1)</script>" })
    expect(out).not.toContain("<")
    expect(out).toContain("\\u003c/script>")
  })

  it("il valore resta correttamente decodificabile come JSON valido con il < originale", () => {
    const original = { domanda: "Cosa <significa> questo?" }
    const out = safeJsonLdString(original)
    expect(JSON.parse(out)).toEqual(original)
  })
})
