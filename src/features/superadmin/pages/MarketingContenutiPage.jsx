import { useCallback, useEffect, useState } from "react"
import Loader from "@/components/feedback/Loader"
import ErrorState from "@/components/feedback/ErrorState"
import {
  listBlogArticoli,
  upsertBlogArticolo,
  listLandingPages,
  upsertLandingPage,
} from "@/features/superadmin/services/marketingContenutiService"

const COMBINING_DIACRITICS_RE = new RegExp("[̀-ͯ]", "g")

function slugify(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(COMBINING_DIACRITICS_RE, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
}

function ItemEditor({ item, fields, onChange, onSave, saving, pubblicataKey }) {
  return (
    <div className="border border-slate-200 rounded-lg bg-white p-4 space-y-3">
      {fields.map((f) => (
        <div key={f.key}>
          <label className="block text-xs font-medium text-slate-600 mb-1">{f.label}</label>
          {f.type === "textarea" ? (
            <textarea
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm font-mono"
              rows={f.rows || 10}
              value={item[f.key] || ""}
              onChange={(e) => onChange({ ...item, [f.key]: e.target.value })}
            />
          ) : (
            <input
              type="text"
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
              value={item[f.key] || ""}
              onChange={(e) => onChange({ ...item, [f.key]: e.target.value })}
            />
          )}
        </div>
      ))}
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={!!item[pubblicataKey]}
          onChange={(e) => onChange({ ...item, [pubblicataKey]: e.target.checked })}
        />
        Pubblica{pubblicataKey === "pubblicato" ? "to" : "ta"}
      </label>
      <button
        type="button"
        onClick={() => onSave(item)}
        disabled={saving}
        className="px-4 py-2 text-sm font-medium rounded-md bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-60"
      >
        {saving ? "Salvataggio…" : "Salva"}
      </button>
    </div>
  )
}

const BLOG_FIELDS = [
  { key: "titolo", label: "Titolo" },
  { key: "slug", label: "Slug" },
  { key: "categoria", label: "Categoria" },
  { key: "estratto", label: "Estratto", type: "textarea", rows: 2 },
  { key: "meta_description", label: "Meta description" },
  { key: "contenuto", label: "Contenuto (markdown)", type: "textarea", rows: 14 },
]

const LANDING_FIELDS = [
  { key: "titolo", label: "Titolo" },
  { key: "slug", label: "Slug" },
  { key: "sottotitolo", label: "Sottotitolo" },
  { key: "meta_description", label: "Meta description" },
  { key: "contenuto", label: "Contenuto (markdown)", type: "textarea", rows: 14 },
]

export default function MarketingContenutiPage() {
  const [tab, setTab] = useState("landing")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [blog, setBlog] = useState([])
  const [landing, setLanding] = useState([])
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)

  const ricarica = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [b, l] = await Promise.all([listBlogArticoli(), listLandingPages()])
      setBlog(b)
      setLanding(l)
    } catch (e) {
      setError(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    ricarica()
  }, [ricarica])

  function nuovoBlog() {
    setEditing({ __tipo: "blog", titolo: "", slug: "", categoria: "generale", contenuto: "", pubblicato: false })
  }
  function nuovaLanding() {
    setEditing({ __tipo: "landing", tipo: "modulo", titolo: "", slug: "", contenuto: "", pubblicata: false })
  }

  async function handleSalva(item) {
    setSaving(true)
    setError(null)
    try {
      const payload = { ...item, slug: item.slug ? slugify(item.slug) : slugify(item.titolo) }
      delete payload.__tipo
      if (item.__tipo === "blog") {
        const saved = await upsertBlogArticolo(payload)
        setBlog((prev) => {
          const exists = prev.some((x) => x.id === saved.id)
          return exists ? prev.map((x) => (x.id === saved.id ? saved : x)) : [saved, ...prev]
        })
      } else {
        const saved = await upsertLandingPage(payload)
        setLanding((prev) => {
          const exists = prev.some((x) => x.id === saved.id)
          return exists ? prev.map((x) => (x.id === saved.id ? saved : x)) : [saved, ...prev]
        })
      }
      setEditing(null)
    } catch (e) {
      setError(e)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Loader message="Caricamento contenuti…" />
  if (error && !editing) return <ErrorState message={error?.message || "Errore di caricamento."} />

  const lista = tab === "blog" ? blog : landing

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-slate-900">Marketing — Contenuti</h1>
        <p className="text-sm text-slate-500 mt-1">Landing page e articoli blog del sito pubblico.</p>
      </header>

      <div className="flex gap-2 border-b border-slate-200">
        {[
          { key: "landing", label: `Landing page (${landing.length})` },
          { key: "blog", label: `Blog (${blog.length})` },
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              setTab(t.key)
              setEditing(null)
            }}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === t.key ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500"
            }`}
          >
            {t.label}
          </button>
        ))}
        <button
          type="button"
          onClick={tab === "blog" ? nuovoBlog : nuovaLanding}
          className="ml-auto px-3 py-1.5 text-sm font-medium rounded-md bg-slate-900 text-white hover:bg-slate-800 self-center"
        >
          + Nuovo
        </button>
      </div>

      {editing && (
        <ItemEditor
          item={editing}
          fields={editing.__tipo === "blog" ? BLOG_FIELDS : LANDING_FIELDS}
          onChange={setEditing}
          onSave={handleSalva}
          saving={saving}
          pubblicataKey={editing.__tipo === "blog" ? "pubblicato" : "pubblicata"}
        />
      )}

      <div className="space-y-2">
        {lista.map((item) => {
          const pubKey = tab === "blog" ? "pubblicato" : "pubblicata"
          return (
            <div key={item.id} className="border border-slate-200 rounded-lg bg-white p-3 flex items-center justify-between gap-3">
              <div>
                <p className="font-medium text-slate-900">{item.titolo}</p>
                <p className="text-xs text-slate-400">
                  /{tab === "blog" ? "blog/" : ""}
                  {item.slug} ·{" "}
                  <span className={item[pubKey] ? "text-emerald-700" : "text-slate-500"}>
                    {item[pubKey] ? "pubblicata" : "bozza"}
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditing({ ...item, __tipo: tab })}
                className="text-xs font-medium text-blue-700 underline shrink-0"
              >
                Modifica
              </button>
            </div>
          )
        })}
        {lista.length === 0 && <p className="text-sm text-slate-500">Nessun elemento.</p>}
      </div>
    </div>
  )
}
