import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Link } from "react-router-dom"
import SignatureCanvas from "react-signature-canvas"
import Loader from "@/components/feedback/Loader"
import { getTenants } from "@/features/superadmin/services/superadminService"
import { generaPdfBlob } from "@/utils/contrattoPdfBuilder"
import {
  TIPI_DOCUMENTO,
  getFornitoreConfig,
  getTenantDatiFiscali,
  listTenantDocumenti,
  creaBozzaDocumento,
  firmaEDepositaDocumento,
  salvaPdfPreventivo,
  enqueueDocumentoEmail,
  getDocumentoSignedUrl,
} from "@/features/admin/services/tenantDocumentiService"

const boxStyle = {
  padding: 18,
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  marginBottom: 20,
}
const inputStyle = {
  width: "100%",
  padding: "8px 10px",
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  boxSizing: "border-box",
  fontSize: 14,
}
const labelStyle = { display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4, color: "#475569" }

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

function formatEmailMeta(doc) {
  if (!doc?.inviato_email_at) return ""
  const when = new Date(doc.inviato_email_at).toLocaleString("it-IT")
  const dest = doc.inviato_email_a ? ` a ${doc.inviato_email_a}` : ""
  return ` · inviato ${when}${dest}`
}

export default function SuperadminDocumentiLegaliPage() {
  const [tenants, setTenants] = useState([])
  const [tenantId, setTenantId] = useState("")
  const [loadingTenants, setLoadingTenants] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [fornitore, setFornitore] = useState(null)
  const [tenant, setTenant] = useState(null)
  const [documenti, setDocumenti] = useState([])
  const [tipoSelezionato, setTipoSelezionato] = useState(TIPI_DOCUMENTO[0].value)
  const [bozzaCorrente, setBozzaCorrente] = useState(null)
  const [firmatoDa, setFirmatoDa] = useState("")
  const [emailDest, setEmailDest] = useState("")
  const [saving, setSaving] = useState(false)
  const [sendingEmailId, setSendingEmailId] = useState(null)
  const [saveError, setSaveError] = useState(null)
  const [emailInfo, setEmailInfo] = useState(null)
  const sigRef = useRef(null)

  useEffect(() => {
    ;(async () => {
      try {
        const [list, forn] = await Promise.all([getTenants(), getFornitoreConfig()])
        setTenants(list || [])
        setFornitore(forn)
      } catch (err) {
        setError(err?.message || "Impossibile caricare i clienti.")
      } finally {
        setLoadingTenants(false)
      }
    })()
  }, [])

  const ricarica = useCallback(async (id) => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const [t, docs] = await Promise.all([getTenantDatiFiscali(id), listTenantDocumenti(id)])
      setTenant(t)
      setDocumenti((docs || []).filter((d) => TIPI_DOCUMENTO.some((x) => x.value === d.tipo_documento)))
      setEmailDest((prev) => prev || t?.email_fatturazione || t?.pec || "")
    } catch (e) {
      setError(e?.message || "Errore di caricamento documenti.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setBozzaCorrente(null)
    setEmailInfo(null)
    setEmailDest("")
    if (tenantId) void ricarica(tenantId)
  }, [tenantId, ricarica])

  const paragrafi = useMemo(
    () => buildParagrafiDocumento(tipoSelezionato, fornitore, tenant),
    [tipoSelezionato, fornitore, tenant],
  )
  const titoloDocumento = TIPI_DOCUMENTO.find((d) => d.value === tipoSelezionato)?.label || ""

  async function handleNuovaBozza() {
    if (!tenantId) return
    setSaveError(null)
    setEmailInfo(null)
    try {
      const bozza = await creaBozzaDocumento({ tenantId, tipoDocumento: tipoSelezionato, fornitore, tenant })
      setBozzaCorrente(bozza)
      sigRef.current?.clear()
    } catch (e) {
      setSaveError(e)
    }
  }

  async function inviaEmail(documentoId, variante) {
    const res = await enqueueDocumentoEmail({
      documentoId,
      variante,
      destinatario: emailDest,
    })
    const dest = res?.destinatario || emailDest
    setEmailInfo(`Email accodata per ${dest}. L’invio parte dalla coda notifiche (SMTP di piattaforma).`)
    return dest
  }

  async function handleInviaDaFirmare() {
    if (!tenantId) return
    setSaving(true)
    setSaveError(null)
    setEmailInfo(null)
    try {
      const bozza = await creaBozzaDocumento({ tenantId, tipoDocumento: tipoSelezionato, fornitore, tenant })
      const pdfBlob = await generaPdfBlob({ titolo: titoloDocumento, paragrafi })
      await salvaPdfPreventivo({ documentoId: bozza.id, tenantId, pdfBlob })
      await inviaEmail(bozza.id, "contratto_da_firmare")
      setBozzaCorrente(null)
      await ricarica(tenantId)
    } catch (e) {
      setSaveError(e)
    } finally {
      setSaving(false)
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
    setEmailInfo(null)
    try {
      const firmaDataUrl = sigRef.current.toDataURL("image/png")
      const pdfBlob = await generaPdfBlob({ titolo: titoloDocumento, paragrafi, firmaDataUrl, firmatoDa })
      const firmato = await firmaEDepositaDocumento({
        documentoId: bozzaCorrente.id,
        tenantId,
        pdfBlob,
        firmaDataUrl,
        firmatoDa,
      })
      await inviaEmail(firmato.id, "contratto_firmato")
      setBozzaCorrente(null)
      setFirmatoDa("")
      sigRef.current?.clear()
      await ricarica(tenantId)
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

  async function handleReinvia(doc) {
    setSendingEmailId(doc.id)
    setSaveError(null)
    setEmailInfo(null)
    try {
      const variante = doc.stato === "firmato" ? "contratto_firmato" : "contratto_da_firmare"
      await inviaEmail(doc.id, variante)
      await ricarica(tenantId)
    } catch (e) {
      setSaveError(e)
    } finally {
      setSendingEmailId(null)
    }
  }

  return (
    <div className="dashboard-settings-page">
      <header className="sa-page-header" style={{ marginBottom: 20 }}>
        <p className="sa-page-kicker">Super Admin · commerciale</p>
        <h1 className="dashboard-page-title sa-page-title">ToS, Privacy e DPA</h1>
        <p className="sa-page-lede" style={{ maxWidth: 820 }}>
          Genera i documenti legali di piattaforma, fai firmare su tablet o inviali via email al cliente
          (da firmare e rinviare, oppure copia già firmata). Il cliente li ritrova in{" "}
          <strong>Documenti</strong> nella console del locale. Preventivi e contratto commerciale stanno in{" "}
          <Link to="/superadmin/preventivi-contratti">Preventivi e contratti</Link>.
        </p>
        <p style={{ fontSize: 12.5, color: "#b91c1c", marginTop: 8 }}>
          Il testo è ancora un placeholder in attesa di revisione legale: non usarlo come contratto vincolante
          finché non viene sostituito con il testo definitivo.
        </p>
      </header>

      {error ? <div className="dashboard-error" style={{ marginBottom: 16 }}>{error}</div> : null}

      <div style={boxStyle}>
        <label style={labelStyle}>Cliente (locale)</label>
        {loadingTenants ? (
          <p style={{ fontSize: 13, color: "#64748b" }}>Caricamento…</p>
        ) : (
          <select value={tenantId} onChange={(e) => setTenantId(e.target.value)} style={{ ...inputStyle, maxWidth: 420 }}>
            <option value="">— Seleziona un cliente —</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome} {t.slug ? `(${t.slug})` : ""}
              </option>
            ))}
          </select>
        )}
        {!fornitore ? (
          <p style={{ fontSize: 13, color: "#b45309", margin: "12px 0 0" }}>
            Dati Fornitore non ancora configurati: completali in{" "}
            <Link to="/superadmin/settings">Sistema</Link>.
          </p>
        ) : null}
      </div>

      {tenantId && loading ? <Loader message="Caricamento documenti…" /> : null}

      {tenantId && !loading ? (
        <>
          <div style={boxStyle}>
            <label style={labelStyle}>Email del cliente (per l’invio)</label>
            <input
              type="email"
              value={emailDest}
              onChange={(e) => setEmailDest(e.target.value)}
              placeholder="email@cliente.it"
              style={{ ...inputStyle, maxWidth: 420 }}
            />
            <p style={{ fontSize: 12.5, color: "#64748b", margin: "8px 0 0" }}>
              Precompilata dall’email di fatturazione. Per un cliente a distanza usa «Invia da firmare via email»;
              dopo la firma su tablet parte automaticamente la copia firmata.
            </p>
          </div>

          <section style={boxStyle}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
              <div style={{ flex: "1 1 220px" }}>
                <label style={labelStyle} htmlFor="tipo-documento">
                  Tipo documento
                </label>
                <select
                  id="tipo-documento"
                  value={tipoSelezionato}
                  onChange={(e) => {
                    setTipoSelezionato(e.target.value)
                    setBozzaCorrente(null)
                  }}
                  style={inputStyle}
                >
                  {TIPI_DOCUMENTO.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>
              <button type="button" className="sa-btn-outline" onClick={handleNuovaBozza} disabled={saving}>
                Prepara firma su tablet
              </button>
              <button type="button" className="btn-primary-dashboard" onClick={handleInviaDaFirmare} disabled={saving}>
                {saving ? "Invio…" : "Invia da firmare via email"}
              </button>
            </div>

            <div style={{ marginTop: 16, border: "1px solid #e2e8f0", borderRadius: 8, padding: 14, background: "#f8fafc", fontSize: 14, color: "#334155" }}>
              <p style={{ fontWeight: 700, margin: "0 0 8px", color: "#0f172a" }}>{titoloDocumento}</p>
              {paragrafi.map((p, i) => (
                <p key={i} style={{ margin: "0 0 8px" }}>{p}</p>
              ))}
            </div>

            {bozzaCorrente ? (
              <div style={{ marginTop: 16, borderTop: "1px solid #e2e8f0", paddingTop: 14 }}>
                <label style={labelStyle} htmlFor="firmato-da">
                  Nome di chi firma
                </label>
                <input
                  id="firmato-da"
                  type="text"
                  value={firmatoDa}
                  onChange={(e) => setFirmatoDa(e.target.value)}
                  placeholder="Nome e cognome"
                  style={{ ...inputStyle, maxWidth: 320, marginBottom: 12 }}
                />
                <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 6px" }}>Firma (disegna con dito o mouse)</p>
                <div style={{ border: "1px solid #cbd5e1", borderRadius: 8, background: "#fff", touchAction: "none" }}>
                  <SignatureCanvas
                    ref={sigRef}
                    penColor="#0f172a"
                    canvasProps={{ width: 500, height: 160, style: { width: "100%", height: 160 } }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => sigRef.current?.clear()}
                  style={{ marginTop: 6, fontSize: 12, color: "#64748b", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
                >
                  Cancella firma
                </button>
                <div style={{ marginTop: 10 }}>
                  <button type="button" className="btn-primary-dashboard" disabled={saving} onClick={handleFirma}>
                    {saving ? "Salvataggio…" : "Firma su tablet e invia copia al cliente"}
                  </button>
                </div>
              </div>
            ) : null}

            {saveError ? (
              <p style={{ color: "#b91c1c", fontSize: 13, margin: "12px 0 0" }}>
                {saveError.message || "Operazione non riuscita."}
              </p>
            ) : null}
            {emailInfo ? <p style={{ color: "#166534", fontSize: 13, margin: "12px 0 0" }}>{emailInfo}</p> : null}
          </section>

          <section style={boxStyle}>
            <h2 style={{ margin: "0 0 10px", fontSize: 16 }}>Documenti di questo cliente</h2>
            {documenti.length === 0 ? (
              <p style={{ fontSize: 13, color: "#64748b" }}>Nessun documento generato finora.</p>
            ) : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {documenti.map((doc) => (
                  <li key={doc.id} style={{ padding: "10px 0", borderBottom: "1px solid #e2e8f0", fontSize: 13.5 }}>
                    <strong>
                      {TIPI_DOCUMENTO.find((d) => d.value === doc.tipo_documento)?.label || doc.tipo_documento}
                    </strong>{" "}
                    · {doc.stato}
                    {" · "}
                    {new Date(doc.created_at).toLocaleString("it-IT")}
                    {doc.firmato_da ? ` · firmato da ${doc.firmato_da}` : ""}
                    {formatEmailMeta(doc)}
                    {doc.pdf_url ? (
                      <button
                        type="button"
                        onClick={() => handleScarica(doc)}
                        style={{ marginLeft: 10, background: "none", border: "none", color: "#962d22", cursor: "pointer", textDecoration: "underline", fontSize: 13 }}
                      >
                        Apri PDF
                      </button>
                    ) : null}
                    {doc.pdf_url && doc.stato !== "annullato" ? (
                      <button
                        type="button"
                        onClick={() => handleReinvia(doc)}
                        disabled={sendingEmailId === doc.id}
                        style={{ marginLeft: 10, background: "none", border: "none", color: "#0f172a", cursor: "pointer", textDecoration: "underline", fontSize: 13 }}
                      >
                        {sendingEmailId === doc.id ? "Invio…" : "Reinvia email"}
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </div>
  )
}
