import { useCallback, useEffect, useMemo, useState } from "react"
import { useTenant } from "@/app/contexts/TenantContext"
import Loader from "@/components/feedback/Loader"
import ErrorState from "@/components/feedback/ErrorState"
import StaffDossierModal from "@/features/admin/components/StaffDossierModal"
import {
  getTenantUsers,
  toggleUserActive,
  updateStaffNomeVisualizzato,
  listStaffArchivioDipendenti,
  getRuoliPizzeria,
  updateRuoloPizzeriaPermessi,
  aggiungiRuoloPizzeria,
} from "@/features/admin/services/adminService"
import { labelFromEmailPrefix } from "@/utils/emailDisplayLabel"
import { RUOLO_BASE_OPTIONS, RUOLO_BASE_VALUES } from "@/features/admin/utils/ruoliPizzeriaUi"

export default function UserManager() {
  const { tenantId } = useTenant()

  const [users, setUsers] = useState([])
  const [ruoliRows, setRuoliRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState("")
  const [busyId, setBusyId] = useState(null)
  const [nomeDraft, setNomeDraft] = useState({})
  const [archivioByUserId, setArchivioByUserId] = useState({})

  const [schedaUser, setSchedaUser] = useState(null)

  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRuolo, setInviteRuolo] = useState("cassa")
  const [inviteBusy, setInviteBusy] = useState(false)

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const [data, rr] = await Promise.all([getTenantUsers(tenantId), getRuoliPizzeria(tenantId)])
      setUsers(data)
      setRuoliRows(rr || [])
      setNomeDraft(Object.fromEntries(data.map((u) => [u.id, u.nomeVisualizzato ?? ""])))
      try {
        const rows = await listStaffArchivioDipendenti(tenantId)
        setArchivioByUserId(Object.fromEntries(rows.map((r) => [r.user_id, r])))
      } catch (e) {
        console.warn("Archivio dipendenti non disponibile:", e?.message || e)
        setArchivioByUserId({})
      }
    } catch (err) {
      console.error(err)
      setError(err?.message ? `Errore nel caricamento utenti: ${err.message}` : "Errore nel caricamento utenti.")
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => {
    if (tenantId) {
      void loadUsers()
    } else {
      setLoading(false)
      setUsers([])
      setRuoliRows([])
    }
  }, [tenantId, loadUsers])

  const filteredUsers = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return users
    return users.filter((u) => {
      const email = (u.email || "").toLowerCase()
      const nome = (u.nome || "").toLowerCase()
      const nv = (u.nomeVisualizzato || "").toLowerCase()
      return email.includes(q) || nome.includes(q) || nv.includes(q)
    })
  }, [users, filter])

  const stats = useMemo(() => {
    const total = users.length
    const attivi = users.filter((u) => u.attivo).length
    return { total, attivi }
  }, [users])

  const ruoloRecordFor = useCallback(
    (userId) => ruoliRows.find((r) => r.user_id === userId) || null,
    [ruoliRows],
  )

  async function handleToggle(userId, current) {
    if (!tenantId) return
    setBusyId(userId)
    try {
      await toggleUserActive(tenantId, userId, !current)
      await loadUsers()
    } catch (err) {
      console.error(err)
      alert(err?.message || "Aggiornamento stato non riuscito.")
    } finally {
      setBusyId(null)
    }
  }

  async function handleNomeSedeBlur(userId) {
    if (!tenantId) return
    const draft = (nomeDraft[userId] ?? "").trim()
    const prev = (users.find((u) => u.id === userId)?.nomeVisualizzato ?? "").trim()
    if (draft === prev) return
    setBusyId(userId)
    try {
      await updateStaffNomeVisualizzato(tenantId, userId, draft)
      await loadUsers()
    } catch (err) {
      console.error(err)
      alert(err?.message || "Salvataggio nome in sede non riuscito.")
      setNomeDraft((m) => ({ ...m, [userId]: prev }))
    } finally {
      setBusyId(null)
    }
  }

  async function handleRuoloChange(userId, nuovoRuolo) {
    if (!tenantId) return
    const row = ruoliRows.find((r) => r.user_id === userId)
    if (!row || row.ruolo === nuovoRuolo) return
    setBusyId(userId)
    try {
      await updateRuoloPizzeriaPermessi(tenantId, userId, { ruolo: nuovoRuolo })
      await loadUsers()
    } catch (err) {
      console.error(err)
      alert(err?.message || "Aggiornamento ruolo non riuscito.")
    } finally {
      setBusyId(null)
    }
  }

  async function handleInviteStaff(e) {
    e.preventDefault()
    if (!tenantId) return
    const email = inviteEmail.trim().toLowerCase()
    if (!email || !email.includes("@")) {
      alert("Inserisci un’email valida.")
      return
    }
    setInviteBusy(true)
    try {
      await aggiungiRuoloPizzeria(tenantId, email, inviteRuolo)
      setInviteEmail("")
      await loadUsers()
      alert("Richiesta inviata. Se l’utente esiste in Auth, risulta collegato al locale.")
    } catch (err) {
      console.error(err)
      alert(err?.message || "Collegamento non riuscito. Verifica che l’utente esista in Supabase Auth o la RPC del progetto.")
    } finally {
      setInviteBusy(false)
    }
  }

  const schedaRuolo = schedaUser ? ruoloRecordFor(schedaUser.id) : null
  const schedaArchivio = schedaUser ? archivioByUserId[schedaUser.id] : null

  if (loading) return <Loader />
  if (error) return <ErrorState message={error} />

  return (
    <div className="dashboard-settings-page dashboard-dipendenti-page">
      <h1 className="dashboard-page-title">Dipendenti</h1>
      <p className="dashboard-settings-section-desc" style={{ marginBottom: 14 }}>
        Gestione completa del personale: <strong>anagrafica</strong>, <strong>corsi</strong>, <strong>documenti</strong>,{" "}
        <strong>buste paga</strong> e <strong>ruolo operativo</strong> (cassa, cucina, permessi aree). Gli account nascono
        da Supabase Auth; puoi collegarne uno nuovo con il modulo sotto.
      </p>

      <section className="dashboard-box dashboard-settings-section" style={{ marginBottom: 18, padding: "16px 20px" }}>
        <h2 className="dashboard-settings-section-title" style={{ marginTop: 0 }}>
          Collega un account staff
        </h2>
        <p style={{ color: "#64748b", fontSize: 13, marginBottom: 12, lineHeight: 1.5 }}>
          L&apos;email deve corrispondere a un utente già presente in Authentication (o alla procedura RPC del tuo progetto).
        </p>
        <form onSubmit={handleInviteStaff} style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600 }}>Email</span>
            <input
              type="email"
              className="dashboard-search-input"
              style={{ minWidth: 240 }}
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="nome@dominio.it"
              autoComplete="off"
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600 }}>Ruolo iniziale</span>
            <select className="dipendenti-role-select" value={inviteRuolo} onChange={(e) => setInviteRuolo(e.target.value)}>
              {RUOLO_BASE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="btn-primary-dashboard" disabled={inviteBusy}>
            {inviteBusy ? "Invio…" : "Collega"}
          </button>
        </form>
      </section>

      <section className="dashboard-box dashboard-settings-section" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "18px 20px 0" }}>
          <h2 className="dashboard-settings-section-title" style={{ marginBottom: 4 }}>
            Elenco dipendenti
          </h2>
          <p style={{ color: "#64748b", fontSize: 13, margin: "0 0 14px", lineHeight: 1.5 }}>
            Apri la <strong>scheda completa</strong> per dati anagrafici, corsi, allegati e buste paga. Il <strong>ruolo base</strong> è modificabile anche dalla tabella.
          </p>
        </div>

        <div className="dipendenti-toolbar" style={{ padding: "0 20px 16px" }}>
          <label className="dipendenti-search-label" htmlFor="dipendenti-filter">
            Cerca
          </label>
          <input
            id="dipendenti-filter"
            type="search"
            className="dipendenti-search-input"
            placeholder="Nome, nome in sede o email…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            autoComplete="off"
          />
          <div className="dipendenti-stat-pills" aria-live="polite">
            <span className="dipendenti-pill">
              {stats.total} {stats.total === 1 ? "persona" : "persone"}
            </span>
            <span className="dipendenti-pill dipendenti-pill--ok">{stats.attivi} con accesso attivo</span>
            {stats.total > stats.attivi ? (
              <span className="dipendenti-pill dipendenti-pill--muted">{stats.total - stats.attivi} sospese</span>
            ) : null}
          </div>
        </div>

        {users.length === 0 ? (
          <p style={{ padding: "0 20px 24px", color: "#64748b", fontSize: 14, margin: 0 }}>
            Nessun utente collegato a questo locale. Usa il modulo «Collega un account staff» o crea l&apos;utente in Supabase Auth.
          </p>
        ) : filteredUsers.length === 0 ? (
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
                    <th scope="col">Account</th>
                    <th scope="col">Nome in sede</th>
                    <th scope="col">Ruolo</th>
                    <th scope="col">Accesso</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => {
                    const accountLabel = labelFromEmailPrefix(user.email) || user.nome || "—"
                    const rowBusy = busyId === user.id
                    const rr = ruoloRecordFor(user.id)
                    return (
                      <tr key={user.id}>
                        <td>
                          <strong style={{ color: "#0f172a" }}>{accountLabel}</strong>
                          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2, wordBreak: "break-all" }}>{user.email}</div>
                          <button
                            type="button"
                            className="btn-primary-dashboard"
                            style={{ marginTop: 10, fontSize: 12, padding: "8px 12px" }}
                            onClick={() => setSchedaUser(user)}
                          >
                            Scheda dipendente
                          </button>
                        </td>
                        <td>
                          <input
                            type="text"
                            className="dipendenti-nome-sede-input"
                            placeholder="es. Anna"
                            maxLength={120}
                            value={nomeDraft[user.id] ?? ""}
                            disabled={rowBusy}
                            onChange={(e) => setNomeDraft((m) => ({ ...m, [user.id]: e.target.value }))}
                            onBlur={() => void handleNomeSedeBlur(user.id)}
                            aria-label={`Nome in sede per ${user.email}`}
                          />
                          <div className="dipendenti-role-hint">Chi usa questo login in negozio (turni, note).</div>
                        </td>
                        <td>
                          <select
                            className="dipendenti-role-select"
                            value={rr?.ruolo || user.ruolo || "operatore"}
                            disabled={rowBusy || !rr}
                            onChange={(e) => handleRuoloChange(user.id, e.target.value)}
                            aria-label={`Ruolo per ${user.email}`}
                          >
                            {RUOLO_BASE_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                            {rr?.ruolo && !RUOLO_BASE_VALUES.has(rr.ruolo) ? <option value={rr.ruolo}>{rr.ruolo}</option> : null}
                          </select>
                          {!rr ? <div style={{ fontSize: 11, color: "#b45309", marginTop: 4 }}>Ruolo non caricato</div> : null}
                        </td>
                        <td>
                          <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start" }}>
                            <label
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 8,
                                fontSize: 14,
                                color: "#334155",
                                cursor: rowBusy ? "wait" : "pointer",
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={user.attivo}
                                disabled={rowBusy}
                                onChange={() => handleToggle(user.id, user.attivo)}
                                style={{ width: 18, height: 18, cursor: rowBusy ? "wait" : "pointer" }}
                              />
                              Abilitato
                            </label>
                            <span className={user.attivo ? "badge badge-success" : "badge badge-warning"}>
                              {user.attivo ? "Può accedere" : "Accesso sospeso"}
                            </span>
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
        open={!!schedaUser}
        onClose={() => setSchedaUser(null)}
        tenantId={tenantId}
        user={schedaUser}
        ruoloRecord={schedaRuolo}
        archivioRow={schedaArchivio}
        onSaved={loadUsers}
        onRuoliRefresh={loadUsers}
      />
    </div>
  )
}
