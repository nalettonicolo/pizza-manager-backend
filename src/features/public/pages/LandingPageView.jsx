import { useEffect, useState } from "react"
import { useParams, Link } from "react-router-dom"
import ReactMarkdown from "react-markdown"
import { getLandingPageBySlug } from "@/features/public/services/marketingPublicService"

/**
 * Rendering pubblico di UNA landing page (modulo/confronto/generico), letta da
 * public.landing_pages tramite slug. Rotta /:slug (dopo le rotte fisse del router pubblico).
 */
export default function LandingPageView() {
  const { slug } = useParams()
  const [page, setPage] = useState(undefined) // undefined = loading, null = non trovata
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    let alive = true
    setPage(undefined)
    setNotFound(false)
    getLandingPageBySlug(slug).then((row) => {
      if (!alive) return
      if (row) {
        setPage(row)
      } else {
        setNotFound(true)
      }
    })
    return () => {
      alive = false
    }
  }, [slug])

  if (notFound) {
    return (
      <div style={{ padding: "64px 24px", textAlign: "center" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Pagina non trovata</h1>
        <p style={{ color: "#64748b", marginTop: 8 }}>
          <Link to="/" style={{ color: "#2563eb", textDecoration: "underline" }}>
            Torna alla home
          </Link>
        </p>
      </div>
    )
  }

  if (!page) return null

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: page.titolo,
    description: page.meta_description || page.sottotitolo || undefined,
  }

  return (
    <article style={{ maxWidth: 760, margin: "0 auto", padding: "48px 24px" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <h1 style={{ fontSize: 32, fontWeight: 800, lineHeight: 1.2 }}>{page.titolo}</h1>
      {page.sottotitolo && (
        <p style={{ fontSize: 18, color: "#475569", marginTop: 10 }}>{page.sottotitolo}</p>
      )}
      <div style={{ marginTop: 28, fontSize: 16, lineHeight: 1.7, color: "#1e293b" }}>
        <ReactMarkdown>{page.contenuto}</ReactMarkdown>
      </div>
      <p style={{ marginTop: 40 }}>
        <Link to="/contatti#prova-gratuita" style={{ color: "#2563eb", fontWeight: 600, textDecoration: "underline" }}>
          Richiedi una prova o una demo
        </Link>
      </p>
    </article>
  )
}
