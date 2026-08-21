import { useCallback, useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { useTenant } from "@/app/contexts/TenantContext"
import Loader from "@/components/feedback/Loader"
import ErrorState from "@/components/feedback/ErrorState"
import StaffDossierModal from "@/features/admin/components/StaffDossierModal"
import {
  getTenantUsers,
  listStaffArchivioDipendenti,
  insertStaffArchivioPersona,
  deleteStaffArchivioById,
} from "@/features/admin/services/adminService"
import { labelFromEmailPrefix } from "@/utils/emailDisplayLabel"

function formatDataIt(isoDate) {
  if (!isoDate) return ""
  const d = new Date(String(isoDate).slice(0, 10))
  if (Number.isNaN(d.getTime())) return String(isoDate)
  return d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" })
}

function sortArchivioRows(rows) {
  return [...rows].sort((a, b) => {
    const na = (a.nome_completo || "").trim().toLowerCase()
    const nb = (b.nome_completo || "").trim().toLowerCase()
    const aEmpty = !na
    const bEmpty = !nb
    if (aEmpty !== bEmpty) return aEmpty ? 1 : -1
    if (na !== nb) return na.localeCompare(nb, "it")
    const ca = a.created_at || ""
    const cb = b.created_at || ""
    return cb.localeCompare(ca)
  })
}

export default function UserManager() {
  const { tenantId } = useTenant()

  const [archivioRows, setArchivioRows] = useState([])
  const [usersById, setUsersById] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState("")
  const [schedaId, setSchedaId] = useState(null)
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState(null)

  const loadData = useCallback(async () => {
    if (!tenantId) return
    try {
      setLoading(true)
      setError(null)
      const [rows, users] = await Promise.all([
        listStaffArchivioDipendenti(tenantId),
        getTenantUsers(tenantId).catch((e) => {
          console.warn("Elenco account locale non disponibile:", e?.message || e)
          return []
        }),
      ])
      setArchivioRows(sortArchivioRows(rows))
      setUsersById(Object.fromEntries(users.map((u) => [u.id, u])))
    } catch (err) {
      console.error(err)
      setError(err?.message ? `Errore nel caricamento: ${err.message}` : "Errore nel caricamento dell’archivio HR.")
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => {
    if (tenantId) {
      void loadData()
    } else {
      setLoading(false)
      setArchivioRows([])
      setUsersById({})
    }
  }, [tenantId, loadData])

  const schedaRow = useMemo(() => archivioRows.find((r) => r.id === schedaId) || null, [archivioRows, schedaId])

  const linkedUserForScheda = useMemo(() => {
    if (!schedaRow?.user_id) return null
    return usersById[schedaRow.user_id] || null
  }, [schedaRow?.user_id, usersById])

  const filteredRows = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return archivioRows
    return archivioRows.filter((r) => {
      const chunks = [
        r.nome_completo,
        r.email_personale,
        r.telefono_personale,
        r.codice_fiscale,
        r.mansione,
        r.note_hr,
      ]
        .filter(Boolean)
        .map((s) => String(s).toLowerCase())
      const linked = r.user_id ? usersById[r.user_id] : null
      if (linked?.email) chunks.push(String(linked.email).toLowerCase())
      return chunks.some((c) => c.includes(q))
    })
  }, [archivioRows, filter, usersById])

  const stats = useMemo(() => {
    const total = archivioRows.length
    const conAccount = archivioRows.filter((r) => !!r.user_id).length
    return { total, conAccount }
  }, [archivioRows])

  async function handleNuovoDipendente() {
    if (!tenantId || creating) return
    setCreating(true)
    try {
      const row = await insertStaffArchivioPersona(tenantId, {})
      setArchivioRows((prev) => sortArchivioRows([...prev.filter((x) => x.id !== row.id), row]))
      setSchedaId(row.id)
    } catch (err) {
      console.error(err)
      alert(
        err?.message ||
          "Impossibile creare la scheda. Se il database richiede ancora un account per ogni riga HR, esegui in Supabase il blocco 2026-04-19 in sql/sql_upgrade.sql.",
      )
    } finally {
      setCreating(false)
    }
  }

  async function handleEliminaScheda(rowId) {
    if (!tenantId || !rowId || deletingId) return
    if (
      !window.confirm(
        "Eliminare definitivamente questa scheda HR? L’operazione non è annullabile. I file su Storage non vengono rimossi automaticamente.",
      )
    ) {
      return
    }
    setDeletingId(rowId)
    try {
      await deleteStaffArchivioById(tenantId, rowId)
      if (schedaId === rowId) setSchedaId(null)
      await loadData()
    } catch (err) {
      console.error(err)
      alert(
        err?.message ||
          "Eliminazione non riuscita. Se mancano le colonne HR recenti, esegui sql/sql_upgrade.sql in Supabase (blocco 2026-04-20).",
      )
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) return <Loader />
  if (error) return <ErrorState message={error} />

  return (
    <div className="dashboard-settings-page dashboard-dipendenti-page">
      <h1 className="dashboard-page-title">Staff</h1>
      <p className="dashboard-settings-section-desc" style={{ marginBottom: 14 }}>
        <strong>Dipendenti</strong>: anagrafica, corsi, allegati e buste paga. Le schede possono esistere anche senza
        login. Per abilitare accessi e aree di lavoro usa{" "}
        <Link to="/admin/ruoli" style={{ fontWeight: 600, color: "#0f172a", textDecoration: "underline" }}>
          Ruoli
        </Link>
        .
      </p>

      <section className="dashboard-box dashboard-settings-section" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "18px 20px 0" }}>
          <h2 className="dashboard-settings-section-title" style={{ marginBottom: 4 }}>
            Archivio HR
          </h2>
          <p style={{ color: "#64748b", fontSize: 13, margin: "0 0 14px", lineHeight: 1.5 }}>
            Ogni riga è una persona. Apri la scheda per compilare i dati e caricare documenti.
          </p>
        </div>

        <div className="dipendenti-toolbar" style={{ padding: "0 20px 16px", display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
          <div style={{ flex: "1 1 220px", minWidth: 0 }}>
            <label className="dipendenti-search-label" htmlFor="dipendenti-filter">
              Cerca
            </label>
            <input
              id="dipendenti-filter"
              type="search"
              className="dipendenti-search-input"
              placeholder="Nome, email, telefono, mansione…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              autoComplete="off"
            />
          </div>
          <button
            type="button"
            className="btn-primary-dashboard"
            style={{ fontSize: 13, padding: "10px 16px", whiteSpace: "nowrap" }}
            disabled={creating || !tenantId}
            onClick={() => void handleNuovoDipendente()}
          >
            {creating ? "Creazione…" : "Nuovo dipendente HR"}
          </button>
          <div className="dipendenti-stat-pills" aria-live="polite" style={{ flex: "1 1 200px", justifyContent: "flex-end" }}>
            <span className="dipendenti-pill">
              {stats.total} {stats.total === 1 ? "scheda" : "schede"}
            </span>
            <span className="dipendenti-pill dipendenti-pill--ok">{stats.conAccount} con account collegato</span>
            {stats.total > stats.conAccount ? (
              <span className="dipendenti-pill dipendenti-pill--muted">{stats.total - stats.conAccount} senza login</span>
            ) : null}
          </div>
        </div>

        {archivioRows.length === 0 ? (
          <p style={{ padding: "0 20px 24px", color: "#64748b", fontSize: 14, margin: 0 }}>
            Non è ancora presente alcuna scheda HR. Usa «Nuovo dipendente HR» per aprire la prima scheda e salvare
            anagrafica e documentazione.
          </p>
        ) : filteredRows.length === 0 ? (
          <p style={{ padding: "0 20px 24px", color: "#64748b", fontSize: 14, margin: 0 }}>
            Nessun risultato per «{filter.trim()}». Prova un altro testo o svuota la ricerca.
          </p>
        ) : (
          <div
            className="dashboard-table-wrap dipendenti-table-outer"
            style={{ borderRadius: 0, borderLeft: "none", borderRight: "none", borderBottom: "none", boxShadow: "none" }}
          >
            <div style={{ overflowX: "auto" }}>
              <table className="dipendenti-table">
                <thead>
                  <tr>
                    <th scope="col">Dipendente</th>
                    <th scope="col">Mansione</th>
                    <th scope="col">Stato</th>
                    <th scope="col">Account collegato</th>
                    <th scope="col">Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => {
                    const nome = (row.nome_completo || "").trim()
                    const label = nome || "Senza nome (bozza)"
                    const linked = row.user_id ? usersById[row.user_id] : null
                    const accountLine = linked
                      ? labelFromEmailPrefix(linked.email) || linked.email || "—"
                      : null
                    const disabilitata = row.scheda_disabilitata === true
                    const cess = row.data_cessazione
                    const rowBusy = deletingId === row.id
                    return (
                      <tr key={row.id}>
                        <td>
                          <strong style={{ color: "#0f172a" }}>{label}</strong>
                          {row.email_personale ? (
                            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2, wordBreak: "break-all" }}>
                              {row.email_personale}
                            </div>
                          ) : null}
                        </td>
                        <td>
                          <span style={{ fontSize: 14, color: "#334155" }}>{(row.mansione || "").trim() || "—"}</span>
                        </td>
                        <td>
                          <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
                            {disabilitata ? (
                              <span className="badge badge-warning" style={{ alignSelf: "flex-start" }}>
                                Scheda disabilitata
                              </span>
                            ) : (
                              <span style={{ color: "#64748b" }}>Attiva</span>
                            )}
                            {cess ? (
                              <span style={{ color: "#475569" }}>
                                Cessazione: <strong>{formatDataIt(cess)}</strong>
                              </span>
                            ) : (
                              <span style={{ color: "#94a3b8" }}>—</span>
                            )}
                          </div>
                        </td>
                        <td>
                          {linked ? (
                            <>
                              <span style={{ fontSize: 14, color: "#334155" }}>{accountLine}</span>
                              <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2, wordBreak: "break-all" }}>{linked.email}</div>
                            </>
                          ) : (
                            <span style={{ fontSize: 13, color: "#94a3b8" }}>—</span>
                          )}
                          {!linked && row.user_id ? (
                            <div className="dipendenti-role-hint" style={{ marginTop: 6 }}>
                              Account non più in elenco Ruoli (id collegato presente in archivio).
                            </div>
                          ) : null}
                        </td>
                        <td>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                            <button
                              type="button"
                              className="btn-primary-dashboard"
                              style={{ fontSize: 12, padding: "8px 12px" }}
                              disabled={rowBusy}
                              onClick={() => setSchedaId(row.id)}
                            >
                              Apri scheda HR
                            </button>
                            <button
                              type="button"
                              className="dashboard-settings-btn-secondary"
                              style={{ fontSize: 12, padding: "8px 12px", borderColor: "#b91c1c", color: "#b91c1c" }}
                              disabled={rowBusy}
                              onClick={() => void handleEliminaScheda(row.id)}
                            >
                              {rowBusy ? "Eliminazione…" : "Elimina"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <StaffDossierModal
        open={!!schedaId && !!schedaRow}
        onClose={() => setSchedaId(null)}
        tenantId={tenantId}
        user={linkedUserForScheda}
        archivioRow={schedaRow}
        onSaved={loadData}
        onDeleted={async () => {
          setSchedaId(null)
          await loadData()
        }}
      />
    </div>
  )
}
