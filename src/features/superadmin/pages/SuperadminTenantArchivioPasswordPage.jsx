import { useCallback, useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import {
  getRuoliPizzeria,
  listStaffPasswordNotes,
  upsertStaffPasswordNote,
} from "@/features/admin/services/adminService"
import { getTenant } from "@/features/superadmin/services/superadminService"
import { labelFromEmailPrefix } from "@/utils/emailDisplayLabel"

function nomeInSedeOEmail(r) {
  const nv =
    r.nome_visualizzato != null && String(r.nome_visualizzato).trim() !== "" ? String(r.nome_visualizzato).trim() : ""
  if (nv) return nv
  return labelFromEmailPrefix(r.email) || r.email || "—"
}

const inputStyle = {
  width: "100%",
  padding: "8px 12px",
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  boxSizing: "border-box",
  fontSize: 14,
  background: "#fff",
}

const labelStyle = { display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6, color: "#475569" }

/**
 * Pagina dedicata: note archivio password per ogni account staff del tenant (stessi dati di Admin → Ruoli e della sezione in Modifica cliente).
 * Non sono le password Supabase Auth: solo promemoria per il titolare / operazioni.
 */
export default function SuperadminTenantArchivioPasswordPage() {
  const { tenantId } = useParams()
  const navigate = useNavigate()
  const [tenant, setTenant] = useState(null)
  const [loadingTenant, setLoadingTenant] = useState(true)
  const [pageError, setPageError] = useState(null)
  const [archivio, setArchivio] = useState({
    loading: false,
    error: null,
    ruoli: [],
    drafts: {},
    savingUserId: null,
  })

  const loadArchivio = useCallback(async () => {
    if (!tenantId) return
    setArchivio({ loading: true, error: null, ruoli: [], drafts: {}, savingUserId: null })
    try {
      const [ruoli, notes] = await Promise.all([
        getRuoliPizzeria(tenantId),
        listStaffPasswordNotes(tenantId),
      ])
      const byUser = {}
      for (const n of notes || []) {
        byUser[n.user_id] = n.password_nota ?? ""
      }
      const drafts = {}
      for (const r of ruoli || []) {
        drafts[r.user_id] = byUser[r.user_id] ?? ""
      }
      setArchivio({ loading: false, error: null, ruoli: ruoli || [], drafts, savingUserId: null })
    } catch (err) {
      setArchivio({
        loading: false,
        error: err?.message ?? "Impossibile caricare ruoli o note password.",
        ruoli: [],
        drafts: {},
        savingUserId: null,
      })
    }
  }, [tenantId])

  useEffect(() => {
    if (!tenantId) {
      setPageError("Tenant non specificato.")
      setLoadingTenant(false)
      return
    }
    let cancelled = false
    ;(async () => {
      setLoadingTenant(true)
      setPageError(null)
      try {
        const t = await getTenant(tenantId)
        if (!cancelled) setTenant(t)
      } catch (e) {
        if (!cancelled) setPageError(e?.message ?? "Cliente non trovato.")
      } finally {
        if (!cancelled) setLoadingTenant(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [tenantId])

  useEffect(() => {
    if (!tenantId || pageError || loadingTenant) return
    void loadArchivio()
  }, [tenantId, pageError, loadingTenant, loadArchivio])

  const saveNote = async (userId, text) => {
    if (!tenantId || !userId) return
    setArchivio((a) => ({ ...a, savingUserId: userId }))
    try {
      await upsertStaffPasswordNote(tenantId, userId, text)
    } catch (err) {
      setArchivio((a) => ({
        ...a,
        savingUserId: null,
        error: err?.message ?? "Salvataggio non riuscito.",
      }))
      return
    }
    setArchivio((a) => ({ ...a, savingUserId: null }))
  }

  if (loadingTenant) {
    return (
      <div className="dashboard-loading">
        <div className="skeleton" />
        <div className="skeleton-row" />
      </div>
    )
  }

  if (pageError || !tenantId) {
    return (
      <div className="dashboard-content">
        <div className="dashboard-error" style={{ marginBottom: 16 }}>
          {pageError || "Parametro mancante."}
        </div>
        <button type="button" className="sa-table-action" onClick={() => navigate("/superadmin/tenants")}>
          Torna a Clienti
        </button>
      </div>
    )
  }

  return (
    <>
      <header className="sa-page-header">
        <p className="sa-page-kicker">Super Admin · per tenant</p>
        <h1 className="dashboard-page-title sa-page-title">Archivio password staff</h1>
        <p className="sa-page-lede">
          Cliente: <strong>{tenant?.nome ?? tenantId}</strong>
          {tenant?.slug ? (
            <>
              {" "}
              · slug <code style={{ fontSize: 13 }}>{tenant.slug}</code>
            </>
          ) : null}
        </p>
        <p style={{ marginTop: 8, maxWidth: 720, fontSize: 14, color: "#64748b", lineHeight: 1.55 }}>
          Qui registri le <strong>note opzionali</strong> (es. password date al dipendente per accedere all&apos;app). Non
          sono le credenziali tecniche Supabase: il titolare le consulta in <strong>Admin → Ruoli</strong> dopo aver
          sbloccato l&apos;archivio con la propria password.
        </p>
        <div style={{ marginTop: 16 }}>
          <Link to="/superadmin/tenants" className="sa-table-action">
            ← Torna a Clienti (tenant)
          </Link>
          <button type="button" className="sa-table-action" style={{ marginLeft: 12 }} onClick={() => void loadArchivio()}>
            Ricarica elenco
          </button>
        </div>
      </header>

      {archivio.error ? <div className="dashboard-error" style={{ marginBottom: 16 }}>{archivio.error}</div> : null}

      <div className="dashboard-box" style={{ maxWidth: 800, padding: 24 }}>
        {archivio.loading ? (
          <p style={{ color: "#64748b" }}>Caricamento account staff…</p>
        ) : archivio.ruoli.length === 0 ? (
          <p style={{ color: "#64748b" }}>Nessun account staff collegato a questo tenant.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {archivio.ruoli.map((r) => (
              <li
                key={r.user_id}
                style={{
                  padding: "18px 0",
                  borderBottom: "1px solid #e2e8f0",
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 16 }}>{nomeInSedeOEmail(r)}</div>
                <div style={{ fontSize: 13, color: "#64748b", marginBottom: 10 }}>
                  {r.email} · ruolo: <strong>{r.ruolo}</strong>
                </div>
                <label style={labelStyle}>Nota password (archivio titolare)</label>
                <textarea
                  value={archivio.drafts[r.user_id] ?? ""}
                  onChange={(e) =>
                    setArchivio((a) => ({
                      ...a,
                      drafts: { ...a.drafts, [r.user_id]: e.target.value },
                    }))
                  }
                  rows={3}
                  style={{ ...inputStyle, resize: "vertical", minHeight: 72 }}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="Es. password provvisoria consegnata al dipendente, o promemoria interno"
                />
                <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center" }}>
                  <button
                    type="button"
                    className="btn-primary-dashboard"
                    disabled={archivio.savingUserId === r.user_id}
                    onClick={() => saveNote(r.user_id, archivio.drafts[r.user_id] ?? "")}
                  >
                    {archivio.savingUserId === r.user_id ? "Salvataggio…" : "Salva nota"}
                  </button>
                  <span style={{ fontSize: 12, color: "#94a3b8" }}>
                    Lasciare vuoto e salvare rimuove la nota dall&apos;archivio.
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}
