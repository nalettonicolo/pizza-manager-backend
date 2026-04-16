import { useCallback, useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { useTenant } from "@/app/contexts/TenantContext"
import Loader from "@/components/feedback/Loader"
import ErrorState from "@/components/feedback/ErrorState"
import Modal from "@/components/dashboard/Modal"
import {
  getTenantUsers,
  toggleUserActive,
  updateStaffNomeVisualizzato,
  listStaffArchivioDipendenti,
  upsertStaffArchivioDipendente,
} from "@/features/admin/services/adminService"
import { labelFromEmailPrefix } from "@/utils/emailDisplayLabel"

export default function UserManager() {
  const { tenantId } = useTenant()

  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState("")
  const [busyId, setBusyId] = useState(null)
  /** Bozze nome in sede (allineate al server dopo ogni load). */
  const [nomeDraft, setNomeDraft] = useState({})
  const [archivioByUserId, setArchivioByUserId] = useState({})
  const [archivioOpenUser, setArchivioOpenUser] = useState(null)
  const [archivioDraft, setArchivioDraft] = useState(null)
  const [archivioBusy, setArchivioBusy] = useState(false)

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await getTenantUsers(tenantId)
      setUsers(data)
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

  function openArchivioDipendente(user) {
    const curr = archivioByUserId[user.id] || {}
    setArchivioOpenUser(user)
    setArchivioDraft({
      nome_completo: curr.nome_completo || "",
      codice_fiscale: curr.codice_fiscale || "",
      data_nascita: curr.data_nascita || "",
      luogo_nascita: curr.luogo_nascita || "",
      indirizzo_residenza: curr.indirizzo_residenza || "",
      telefono_personale: curr.telefono_personale || "",
      email_personale: curr.email_personale || "",
      mansione: curr.mansione || "",
      tipo_contratto: curr.tipo_contratto || "",
      data_assunzione: curr.data_assunzione || "",
      iban: curr.iban || "",
      note_hr: curr.note_hr || "",
      corsi_formazione_text: Array.isArray(curr.corsi_formazione) ? curr.corsi_formazione.join("\n") : "",
      documenti_lavoro_text: Array.isArray(curr.documenti_lavoro) ? curr.documenti_lavoro.join("\n") : "",
    })
  }

  async function saveArchivioDipendente() {
    if (!tenantId || !archivioOpenUser || !archivioDraft) return
    setArchivioBusy(true)
    try {
      const parseLines = (s) =>
        String(s || "")
          .split("\n")
          .map((v) => v.trim())
          .filter(Boolean)
      const payload = {
        nome_completo: archivioDraft.nome_completo.trim(),
        codice_fiscale: archivioDraft.codice_fiscale.trim(),
        data_nascita: archivioDraft.data_nascita || null,
        luogo_nascita: archivioDraft.luogo_nascita.trim(),
        indirizzo_residenza: archivioDraft.indirizzo_residenza.trim(),
        telefono_personale: archivioDraft.telefono_personale.trim(),
        email_personale: archivioDraft.email_personale.trim(),
        mansione: archivioDraft.mansione.trim(),
        tipo_contratto: archivioDraft.tipo_contratto.trim(),
        data_assunzione: archivioDraft.data_assunzione || null,
        iban: archivioDraft.iban.trim(),
        note_hr: archivioDraft.note_hr.trim(),
        corsi_formazione: parseLines(archivioDraft.corsi_formazione_text),
        documenti_lavoro: parseLines(archivioDraft.documenti_lavoro_text),
      }
      await upsertStaffArchivioDipendente(tenantId, archivioOpenUser.id, payload)
      setArchivioByUserId((m) => ({
        ...m,
        [archivioOpenUser.id]: { ...m[archivioOpenUser.id], ...payload, user_id: archivioOpenUser.id },
      }))
      alert("Archivio dipendente salvato.")
      setArchivioOpenUser(null)
      setArchivioDraft(null)
    } catch (err) {
      console.error(err)
      alert(err?.message || "Salvataggio archivio non riuscito.")
    } finally {
      setArchivioBusy(false)
    }
  }

  if (loading) return <Loader />
  if (error) return <ErrorState message={error} />

  return (
    <div className="dashboard-settings-page dashboard-dipendenti-page">
      <h1 className="dashboard-page-title">Dipendenti</h1>
      <p className="dashboard-settings-section-desc" style={{ marginBottom: 14 }}>
        Anagrafica locale: <strong>nome in sede</strong>, <strong>accesso</strong> all&apos;account e{" "}
        <strong>archivio dipendente</strong> (dati anagrafici e HR). Il <strong>ruolo base</strong> e i permessi sul menu
        operativo si assegnano nella pagina{" "}
        <Link to="/admin/ruoli" style={{ fontWeight: 600 }}>
          Ruoli
        </Link>
        .
      </p>

      <div className="dipendenti-callout" role="note">
        <strong>Perché due pagine?</strong> Dipendenti = chi è in sede e documentazione; Ruoli = ruolo tecnico e cosa può
        fare in cassa, cucina, ecc.
      </div>

      <section className="dashboard-box dashboard-settings-section" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "18px 20px 0" }}>
          <h2 className="dashboard-settings-section-title" style={{ marginBottom: 4 }}>
            Elenco dipendenti
          </h2>
          <p style={{ color: "#64748b", fontSize: 13, margin: "0 0 14px", lineHeight: 1.5 }}>
            Cerca per nome, nome in sede o email; imposta il <strong>nome in sede</strong> e apri{" "}
            <strong>Archivio dipendente</strong> per i dati anagrafici. Per il ruolo e i permessi operativi usa la pagina{" "}
            <Link to="/admin/ruoli" style={{ fontWeight: 600 }}>
              Ruoli
            </Link>
            .
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
                    <th scope="col">Account</th>
                    <th scope="col">Nome in sede</th>
                    <th scope="col">Accesso</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => {
                    const accountLabel = labelFromEmailPrefix(user.email) || user.nome || "—"
                    const rowBusy = busyId === user.id
                    return (
                      <tr key={user.id}>
                        <td>
                          <strong style={{ color: "#0f172a" }}>{accountLabel}</strong>
                          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2, wordBreak: "break-all" }}>{user.email}</div>
                          <button
                            type="button"
                            className="dashboard-settings-btn-secondary"
                            style={{ marginTop: 8, fontSize: 12, padding: "6px 10px" }}
                            onClick={() => openArchivioDipendente(user)}
                          >
                            Archivio dipendente
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

      <Modal
        open={!!archivioOpenUser}
        onClose={() => {
          if (archivioBusy) return
          setArchivioOpenUser(null)
          setArchivioDraft(null)
        }}
        title={archivioOpenUser ? `Archivio dipendente - ${labelFromEmailPrefix(archivioOpenUser.email) || archivioOpenUser.email}` : ""}
      >
        {archivioOpenUser && archivioDraft ? (
          <div style={{ padding: "8px 0", maxHeight: "70vh", overflowY: "auto" }}>
            <ArchivioField label="Nome completo">
              <input
                className="dashboard-search-input"
                value={archivioDraft.nome_completo}
                onChange={(e) => setArchivioDraft((d) => ({ ...d, nome_completo: e.target.value }))}
              />
            </ArchivioField>
            <ArchivioField label="Codice fiscale">
              <input
                className="dashboard-search-input"
                value={archivioDraft.codice_fiscale}
                onChange={(e) => setArchivioDraft((d) => ({ ...d, codice_fiscale: e.target.value.toUpperCase() }))}
              />
            </ArchivioField>
            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
              <ArchivioField label="Data nascita">
                <input
                  type="date"
                  className="dashboard-search-input"
                  value={archivioDraft.data_nascita}
                  onChange={(e) => setArchivioDraft((d) => ({ ...d, data_nascita: e.target.value }))}
                />
              </ArchivioField>
              <ArchivioField label="Luogo nascita">
                <input
                  className="dashboard-search-input"
                  value={archivioDraft.luogo_nascita}
                  onChange={(e) => setArchivioDraft((d) => ({ ...d, luogo_nascita: e.target.value }))}
                />
              </ArchivioField>
            </div>
            <ArchivioField label="Indirizzo residenza">
              <input
                className="dashboard-search-input"
                value={archivioDraft.indirizzo_residenza}
                onChange={(e) => setArchivioDraft((d) => ({ ...d, indirizzo_residenza: e.target.value }))}
              />
            </ArchivioField>
            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
              <ArchivioField label="Telefono personale">
                <input
                  className="dashboard-search-input"
                  value={archivioDraft.telefono_personale}
                  onChange={(e) => setArchivioDraft((d) => ({ ...d, telefono_personale: e.target.value }))}
                />
              </ArchivioField>
              <ArchivioField label="Email personale">
                <input
                  type="email"
                  className="dashboard-search-input"
                  value={archivioDraft.email_personale}
                  onChange={(e) => setArchivioDraft((d) => ({ ...d, email_personale: e.target.value }))}
                />
              </ArchivioField>
            </div>
            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
              <ArchivioField label="Mansione">
                <input
                  className="dashboard-search-input"
                  value={archivioDraft.mansione}
                  onChange={(e) => setArchivioDraft((d) => ({ ...d, mansione: e.target.value }))}
                />
              </ArchivioField>
              <ArchivioField label="Tipo contratto">
                <input
                  className="dashboard-search-input"
                  value={archivioDraft.tipo_contratto}
                  onChange={(e) => setArchivioDraft((d) => ({ ...d, tipo_contratto: e.target.value }))}
                />
              </ArchivioField>
            </div>
            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
              <ArchivioField label="Data assunzione">
                <input
                  type="date"
                  className="dashboard-search-input"
                  value={archivioDraft.data_assunzione}
                  onChange={(e) => setArchivioDraft((d) => ({ ...d, data_assunzione: e.target.value }))}
                />
              </ArchivioField>
              <ArchivioField label="IBAN">
                <input
                  className="dashboard-search-input"
                  value={archivioDraft.iban}
                  onChange={(e) => setArchivioDraft((d) => ({ ...d, iban: e.target.value.toUpperCase() }))}
                />
              </ArchivioField>
            </div>
            <ArchivioField label="Corsi (una riga per corso)">
              <textarea
                rows={3}
                className="dashboard-search-input"
                value={archivioDraft.corsi_formazione_text}
                onChange={(e) => setArchivioDraft((d) => ({ ...d, corsi_formazione_text: e.target.value }))}
              />
            </ArchivioField>
            <ArchivioField label="Documenti / buste paga (una riga per voce)">
              <textarea
                rows={3}
                className="dashboard-search-input"
                value={archivioDraft.documenti_lavoro_text}
                onChange={(e) => setArchivioDraft((d) => ({ ...d, documenti_lavoro_text: e.target.value }))}
              />
            </ArchivioField>
            <ArchivioField label="Note HR">
              <textarea
                rows={3}
                className="dashboard-search-input"
                value={archivioDraft.note_hr}
                onChange={(e) => setArchivioDraft((d) => ({ ...d, note_hr: e.target.value }))}
              />
            </ArchivioField>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 12 }}>
              <button
                type="button"
                className="dashboard-settings-btn-secondary"
                onClick={() => {
                  if (archivioBusy) return
                  setArchivioOpenUser(null)
                  setArchivioDraft(null)
                }}
                disabled={archivioBusy}
              >
                Annulla
              </button>
              <button type="button" className="btn-primary-dashboard" onClick={() => void saveArchivioDipendente()} disabled={archivioBusy}>
                {archivioBusy ? "Salvataggio..." : "Salva archivio"}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}

function ArchivioField({ label, children }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>{label}</span>
      {children}
    </label>
  )
}
