import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import SignatureCanvas from "react-signature-canvas"
import { useTenant } from "@/app/contexts/TenantContext"
import Loader from "@/components/feedback/Loader"
import ErrorState from "@/components/feedback/ErrorState"
import { generaPdfBlob } from "@/utils/contrattoPdfBuilder"
import {
  TIPI_DOCUMENTO,
  getFornitoreConfig,
  getTenantDatiFiscali,
  listTenantDocumenti,
  creaBozzaDocumento,
  firmaEDepositaDocumento,
  getDocumentoSignedUrl,
} from "@/features/admin/services/tenantDocumentiService"

/**
 * Pagina "Documenti" (area admin tenant): genera Termini di Servizio, Privacy Policy,
 * Contratto di Abbonamento e DPA precompilati con i dati del Fornitore (PizzaManager) e
 * del Cliente (tenant corrente), con firma su tablet e salvataggio del PDF firmato.
 *
 * ATTENZIONE — i paragrafi in buildParagrafiDocumento sono PLACEHOLDER, non testo legale
 * validato. Vanno sostituiti con il testo reale (revisionato da un legale) prima di usare
 * questa pagina per firme vincolanti — vedi INDICE_HANDOFF.md §5 e mod 62 in
 * sql/modules/ (promemoria linee guida). Il meccanismo (merge dati, firma, PDF, storage)
 * è invece già completo e funzionante.
 */

function buildParagrafiDocumento(tipoDocumento, fornitore, tenant) {
  const f = fornitore || {}
  const t = tenant || {}
  const intestazione = [
    `Tra ${f.ragione_sociale || "[Ragione sociale Fornitore]"}, con sede in ${f.indirizzo || "[Indirizzo Fornitore]"}, P.IVA ${f.piva || "[P.IVA Fornitore]"}, in persona del legale rappresentante ${f.legale_rappresentante || "[Legale rappresentante]"} ("Fornitore"),`,
    `e ${t.nome || "[Ragione sociale Cliente]"}${t.partita_iva ? `, P.IVA ${t.partita_iva}` : ""} ("Cliente"),`,
  ]
  const corpo = {
    termini_servizio: [
      "[PLACEHOLDER — Termini di Servizio] Oggetto: utilizzo della piattaforma gestionale PizzaManager da parte del Cliente secondo il piano sottoscritto.",
      "[PLACEHOLDER] Durata, rinnovo e recesso: da definire secondo le condizioni commerciali in vigore al momento della sottoscrizione.",
      "[PLACEHOLDER] Livelli di servizio, responsabilità e limitazioni: da completare con testo legale validato prima dell'uso vincolante.",
    ],
    privacy_policy: [
      "[PLACEHOLDER — Privacy Policy] Titolare del trattamento, finalità e basi giuridiche del trattamento dei dati raccolti tramite la piattaforma.",
      `[PLACEHOLDER] Per esercitare i diritti previsti dal Regolamento (UE) 2016/679 contattare ${f.email_privacy || "[email privacy Fornitore]"}.`,
      "[PLACEHOLDER] Conservazione, sicurezza e trasferimento dei dati: da completare con testo legale validato.",
    ],
    contratto_abbonamento: [
      "[PLACEHOLDER — Contratto di Abbonamento] Piano sottoscritto, canone e modalità di fatturazione: da compilare con i dati commerciali reali.",
      "[PLACEHOLDER] Modalità di pagamento, ritardi e sospensione del servizio.",
      `[PLACEHOLDER] Foro competente: ${f.foro_competente || "[Foro competente Fornitore]"}.`,
    ],
    dpa: [
      "[PLACEHOLDER — Data Processing Agreement] Il Fornitore agisce come responsabile del trattamento per conto del Cliente (titolare) ai sensi dell'art. 28 GDPR.",
      "[PLACEHOLDER] Istruzioni documentate, misure di sicurezza, sub-responsabili e assistenza per data breach: da completare con testo legale validato.",
      "[PLACEHOLDER] Cancellazione o restituzione dei dati al termine del contratto.",
    ],
  }
  return [...intestazione, ...(corpo[tipoDocumento] || [])]
}

