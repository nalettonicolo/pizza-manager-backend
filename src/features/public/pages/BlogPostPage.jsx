import { useEffect, useState } from "react"
import { useParams, Link } from "react-router-dom"
import ReactMarkdown from "react-markdown"
import { getBlogArticoloBySlug } from "@/features/public/services/marketingPublicService"

/**
 * Rendering pubblico di UN articolo blog, letto da public.blog_articoli tramite slug.
 * Rotta /blog/:slug.
 */
export default function BlogPostPage() {
  const { slug } = useParams()
  const [post, setPost] = useState(undefined)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    let alive = true
    setPost(undefined)
    setNotFound(false)
    getBlogArticoloBySlug(slug).then((row) => {
      if (!alive) return
      if (row) {
        setPost(row)
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
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Articolo non trovato</h1>
        <p style={{ color: "#64748b", marginTop: 8 }}>
          <Link to="/" style={{ color: "#2563eb", textDecoration: "underline" }}>
            Torna alla home
          </Link>
        </p>
      </div>
    )
  }

  if (!post) return null

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.titolo,
    description: post.meta_description || post.estratto || undefined,
    author: { "@type": "Organization", name: post.autore || "PizzaManager" },
    datePublished: post.data_pubblicazione || post.created_at,
  }

  return (
    <article style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {post.categoria && (
        <span style={{ fontSize: 12, fontWeight: 600, color: "#2563eb", textTransform: "uppercase" }}>
          {post.categoria}
        </span>
      )}
      <h1 style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.2, marginTop: 6 }}>{post.titolo}</h1>
      {post.data_pubblicazione && (
        <p style={{ fontSize: 13, color: "#94a3b8", marginTop: 8 }}>
          {new Date(post.data_pubblicazione).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" })}
        </p>
      )}
      <div style={{ marginTop: 24, fontSize: 16, lineHeight: 1.7, color: "#1e293b" }}>
        <ReactMarkdown>{post.contenuto}</ReactMarkdown>
      </div>
    </article>
  )
}
