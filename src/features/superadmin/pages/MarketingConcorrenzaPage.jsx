import { useCallback, useEffect, useState } from "react"
import Loader from "@/components/feedback/Loader"
import ErrorState from "@/components/feedback/ErrorState"
import {
  listConcorrenti,
  listNoteMarketing,
  updateNotaStato,
  NOTA_STATI,
} from "@/features/superadmin/services/marketingConcorrenzaService"

const STATO_LABEL = {
  da_valutare: "Da valutare",
  approvata: "Approvata",
  scartata: "Scartata",
  implementata: "Implementata",
}

function ConcorrenteCard({ c }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border border-slate-200 rounded-lg bg-white">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div>
          <span className="font-semibold text-slate-900">{c.nome}</span>
          {c.url && (
            <a
              href={c.url}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-2 text-xs text-blue-600 underline"
              onClick={(e) => e.stopPropagation()}
            >
              {c.url}
            </a>
          )}
          <p className="text-xs text-slate-500 mt-0.5">
            {c.categoria} · {c.prezzo_min != null ? `${c.prezzo_min}–${c.prezzo_max ?? "?"}€` : "prezzo n/d"}
          </p>
        </div>
        <span className="text-slate-400 text-sm">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 text-sm text-slate-700 space-y-2 border-t border-slate-100 pt-3">
          {c.modello_prezzo && <p><strong>Modello prezzo:</strong> {c.modello_prezzo}</p>}
          {c.punti_forza && <p><strong>Punti di forza:</strong> {c.punti_forza}</p>}
          {c.punti_debolezza && <p><strong>Punti deboli:</strong> {c.punti_debolezza}</p>}
          {c.note && <p><strong>Note:</strong> {c.note}</p>}
          {c.fonte_url && (
            <p>
              <strong>Fonte:</strong>{" "}
              <a href={c.fonte_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                {c.fonte_url}
              </a>
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export default function MarketingConcorrenzaPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [concorrenti, setConcorrenti] = useState([])
  const [note, setNote] = useState([])
  const [filtroCategoria, setFiltroCategoria] = useState("")

  const ricarica = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [c, n] = await Promise.all([listConcorrenti(), listNoteMarketing()])
      setConcorrenti(c)
      setNote(n)
    } catch (e) {
      setError(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    ricarica()
  }, [ricarica])

  async function handleCambiaStato(nota, stato) {
    try {
      const aggiornata = await updateNotaStato(nota.id, stato)
      setNote((prev) => prev.map((n) => (n.id === aggiornata.id ? aggiornata : n)))
    } catch (e) {
      setError(e)
    }
  }

  if (loading) return <Loader message="Caricamento marketing e concorrenza…" />
  if (error) return <ErrorState message={error?.message || "Errore di caricamento."} />

  const categorie = [...new Set(note.map((n) => n.categoria))].sort()
  const noteFiltrate = filtroCategoria ? note.filter((n) => n.categoria === filtroCategoria) : note

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-8">
      <header>
        <h1 className="text-xl font-semibold text-slate-900">Marketing e Concorrenza</h1>
        <p className="text-sm text-slate-500 mt-1">Diario di lavoro continuo: concorrenti monitorati e note strategiche.</p>
      </header>

      <section>
        <h2 className="text-sm font-semibold text-slate-900 mb-3">Concorrenti ({concorrenti.length})</h2>
        <div className="space-y-2">
          {concorrenti.map((c) => (
            <ConcorrenteCard key={c.id} c={c} />
          ))}
          {concorrenti.length === 0 && <p className="text-sm text-slate-500">Nessun concorrente censito.</p>}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-900">Note strategiche ({noteFiltrate.length})</h2>
          <select
            className="border border-slate-300 rounded-md px-2 py-1 text-xs"
            value={filtroCategoria}
            onChange={(e) => setFiltroCategoria(e.target.value)}
          >
            <option value="">Tutte le categorie</option>
            {categorie.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          {noteFiltrate.map((n) => (
            <div key={n.id} className="border border-slate-200 rounded-lg bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-slate-900">{n.titolo}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {n.categoria} · priorità {n.priorita}
                  </p>
                </div>
                <select
                  className="border border-slate-300 rounded-md px-2 py-1 text-xs shrink-0"
                  value={n.stato}
                  onChange={(e) => handleCambiaStato(n, e.target.value)}
                >
                  {NOTA_STATI.map((s) => (
                    <option key={s} value={s}>
                      {STATO_LABEL[s] || s}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-sm text-slate-700 mt-2">{n.contenuto}</p>
            </div>
          ))}
          {noteFiltrate.length === 0 && <p className="text-sm text-slate-500">Nessuna nota per questa categoria.</p>}
        </div>
      </section>
    </div>
  )
}
