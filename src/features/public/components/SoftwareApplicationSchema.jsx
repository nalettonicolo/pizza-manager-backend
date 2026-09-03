import { useEffect, useState } from "react"
import { getActivePlansForMarketing } from "@/features/superadmin/catalog/plansStorage"
import { safeJsonLdString } from "@/utils/safeJsonLd"

/**
 * JSON-LD SoftwareApplication per il sito pubblico (home/prezzi). I piani (nome + prezzo)
 * sono letti dalla STESSA fonte usata da LandingPlansSection (catalogo superadmin in
 * localStorage), invece di essere hardcodati qui: evita che schema e pagina prezzi visibile
 * finiscano disallineati (vedi nota mod 54 su coerenza dati cross-fonte per la fiducia AI).
 *
 * NON include aggregateRating: le linee guida Google sui rich result vietano di
 * inventare/stimare voti in assenza di recensioni reali e verificabili (vedi mod 54).
 */
function parseEuroToNumber(prezzoLabel) {
  const m = String(prezzoLabel || "").match(/([\d.,]+)/)
  if (!m) return null
  const n = Number(m[1].replace(/\./g, "").replace(",", "."))
  return Number.isFinite(n) ? n : null
}

export default function SoftwareApplicationSchema() {
  const [offers, setOffers] = useState([])

  useEffect(() => {
    const payload = getActivePlansForMarketing()
    const plans = payload?.plans || []
    setOffers(
      plans
        .map((p) => ({ name: p.nome, price: parseEuroToNumber(p.prezzo) }))
        .filter((o) => o.name && o.price != null && o.price > 0),
    )
  }, [])

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "PizzaManager",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description:
      "Gestionale per pizzerie: ordini online, cassa, comande, delivery, magazzino, fidelity, contabilità e multi-sede in un'unica piattaforma.",
    offers: offers.map((o) => ({
      "@type": "Offer",
      name: o.name,
      price: o.price,
      priceCurrency: "EUR",
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: o.price,
        priceCurrency: "EUR",
        billingDuration: "P1M",
      },
    })),
  }

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLdString(jsonLd) }} />
}
