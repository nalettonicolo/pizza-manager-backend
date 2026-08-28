import { useEffect, useState } from "react"
import { getFaqPubbliche } from "@/features/public/services/marketingPublicService"

/**
 * Blocco FAQ per il sito pubblico: legge public.faq_pubbliche e genera sia il contenuto
 * visibile sia il JSON-LD FAQPage dalla stessa fonte, per evitare disallineamenti tra
 * ciò che l'utente vede e ciò che leggono i crawler (vedi mod 54 in note_marketing).
 */
export default function FaqSection() {
  const [faq, setFaq] = useState([])
  const [open, setOpen] = useState(null)

  useEffect(() => {
    let alive = true
    getFaqPubbliche().then((rows) => {
      if (alive) setFaq(rows)
    })
    return () => {
      alive = false
    }
  }, [])

  if (faq.length === 0) return null

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((f) => ({
      "@type": "Question",
      name: f.domanda,
      acceptedAnswer: { "@type": "Answer", text: f.risposta },
    })),
  }

  return (
    <section className="faq-section" aria-labelledby="faq-heading" style={{ padding: "48px 24px", maxWidth: 780, margin: "0 auto" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <h2 id="faq-heading" style={{ fontSize: 24, fontWeight: 700, marginBottom: 20 }}>
        Domande frequenti
      </h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {faq.map((f) => {
          const isOpen = open === f.id
          return (
            <div key={f.id} style={{ border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : f.id)}
                aria-expanded={isOpen}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "14px 16px",
                  background: "#fff",
                  border: "none",
                  fontWeight: 600,
                  fontSize: 15,
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                {f.domanda}
                <span aria-hidden="true">{isOpen ? "−" : "+"}</span>
              </button>
              {isOpen && (
                <div style={{ padding: "0 16px 16px", color: "#475569", fontSize: 14, lineHeight: 1.6 }}>
                  {f.risposta}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