export default function TenantDocumentiPage() {
  const { tenantId } = useTenant()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [fornitore, setFornitore] = useState(null)
  const [tenant, setTenant] = useState(null)
  const [documenti, setDocumenti] = useState([])
  const [tipoSelezionato, setTipoSelezionato] = useState(TIPI_DOCUMENTO[0].value)
  const [bozzaCorrente, setBozzaCorrente] = useState(null)
  const [firmatoDa, setFirmatoDa] = useState("")
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const sigRef = useRef(null)

  const ricarica = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    setError(null)
    try {
      const [f, t, docs] = await Promise.all([
        getFornitoreConfig(),
        getTenantDatiFiscali(tenantId),
        listTenantDocumenti(tenantId),
      ])
      setFornitore(f)
      setTenant(t)
      setDocumenti(docs)
    } catch (e) {
      setError(e)
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => {
    ricarica()
  }, [ricarica])

  const paragrafi = useMemo(
    () => buildParagrafiDocumento(tipoSelezionato, fornitore, tenant),
    [tipoSelezionato, fornitore, tenant],
  )

  const titoloDocumento = TIPI_DOCUMENTO.find((d) => d.value === tipoSelezionato)?.label || ""

  async function handleNuovaBozza() {
    setSaveError(null)
    try {
      const bozza = await creaBozzaDocumento({ tenantId, tipoDocumento: tipoSelezionato, fornitore, tenant })
      setBozzaCorrente(bozza)
      sigRef.current?.clear()
    } catch (e) {
      setSaveError(e)
    }
  }

  async function handleFirma() {
    if (!bozzaCorrente) return
    if (!sigRef.current || sigRef.current.isEmpty()) {
      setSaveError(new Error("Disegna la firma prima di confermare."))
      return
    }
    setSaving(true)
    setSaveError(null)
    try {
      const firmaDataUrl = sigRef.current.toDataURL("image/png")
      const pdfBlob = await generaPdfBlob({ titolo: titoloDocumento, paragrafi, firmaDataUrl, firmatoDa })
      await firmaEDepositaDocumento({
        documentoId: bozzaCorrente.id,
        tenantId,
        pdfBlob,
        firmaDataUrl,
        firmatoDa,
      })
      setBozzaCorrente(null)
      setFirmatoDa("")
      sigRef.current?.clear()
      await ricarica()
    } catch (e) {
      setSaveError(e)
    } finally {
      setSaving(false)
    }
  }

  async function handleScarica(doc) {
    try {
      const url = await getDocumentoSignedUrl(doc.pdf_url)
      if (url) window.open(url, "_blank", "noopener,noreferrer")
    } catch (e) {
      setSaveError(e)
    }
  }

  if (loading) return <Loader message="Caricamento documenti…" />
  if (error) return <ErrorState message={error?.message || "Errore di caricamento documenti."} />

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-slate-900">Documenti</h1>
        <p className="text-sm text-slate-500 mt-1">
          Genera e firma Termini di Servizio, Privacy Policy, Contratto di Abbonamento e DPA precompilati con i
          dati della tua attività.
        </p>
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mt-3">
          Il testo dei documenti è attualmente un placeholder in attesa di revisione legale: non ha valore
          contrattuale finché non viene sostituito con il testo definitivo.
        </p>
      </header>

      {!fornitore && (
        <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          Dati Fornitore non ancora configurati da PizzaManager: i documenti generati avranno campi in bianco.
        </div>
      )}

      <section className="bg-white border border-slate-200 rounded-lg p-4 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-600 mb-1" htmlFor="tipo-documento">
              Tipo documento
            </label>
            <select
              id="tipo-documento"
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
              value={tipoSelezionato}
              onChange={(e) => {
                setTipoSelezionato(e.target.value)
                setBozzaCorrente(null)
              }}
            >
              {TIPI_DOCUMENTO.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={handleNuovaBozza}
            className="px-4 py-2 text-sm font-medium rounded-md bg-slate-900 text-white hover:bg-slate-800"
          >
            Genera bozza
          </button>
        </div>

        <div className="border border-slate-200 rounded-md p-4 bg-slate-50 text-sm text-slate-700 space-y-2 max-h-64 overflow-y-auto">
          <p className="font-semibold text-slate-900">{titoloDocumento}</p>
          {paragrafi.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>

        {bozzaCorrente && (
          <div className="space-y-3 border-t border-slate-200 pt-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1" htmlFor="firmato-da">
                Nome di chi firma
              </label>
              <input
                id="firmato-da"
                type="text"
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                value={firmatoDa}
                onChange={(e) => setFirmatoDa(e.target.value)}
                placeholder="Nome e cognome"
              />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-600 mb-1">Firma (disegna con dito o mouse)</p>
              <div className="border border-slate-300 rounded-md bg-white touch-none">
                <SignatureCanvas
                  ref={sigRef}
                  penColor="#0f172a"
                  canvasProps={{ width: 500, height: 160, className: "w-full h-40" }}
                />
              </div>
              <button
                type="button"
                onClick={() => sigRef.current?.clear()}
                className="mt-1 text-xs text-slate-500 underline"
              >
                Cancella firma
              </button>
            </div>
            {saveError && <p className="text-sm text-red-600">{saveError.message || "Errore durante il salvataggio."}</p>}
            <button
              type="button"
              onClick={handleFirma}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {saving ? "Salvataggio…" : "Firma e salva PDF"}
            </button>
          </div>
        )}
      </section>

      <section className="bg-white border border-slate-200 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-slate-900 mb-3">Documenti generati</h2>
        {documenti.length === 0 ? (
          <p className="text-sm text-slate-500">Nessun documento generato finora.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {documenti.map((doc) => (
              <li key={doc.id} className="py-2 flex items-center justify-between gap-3 text-sm">
                <div>
                  <span className="font-medium text-slate-800">
                    {TIPI_DOCUMENTO.find((d) => d.value === doc.tipo_documento)?.label || doc.tipo_documento}
                  </span>{" "}
                  <span
                    className={
                      doc.stato === "firmato"
                        ? "text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full text-xs"
                        : "text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full text-xs"
                    }
                  >
                    {doc.stato}
                  </span>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {new Date(doc.created_at).toLocaleString("it-IT")}
                    {doc.firmato_da ? ` · firmato da ${doc.firmato_da}` : ""}
                  </p>
                </div>
                {doc.pdf_url && (
                  <button
                    type="button"
                    onClick={() => handleScarica(doc)}
                    className="text-xs font-medium text-blue-700 underline shrink-0"
                  >
                    Scarica PDF
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
