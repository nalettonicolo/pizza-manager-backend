import { useCallback, useEffect, useState } from "react"
import Loader from "@/components/feedback/Loader"
import ErrorState from "@/components/feedback/ErrorState"
import {
  listCampagneRiepilogo,
  listLandingPageOptions,
  upsertCampagna,
  registraMetricaGiornaliera,
  buildUrlTrackciato,
  pubblicaCampagna,
  PIATTAFORME,
  STATI_CAMPAGNA,
} from "@/features/superadmin/services/adsService"

const CAMPAGNA_VUOTA = {
  nome: "",
  piattaforma: "google_ads",
  landing_page_id: "",
  stato: "bozza",
  budget_giornaliero: "",
  utm_source: "",
  utm_medium: "cpc",
  utm_campaign: "",
  utm_content: "",
  titolo_annuncio: "",
  testo_annuncio: "",
}

export default function AdsPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [campagne, setCampagne] = useState([])
  const [landingOptions, setLandingOptions] = useState([])
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [metricaForm, setMetricaForm] = useState({ data: "", impressioni: "", click: "", conversioni: "", spesa: "" })
  const [publishingId, setPublishingId] = useState(null)

  const ricarica = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [c, l] = await Promise.all([listCampagneRiepilogo(), listLandingPageOptions()])
      setCampagne(c)
      setLandingOptions(l)
    } catch (e) {
      setError(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    ricarica()
  }, [ricarica])

  async function handleSalva() {
    setSaving(true)
    setError(null)
    try {
      const payload = { ...editing }
      if (payload.budget_giornaliero === "") delete payload.budget_giornaliero
      if (!payload.landing_page_id) payload.landing_page_id = null
      await upsertCampagna(payload)
      setEditing(null)
      await ricarica()
    } catch (e) {
      setError(e)
    } finally {
      setSaving(false)
    }
  }

  async function handleRegistraMetrica(campagnaId) {
    if (!metricaForm.data) return
    setError(null)
    try {
      await registraMetricaGiornaliera({
        campagna_id: campagnaId,
        data: metricaForm.data,
        impressioni: Number(metricaForm.impressioni) || 0,
        click: Number(metricaForm.click) || 0,
        conversioni: Number(metricaForm.conversioni) || 0,
        spesa: Number(metricaForm.spesa) || 0,
      })
      setMetricaForm({ data: "", impressioni: "", click: "", conversioni: "", spesa: "" })
      await ricarica()
    } catch (e) {
      setError(e)
    }
  }

  async function handlePubblica(campagnaId) {
    setPublishingId(campagnaId)
    setError(null)
    try {
      await pubblicaCampagna(campagnaId)
      await ricarica()
    } catch (e) {
      setError(e)
    } finally {
      setPublishingId(null)
    }
  }

  if (loading) return <Loader message="Caricamento campagne…" />
  if (error && !editing) return <ErrorState message={error?.message || "Errore di caricamento."} />

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Marketing — Ads</h1>
          <p className="text-sm text-slate-500 mt-1">
            Campagne pubblicitarie collegate alle landing page interne. Metriche inserite manualmente finché non
            c'è un'integrazione diretta con le API delle piattaforme.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditing({ ...CAMPAGNA_VUOTA })}
          className="px-3 py-2 text-sm font-medium rounded-md bg-slate-900 text-white hover:bg-slate-800 shrink-0"
        >
          + Nuova campagna
        </button>
      </header>

      {editing && (
        <section className="border border-slate-200 rounded-lg bg-white p-4 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Nome</label>
              <input
                type="text"
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                value={editing.nome}
                onChange={(e) => setEditing({ ...editing, nome: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Piattaforma</label>
              <select
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                value={editing.piattaforma}
                onChange={(e) => setEditing({ ...editing, piattaforma: e.target.value })}
              >
                {PIATTAFORME.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Landing page</label>
              <select
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                value={editing.landing_page_id || ""}
                onChange={(e) => setEditing({ ...editing, landing_page_id: e.target.value })}
              >
                <option value="">—</option>
                {landingOptions.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.titolo} (/{l.slug})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Stato</label>
              <select
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                value={editing.stato}
                onChange={(e) => setEditing({ ...editing, stato: e.target.value })}
              >
                {STATI_CAMPAGNA.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Budget giornaliero (€)</label>
              <input
                type="number"
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                value={editing.budget_giornaliero}
                onChange={(e) => setEditing({ ...editing, budget_giornaliero: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">utm_campaign</label>
              <input
                type="text"
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                value={editing.utm_campaign}
                onChange={(e) => setEditing({ ...editing, utm_campaign: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">utm_source</label>
              <input
                type="text"
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                value={editing.utm_source}
                onChange={(e) => setEditing({ ...editing, utm_source: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">utm_content</label>
              <input
                type="text"
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                value={editing.utm_content}
                onChange={(e) => setEditing({ ...editing, utm_content: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Titolo annuncio</label>
            <input
              type="text"
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
              value={editing.titolo_annuncio}
              onChange={(e) => setEditing({ ...editing, titolo_annuncio: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Testo annuncio</label>
            <textarea
              rows={3}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
              value={editing.testo_annuncio}
              onChange={(e) => setEditing({ ...editing, testo_annuncio: e.target.value })}
            />
          </div>

          {editing.landing_page_id && (
            <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-md px-3 py-2 break-all">
              URL tracciato:{" "}
              {buildUrlTrackciato({
                slugLanding: landingOptions.find((l) => l.id === editing.landing_page_id)?.slug,
                campagna: editing,
              })}
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error.message}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSalva}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {saving ? "Salvataggio…" : "Salva campagna"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="px-4 py-2 text-sm font-medium rounded-md border border-slate-300 text-slate-700"
            >
              Annulla
            </button>
          </div>
        </section>
      )}

      <section className="space-y-3">
        {campagne.map((c) => (
          <div key={c.id} className="border border-slate-200 rounded-lg bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-900">{c.nome}</p>
                <p className="text-xs text-slate-400">
                  {c.piattaforma} · {c.stato}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handlePubblica(c.id)}
                disabled={publishingId === c.id}
                className="text-xs font-medium rounded-md border border-slate-300 px-3 py-1.5 shrink-0 disabled:opacity-60"
              >
                {publishingId === c.id ? "Pubblicazione…" : "Pubblica / aggiorna stato"}
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-3 text-xs text-slate-600">
              <div>Impr. <strong className="block text-slate-900">{c.impressioni_totali}</strong></div>
              <div>Click <strong className="block text-slate-900">{c.click_totali}</strong></div>
              <div>Conv. <strong className="block text-slate-900">{c.conversioni_totali}</strong></div>
              <div>Spesa <strong className="block text-slate-900">{c.spesa_totale}€</strong></div>
              <div>CTR <strong className="block text-slate-900">{c.ctr_percentuale ?? "—"}%</strong></div>
            </div>
            <details className="mt-3">
              <summary className="text-xs text-blue-700 cursor-pointer">Registra metrica giornaliera</summary>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-2">
                <input
                  type="date"
                  className="border border-slate-300 rounded-md px-2 py-1 text-xs"
                  value={metricaForm.data}
                  onChange={(e) => setMetricaForm({ ...metricaForm, data: e.target.value })}
                />
                <input
                  type="number"
                  placeholder="Impressioni"
                  className="border border-slate-300 rounded-md px-2 py-1 text-xs"
                  value={metricaForm.impressioni}
                  onChange={(e) => setMetricaForm({ ...metricaForm, impressioni: e.target.value })}
                />
                <input
                  type="number"
                  placeholder="Click"
                  className="border border-slate-300 rounded-md px-2 py-1 text-xs"
                  value={metricaForm.click}
                  onChange={(e) => setMetricaForm({ ...metricaForm, click: e.target.value })}
                />
                <input
                  type="number"
                  placeholder="Conversioni"
                  className="border border-slate-300 rounded-md px-2 py-1 text-xs"
                  value={metricaForm.conversioni}
                  onChange={(e) => setMetricaForm({ ...metricaForm, conversioni: e.target.value })}
                />
                <input
                  type="number"
                  placeholder="Spesa €"
                  className="border border-slate-300 rounded-md px-2 py-1 text-xs"
                  value={metricaForm.spesa}
                  onChange={(e) => setMetricaForm({ ...metricaForm, spesa: e.target.value })}
                />
              </div>
              <button
                type="button"
                onClick={() => handleRegistraMetrica(c.id)}
                className="mt-2 text-xs font-medium rounded-md bg-slate-900 text-white px-3 py-1.5"
              >
                Salva metrica
              </button>
            </details>
          </div>
        ))}
        {campagne.length === 0 && <p className="text-sm text-slate-500">Nessuna campagna.</p>}
      </section>
    </div>
  )
}
