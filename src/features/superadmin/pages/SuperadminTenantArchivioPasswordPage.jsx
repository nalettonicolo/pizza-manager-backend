import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import {
  listArchivioPasswordAccounts,
  upsertStaffPasswordNote,
} from "@/features/admin/services/adminService"
import { getTenant, resetAccountPasswordReale } from "@/features/superadmin/services/superadminService"
import { labelFromEmailPrefix } from "@/utils/emailDisplayLabel"
import SaListSearchField from "@/features/superadmin/components/SaListSearchField"
import { normalizeListSearchQuery, rowMatchesListSearch } from "@/utils/listSearchFilter"

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
  const [listQuery, setListQuery] = useState("")
  const [applyingUserId, setApplyingUserId] = useState(null)
  const [applyMsg, setApplyMsg] = useState({})

  const ruoliFiltered = useMemo(() => {
    const q = normalizeListSearchQuery(listQuery)
    if (!q) return archivio.ruoli
    return archivio.ruoli.filter((r) =>
      rowMatchesListSearch(q, [nomeInSedeOEmail(r), r.email, r.ruolo, r.user_id]),
    )
  }, [archivio.ruoli, listQuery])

  const loadArchivio = useCallback(async () => {
    if (!tenantId) return
    setArchivio({ loading: true, error: null, ruoli: [], drafts: {}, savingUserId: null })
    try {
      const { accounts, notesByUser } = await listArchivioPasswordAccounts(tenantId)
      const drafts = {}
      for (const r of accounts || []) {
        drafts[r.user_id] = notesByUser[r.user_id] ?? ""
      }
      setArchivio({ loading: false, error: null, ruoli: accounts || [], drafts, savingUserId: null })
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

  async function applyPasswordReale(userId, password, nome) {
    const testo = String(password || "").trim()
    if (testo.length < 6) {
      setApplyMsg((m) => ({ ...m, [userId]: { ok: false, testo: "Minimo 6 caratteri per applicarla su Supabase." } }))
      return
    }
    const conferma = window.confirm(
      `Sovrascrivere la password reale di ${nome} su Supabase con il testo qui sopra? L'account non potrà più usare la password precedente.`,
    )
    if (!conferma) return
    setApplyingUserId(userId)
    setApplyMsg((m) => ({ ...m, [userId]: null }))
    try {
      await resetAccountPasswordReale({ tenantId, userId, password: testo })
      setApplyMsg((m) => ({ ...m, [userId]: { ok: true, testo: "Password applicata su Supabase." } }))
    } catch (err) {
      setApplyMsg((m) => ({ ...m, [userId]: { ok: false, testo: err?.message || "Applicazione non riuscita." } }))
    } finally {
      setApplyingUserId(null)
    }
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
          Qui registri le <strong>note opzionali</strong> (password date allo staff o al Cliente Test) — il titolare
          le consulta in <strong>Admin → Ruoli</strong> dopo aver sbloccato l&apos;archivio con la propria password.
          Gli account con ruolo <strong>cliente</strong> compaiono se hanno una nota salvata. Il pulsante{" "}
          <strong>🔑 Applica su Supabase</strong> sovrascrive davvero la password dell&apos;account con il testo
          scritto qui sopra — tutto da questa pagina, senza aprire il pannello Supabase a parte. "Salva nota" da solo
          resta invece solo un promemoria, senza toccare Supabase.
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
          <>
            <div style={{ marginBottom: 16 }}>
              <SaListSearchField
                id="sa-archivio-ruoli-search"
                value={listQuery}
                onChange={setListQuery}
                placeholder="Cerca per nome, email o ruolo…"
                resultsCount={ruoliFiltered.length}
                totalCount={archivio.ruoli.length}
              />
            </div>
            {ruoliFiltered.length === 0 ? (
              <p style={{ color: "#64748b" }}>Nessun account corrisponde alla ricerca.</p>
            ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {ruoliFiltered.map((r) => (
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
                  {r.archivio_tipo === "cliente" ? " · area cliente" : ""}
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
                <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="btn-primary-dashboard"
                    disabled={archivio.savingUserId === r.user_id}
                    onClick={() => saveNote(r.user_id, archivio.drafts[r.user_id] ?? "")}
                  >
                    {archivio.savingUserId === r.user_id ? "Salvataggio…" : "Salva nota"}
                  </button>
                  <button
                    type="button"
                    className="sa-table-action"
                    disabled={applyingUserId === r.user_id}
                    onClick={() => applyPasswordReale(r.user_id, archivio.drafts[r.user_id], nomeInSedeOEmail(r))}
                    title="Sovrascrive la password reale dell'account su Supabase con il testo qui sopra"
                  >
                    {applyingUserId === r.user_id ? "Applico…" : "🔑 Applica su Supabase"}
                  </button>
                  <span style={{ fontSize: 12, color: "#94a3b8" }}>
                    Lasciare vuoto e salvare rimuove la nota dall&apos;archivio.
                  </span>
                </div>
                {applyMsg[r.user_id] ? (
                  <p
                    style={{
                      margin: "6px 0 0",
                      fontSize: 12.5,
                      color: applyMsg[r.user_id].ok ? "#166534" : "#b91c1c",
                    }}
                  >
                    {applyMsg[r.user_id].ok ? "✓ " : "✕ "}
                    {applyMsg[r.user_id].testo}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
            )}
          </>
        )}
      </div>
    </>
  )
}
