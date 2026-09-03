import { useCallback, useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { useTenant } from "@/app/contexts/TenantContext"
import Loader from "@/components/feedback/Loader"
import ErrorState from "@/components/feedback/ErrorState"
import {
  SEZIONI_ARCHIVIO_DOCUMENTI,
  labelTipoDocumento,
  labelStatoDocumento,
  listTenantDocumenti,
  getDocumentoSignedUrl,
} from "@/features/admin/services/tenantDocumentiService"

const boxStyle = {
  padding: 18,
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  marginBottom: 20,
}

function groupDocumenti(docs) {
  return SEZIONI_ARCHIVIO_DOCUMENTI.map((sez) => ({
    ...sez,
    items: (docs || []).filter((d) => sez.tipi.includes(d.tipo_documento)),
  }))
}

export default function TenantDocumentiPage() {
  const { tenantId } = useTenant()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [documenti, setDocumenti] = useState([])
  const [openingId, setOpeningId] = useState(null)

  const ricarica = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    setError(null)
    try {
      const docs = await listTenantDocumenti(tenantId)
      setDocumenti(docs || [])
    } catch (e) {
      setError(e)
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => {
    void ricarica()
  }, [ricarica])

  const sezioni = useMemo(() => groupDocumenti(documenti), [documenti])
  const visibili = documenti.filter((d) => d.stato !== "annullato")

  async function apriPdf(doc) {
    if (!doc?.pdf_url) return
    setOpeningId(doc.id)
    setError(null)
    try {
      const url = await getDocumentoSignedUrl(doc.pdf_url)
      if (url) window.open(url, "_blank", "noopener,noreferrer")
    } catch (e) {
      setError(e)
    } finally {
      setOpeningId(null)
    }
  }

  if (loading) return <Loader message="Caricamento documenti…" />
  if (error && documenti.length === 0) {
    return <ErrorState message={error?.message || "Impossibile caricare i documenti."} />
  }

  return (
    <div className="dashboard-settings-page" style={{ maxWidth: 880 }}>
      <header style={{ marginBottom: 20 }}>
        <h1 className="dashboard-page-title">Documenti</h1>
        <p className="guida-utente-lead" style={{ marginTop: 8, maxWidth: 720 }}>
          Contratti, preventivi, pagamenti e comunicazioni tra <strong>PizzaManager</strong> e il tuo locale.
          Puoi aprire e scaricare i PDF. Il manuale operativo è in{" "}
          <Link to="/admin/manuale">Guida</Link>.
        </p>
      </header>

      {error ? (
        <div className="dashboard-error" style={{ marginBottom: 16 }}>
          {error.message || "Operazione non riuscita."}
        </div>
      ) : null}

      {visibili.length === 0 ? (
        <div style={boxStyle}>
          <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>
            Qui compariranno i documenti che PizzaManager deposita per il tuo locale: contratti e preventivi,
            ricevute di pagamento e comunicazioni importanti. Al momento l’archivio è vuoto.
          </p>
        </div>
      ) : (
        sezioni.map((sez) => {
          const items = sez.items.filter((d) => d.stato !== "annullato")
          if (items.length === 0) return null
          return (
            <section key={sez.id} style={boxStyle}>
              <h2 style={{ margin: "0 0 12px", fontSize: 16 }}>{sez.title}</h2>
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {items.map((doc) => (
                  <li
                    key={doc.id}
                    style={{
                      padding: "12px 0",
                      borderBottom: "1px solid #f1f5f9",
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      alignItems: "flex-start",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 650, color: "#0f172a" }}>
                        {labelTipoDocumento(doc.tipo_documento, doc.dati_snapshot)}
                      </div>
                      <p style={{ margin: "4px 0 0", fontSize: 13, color: "#64748b" }}>
                        {labelStatoDocumento(doc)}
                        {" · "}
                        {new Date(doc.created_at).toLocaleString("it-IT")}
                        {doc.firmato_da ? ` · firmato da ${doc.firmato_da}` : ""}
                        {doc.inviato_email_at
                          ? ` · inviato il ${new Date(doc.inviato_email_at).toLocaleString("it-IT")}`
                          : ""}
                      </p>
                    </div>
                    {doc.pdf_url ? (
                      <button
                        type="button"
                        className="sa-btn-outline"
                        disabled={openingId === doc.id}
                        onClick={() => apriPdf(doc)}
                        style={{ flexShrink: 0 }}
                      >
                        {openingId === doc.id ? "Apertura…" : "Apri PDF"}
                      </button>
                    ) : (
                      <span style={{ fontSize: 12, color: "#94a3b8" }}>PDF non disponibile</span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )
        })
      )}
    </div>
  )
}
