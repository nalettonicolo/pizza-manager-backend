import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { useTenant } from "@/app/contexts/TenantContext"
import Loader from "@/components/feedback/Loader"
import ErrorState from "@/components/feedback/ErrorState"
import {
  getTenantUsers,
  updateUserRole,
  toggleUserActive,
} from "@/features/admin/services/adminService"
import { labelFromEmailPrefix } from "@/utils/emailDisplayLabel"

const RUOLO_OPTIONS = [
  { value: "admin", label: "Amministratore" },
  { value: "operatore", label: "Operatore (multi-reparto)" },
  { value: "cassa", label: "Cassa" },
  { value: "bancone", label: "Bancone" },
  { value: "cucina", label: "Cucina" },
  { value: "pizzaiolo", label: "Pizzaiolo" },
  { value: "delivery", label: "Delivery" },
  { value: "pony", label: "Pony" },
]

const RUOLO_VALUES = new Set(RUOLO_OPTIONS.map((o) => o.value))

function ruoloLabel(value) {
  const o = RUOLO_OPTIONS.find((x) => x.value === value)
  return o ? o.label : value || "—"
}

export default function UserManager() {
  const { tenantId } = useTenant()

  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState("")
  const [busyId, setBusyId] = useState(null)

  async function loadUsers() {
    try {
      setLoading(true)
      setError(null)
      const data = await getTenantUsers(tenantId)
      setUsers(data)
    } catch (err) {
      console.error(err)
      setError(err?.message ? `Errore nel caricamento utenti: ${err.message}` : "Errore nel caricamento utenti.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (tenantId) {
      void loadUsers()
    } else {
      setLoading(false)
      setUsers([])
    }
  }, [tenantId])

  const filteredUsers = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return users
    return users.filter((u) => {
      const email = (u.email || "").toLowerCase()
      const nome = (u.nome || "").toLowerCase()
      return email.includes(q) || nome.includes(q)
    })
  }, [users, filter])

  const stats = useMemo(() => {
    const total = users.length
    const attivi = users.filter((u) => u.attivo).length
    return { total, attivi }
  }, [users])

  async function handleRoleChange(userId, ruolo) {
    if (!tenantId) return
    setBusyId(userId)
    try {
      await updateUserRole(tenantId, userId, ruolo)
      await loadUsers()
    } catch (err) {
      console.error(err)
      alert(err?.message || "Aggiornamento ruolo non riuscito.")
    } finally {
      setBusyId(null)
    }
  }

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

  if (loading) return <Loader />
  if (error) return <ErrorState message={error} />

  return (
    <div className="dashboard-settings-page dashboard-dipendenti-page">
      <h1 className="dashboard-page-title">Dipendenti</h1>
      <p className="dashboard-settings-section-desc" style={{ marginBottom: 14 }}>
        Anagrafica degli account collegati alla pizzeria: qui imposti il <strong>ruolo base</strong> e se la persona può
        accedere. Le <strong>aree operative</strong> (cassa, cucina, riepilogo nel menu operativo, ecc.) si gestiscono nella
        pagina{" "}
        <Link to="/admin/ruoli" style={{ fontWeight: 600 }}>
          Ruoli
        </Link>
        .
      </p>

      <div className="dipendenti-callout" role="note">
        <strong>Perché due pagine?</strong> Dipendenti = profilo e accesso; Ruoli = permessi dettagliati su ogni schermata
        operativa (e parametri cassa per chi fa cassa).
      </div>

      <section className="dashboard-box dashboard-settings-section" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "18px 20px 0" }}>
          <h2 className="dashboard-settings-section-title" style={{ marginBottom: 4 }}>
            Elenco dipendenti
          </h2>
          <p style={{ color: "#64748b", fontSize: 13, margin: "0 0 14px", lineHeight: 1.5 }}>
            Tabella riepilogativa: cerca per nome o email, modifica ruolo o sospendi l’accesso senza uscire dalla pagina.
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
            placeholder="Nome o email…"
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
            Nessun utente collegato a questo locale. Gli accessi si creano invitando l’utente (es. da Supabase) e
            assegnando il tenant; poi comparirà qui.
          </p>
        ) : filteredUsers.length === 0 ? (
          <p style={{ padding: "0 20px 24px", color: "#64748b", fontSize: 14, margin: 0 }}>
            Nessun risultato per «{filter.trim()}». Prova un altro testo o svuota la ricerca.
          </p>
        ) : (
          <div className="dashboard-table-wrap dipendenti-table-outer" style={{ borderRadius: 0, borderLeft: "none", borderRight: "none", borderBottom: "none", boxShadow: "none" }}>
            <div style={{ overflowX: "auto" }}>
              <table className="dipendenti-table">
                <thead>
                  <tr>
                    <th scope="col">Dipendente</th>
                    <th scope="col">Ruolo base</th>
                    <th scope="col">Accesso</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => {
                    const displayName = labelFromEmailPrefix(user.email) || user.nome || "—"
                    const rowBusy = busyId === user.id
                    return (
                      <tr key={user.id}>
                        <td>
                          <strong style={{ color: "#0f172a" }}>{displayName}</strong>
                          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2, wordBreak: "break-all" }}>{user.email}</div>
                        </td>
                        <td>
                          <select
                            className="dipendenti-role-select"
                            value={user.ruolo}
                            disabled={rowBusy}
                            onChange={(e) => handleRoleChange(user.id, e.target.value)}
                            aria-label={`Ruolo per ${displayName}`}
                          >
                            {RUOLO_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                            {user.ruolo && !RUOLO_VALUES.has(user.ruolo) ? (
                              <option value={user.ruolo}>{ruoloLabel(user.ruolo)}</option>
                            ) : null}
                          </select>
                          <div className="dipendenti-role-hint">Valore tecnico: {user.ruolo || "—"}</div>
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
    </div>
  )
}
