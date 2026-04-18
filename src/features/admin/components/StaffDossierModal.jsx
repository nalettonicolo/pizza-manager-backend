import { useCallback, useEffect, useMemo, useState } from "react"
import Modal from "@/components/dashboard/Modal"
import {
  updateStaffArchivioById,
  uploadStaffHrFile,
  getStaffHrSignedUrl,
  removeStaffHrFiles,
} from "@/features/admin/services/adminService"
import { labelFromEmailPrefix } from "@/utils/emailDisplayLabel"
const MAX_FILE = 12 * 1024 * 1024

const TABS = [
  { id: "anagrafica", label: "Anagrafica" },
  { id: "corsi", label: "Corsi" },
  { id: "allegati", label: "Allegati" },
  { id: "buste", label: "Buste paga" },
]

function newId() {
  return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random()}`
}

function normalizeCorsi(raw) {
  if (!Array.isArray(raw)) return []
  return raw.map((c, i) => {
    if (typeof c === "string") {
      return {
        id: `legacy-${i}`,
        titolo: c,
        completato_il: "",
        scadenza_il: "",
        prossimo_corso_il: "",
        note: "",
      }
    }
    return {
      id: c.id || `c-${i}-${Date.now()}`,
      titolo: c.titolo || "",
      completato_il: c.completato_il || "",
      scadenza_il: c.scadenza_il || "",
      prossimo_corso_il: c.prossimo_corso_il || "",
      note: c.note || "",
    }
  })
}

function parseLines(s) {
  return String(s || "")
    .split("\n")
    .map((v) => v.trim())
    .filter(Boolean)
}

function corsoBadge(c) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  if (!c.completato_il && c.titolo) return { label: "Da completare", color: "#b45309" }
  if (c.scadenza_il) {
    const scad = new Date(c.scadenza_il)
    if (!Number.isNaN(scad.getTime())) {
      const diff = (scad - today) / (864e5)
      if (diff < 0) return { label: "Scaduto", color: "#b91c1c" }
      if (diff <= 30) return { label: "In scadenza", color: "#c2410c" }
      return { label: "Regolare", color: "#15803d" }
    }
  }
  return { label: "—", color: "#64748b" }
}

export default function StaffDossierModal({
  open,
  onClose,
  tenantId,
  /** Account applicativo collegato (opzionale): solo etichetta e cartella storage se presente. */
  user,
  /** Riga `staff_archivio_dipendenti` (obbligatoria per aprire la modale). */
  archivioRow,
  onSaved,
}) {
  const [tab, setTab] = useState("anagrafica")
  const [saving, setSaving] = useState(false)
  const [fotoBusy, setFotoBusy] = useState(false)
  const [fileBusy, setFileBusy] = useState(false)

  const [draft, setDraft] = useState(null)
  const [corsiList, setCorsiList] = useState([])
  const [allegati, setAllegati] = useState([])
  const [buste, setBuste] = useState([])
  const [fotoPath, setFotoPath] = useState(null)
  const [fotoPreview, setFotoPreview] = useState("")

  const storageSubjectId = user?.id ?? archivioRow?.id

  const title = useMemo(() => {
    const nome = (archivioRow?.nome_completo || "").trim()
    if (nome) return `Scheda HR — ${nome}`
    if (user?.email) return `Scheda HR — ${labelFromEmailPrefix(user.email) || user.email}`
    return "Scheda HR"
  }, [archivioRow?.nome_completo, user?.email])

  const resetFromProps = useCallback(async () => {
    if (!archivioRow?.id) return
    const curr = archivioRow || {}
    setDraft({
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
      documenti_lavoro_text: Array.isArray(curr.documenti_lavoro) ? curr.documenti_lavoro.join("\n") : "",
      note_hr: curr.note_hr || "",
    })
    setCorsiList(normalizeCorsi(curr.corsi_formazione))
    setAllegati(Array.isArray(curr.allegati_hr) ? curr.allegati_hr : [])
    setBuste(Array.isArray(curr.buste_paga) ? curr.buste_paga : [])
    const fp = curr.foto_url || null
    setFotoPath(fp)
    if (fp) {
      try {
        const url = await getStaffHrSignedUrl(fp, 7200)
        setFotoPreview(url)
      } catch {
        setFotoPreview("")
      }
    } else {
      setFotoPreview("")
    }
  }, [archivioRow])

  useEffect(() => {
    if (open && archivioRow?.id) {
      void resetFromProps()
      setTab("anagrafica")
    }
  }, [open, archivioRow?.id, archivioRow, resetFromProps])

  const handleFoto = useCallback(async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file || !tenantId || !storageSubjectId) return
    if (file.size > MAX_FILE) {
      alert("File troppo grande (max 12 MB).")
      return
    }
    setFotoBusy(true)
    try {
      const path = await uploadStaffHrFile(tenantId, storageSubjectId, file, "foto")
      setFotoPath(path)
      const url = await getStaffHrSignedUrl(path, 7200)
      setFotoPreview(url)
    } catch (err) {
      console.error(err)
      alert(err?.message || "Caricamento foto non riuscito.")
    } finally {
      setFotoBusy(false)
    }
  }, [tenantId, storageSubjectId])

  const uploadAllegato = async (file, kind) => {
    if (!file || !tenantId || !storageSubjectId) return
    if (file.size > MAX_FILE) {
      alert("File troppo grande (max 12 MB).")
      return
    }
    setFileBusy(true)
    try {
      const path = await uploadStaffHrFile(tenantId, storageSubjectId, file, kind === "busta" ? "buste" : "docs")
      const meta = {
        id: newId(),
        nome: file.name || "file",
        storage_path: path,
        creato_at: new Date().toISOString(),
        mese_riferimento: "",
      }
      if (kind === "busta") {
        setBuste((prev) => [...prev, meta])
      } else {
        setAllegati((prev) => [...prev, meta])
      }
    } catch (err) {
      console.error(err)
      alert(err?.message || "Upload non riuscito.")
    } finally {
      setFileBusy(false)
    }
  }

  const removeAllegato = async (kind, id) => {
    const list = kind === "busta" ? buste : allegati
    const row = list.find((x) => x.id === id)
    if (!row?.storage_path) return
    if (!window.confirm("Rimuovere questo file dall’archivio?")) return
    await removeStaffHrFiles([row.storage_path])
    if (kind === "busta") setBuste((prev) => prev.filter((x) => x.id !== id))
    else setAllegati((prev) => prev.filter((x) => x.id !== id))
  }

  const updateBustaMese = (id, mese) => {
    setBuste((prev) => prev.map((b) => (b.id === id ? { ...b, mese_riferimento: mese } : b)))
  }

  const openMailtoBusta = (b) => {
    const to = draft?.email_personale?.trim()
    if (!to) {
      alert("Compila l’email personale in Anagrafica per usare l’invio rapido.")
      return
    }
    const subj = encodeURIComponent(`Busta paga ${b.mese_riferimento || ""}`.trim() || "Busta paga")
    const body = encodeURIComponent(
      `Ciao,\n\nin allegato la busta paga (${b.nome}).\n\n` +
        `Scarica il file dalla scheda dipendente (PizzaManager → Dipendenti) con «Scarica», poi allega manualmente a questa email: ` +
        `il programma di posta non può allegare file automaticamente dal browser.\n\n`,
    )
    window.open(`mailto:${to}?subject=${subj}&body=${body}`, "_blank")
  }

  const saveHr = async () => {
    if (!tenantId || !archivioRow?.id || !draft) return
    setSaving(true)
    try {
      await updateStaffArchivioById(tenantId, archivioRow.id, {
        ...draft,
        data_nascita: draft.data_nascita || null,
        data_assunzione: draft.data_assunzione || null,
        foto_url: fotoPath,
        corsi_formazione: corsiList,
        documenti_lavoro: parseLines(draft.documenti_lavoro_text),
        allegati_hr: allegati,
        buste_paga: buste,
        note_hr: draft.note_hr.trim(),
        user_id: archivioRow.user_id ?? user?.id ?? null,
      })
      await onSaved?.()
      alert("Scheda salvata.")
    } catch (err) {
      console.error(err)
      alert(err?.message || "Salvataggio non riuscito. Esegui in Supabase sql/sql_upgrade.sql se mancano colonne HR.")
    } finally {
      setSaving(false)
    }
  }

  const addCorsoRow = () => {
    setCorsiList((prev) => [
      ...prev,
      { id: newId(), titolo: "", completato_il: "", scadenza_il: "", prossimo_corso_il: "", note: "" },
    ])
  }

  const anagraficaTab = useMemo(() => {
    if (!draft) return null
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start" }}>
          <div style={{ width: 96, height: 96, borderRadius: 12, overflow: "hidden", background: "#e2e8f0", flexShrink: 0 }}>
            {fotoPreview ? (
              <img src={fotoPreview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#64748b", textAlign: "center", padding: 8 }}>
                Nessuna foto
              </div>
            )}
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>Foto profilo</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              <input type="file" accept="image/*" disabled={fotoBusy} onChange={(e) => void handleFoto(e)} />
              {fotoPath ? (
                <button type="button" className="dashboard-settings-btn-secondary" onClick={() => { setFotoPath(null); setFotoPreview("") }}>
                  Rimuovi foto
                </button>
              ) : null}
            </div>
            {fotoBusy ? <span style={{ fontSize: 12, color: "#64748b" }}> Caricamento…</span> : null}
            <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 6, maxWidth: 280 }}>Storage bucket «staff-hr» richiesto in Supabase.</p>
          </div>
        </div>
        <Field label="Nome completo">
          <input className="dashboard-search-input" value={draft.nome_completo} onChange={(e) => setDraft((d) => ({ ...d, nome_completo: e.target.value }))} />
        </Field>
        <Field label="Codice fiscale">
          <input className="dashboard-search-input" value={draft.codice_fiscale} onChange={(e) => setDraft((d) => ({ ...d, codice_fiscale: e.target.value.toUpperCase() }))} />
        </Field>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
          <Field label="Data nascita">
            <input type="date" className="dashboard-search-input" value={draft.data_nascita} onChange={(e) => setDraft((d) => ({ ...d, data_nascita: e.target.value }))} />
          </Field>
          <Field label="Luogo nascita">
            <input className="dashboard-search-input" value={draft.luogo_nascita} onChange={(e) => setDraft((d) => ({ ...d, luogo_nascita: e.target.value }))} />
          </Field>
        </div>
        <Field label="Indirizzo residenza">
          <input className="dashboard-search-input" value={draft.indirizzo_residenza} onChange={(e) => setDraft((d) => ({ ...d, indirizzo_residenza: e.target.value }))} />
        </Field>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
          <Field label="Telefono personale">
            <input className="dashboard-search-input" value={draft.telefono_personale} onChange={(e) => setDraft((d) => ({ ...d, telefono_personale: e.target.value }))} />
          </Field>
          <Field label="Email personale">
            <input type="email" className="dashboard-search-input" value={draft.email_personale} onChange={(e) => setDraft((d) => ({ ...d, email_personale: e.target.value }))} />
          </Field>
        </div>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
          <Field label="Mansione">
            <input className="dashboard-search-input" value={draft.mansione} onChange={(e) => setDraft((d) => ({ ...d, mansione: e.target.value }))} />
          </Field>
          <Field label="Tipo contratto">
            <input className="dashboard-search-input" value={draft.tipo_contratto} onChange={(e) => setDraft((d) => ({ ...d, tipo_contratto: e.target.value }))} />
          </Field>
        </div>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
          <Field label="Data assunzione">
            <input type="date" className="dashboard-search-input" value={draft.data_assunzione} onChange={(e) => setDraft((d) => ({ ...d, data_assunzione: e.target.value }))} />
          </Field>
          <Field label="IBAN">
            <input className="dashboard-search-input" value={draft.iban} onChange={(e) => setDraft((d) => ({ ...d, iban: e.target.value.toUpperCase() }))} />
          </Field>
        </div>
        <Field label="Note elenco documenti (testo libero)">
          <textarea rows={2} className="dashboard-search-input" value={draft.documenti_lavoro_text} onChange={(e) => setDraft((d) => ({ ...d, documenti_lavoro_text: e.target.value }))} />
        </Field>
        <Field label="Note HR">
          <textarea rows={2} className="dashboard-search-input" value={draft.note_hr} onChange={(e) => setDraft((d) => ({ ...d, note_hr: e.target.value }))} />
        </Field>
      </div>
    )
  }, [draft, fotoPreview, fotoBusy, fotoPath, handleFoto])

  if (!open || !archivioRow?.id) return null

  return (
    <Modal open={open} onClose={() => !saving && onClose()} title={title} wide>
      <div style={{ padding: "4px 0 0" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14, borderBottom: "1px solid #e2e8f0", paddingBottom: 10 }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={tab === t.id ? "btn-primary-dashboard" : "dashboard-settings-btn-secondary"}
              style={{ padding: "8px 12px", fontSize: 13 }}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p style={{ fontSize: 12, color: "#64748b", marginBottom: 14, lineHeight: 1.5 }}>
          Scheda dedicata a <strong>dati HR e documentazione</strong>. L&apos;imputazione economica delle buste paga in contabilità sarà
          collegata in seguito.
        </p>

        {tab === "anagrafica" && anagraficaTab}

        {tab === "corsi" && (
          <div>
            <p style={{ fontSize: 13, color: "#64748b", marginBottom: 10 }}>
              Traccia corsi obbligatori, scadenze e sessioni programmate. Lo stato è calcolato dalle date.
            </p>
            <button type="button" className="dashboard-settings-btn-secondary" style={{ marginBottom: 10 }} onClick={addCorsoRow}>
              + Aggiungi corso
            </button>
            <div style={{ overflowX: "auto" }}>
              <table className="dipendenti-table" style={{ minWidth: 560 }}>
                <thead>
                  <tr>
                    <th>Corso</th>
                    <th>Completato</th>
                    <th>Scadenza</th>
                    <th>Prossima sessione</th>
                    <th>Stato</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {corsiList.map((c) => {
                    const badge = corsoBadge(c)
                    return (
                      <tr key={c.id}>
                        <td>
                          <input className="dashboard-search-input" style={{ minWidth: 140 }} value={c.titolo} onChange={(e) => setCorsiList((p) => p.map((x) => (x.id === c.id ? { ...x, titolo: e.target.value } : x)))} placeholder="es. HACCP" />
                        </td>
                        <td>
                          <input type="date" className="dashboard-search-input" value={c.completato_il} onChange={(e) => setCorsiList((p) => p.map((x) => (x.id === c.id ? { ...x, completato_il: e.target.value } : x)))} />
                        </td>
                        <td>
                          <input type="date" className="dashboard-search-input" value={c.scadenza_il} onChange={(e) => setCorsiList((p) => p.map((x) => (x.id === c.id ? { ...x, scadenza_il: e.target.value } : x)))} />
                        </td>
                        <td>
                          <input type="date" className="dashboard-search-input" value={c.prossimo_corso_il} onChange={(e) => setCorsiList((p) => p.map((x) => (x.id === c.id ? { ...x, prossimo_corso_il: e.target.value } : x)))} />
                        </td>
                        <td>
                          <span style={{ fontSize: 12, fontWeight: 600, color: badge.color }}>{badge.label}</span>
                        </td>
                        <td>
                          <button type="button" className="dashboard-settings-btn-secondary" onClick={() => setCorsiList((p) => p.filter((x) => x.id !== c.id))}>
                            Rimuovi
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {corsiList.length === 0 ? <p style={{ color: "#94a3b8", fontSize: 13 }}>Nessun corso. Aggiungi una riga.</p> : null}
          </div>
        )}

        {tab === "allegati" && (
          <div>
            <p style={{ fontSize: 13, color: "#64748b", marginBottom: 8 }}>Contratti, certificati, documenti (PDF, immagini).</p>
            <input type="file" disabled={fileBusy} onChange={(e) => void uploadAllegato(e.target.files?.[0], "doc")} />
            <ul style={{ margin: "12px 0 0", padding: 0, listStyle: "none" }}>
              {allegati.map((a) => (
                <li key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #f1f5f9" }}>
                  <span style={{ flex: 1, fontSize: 14 }}>{a.nome}</span>
                  <button type="button" className="dashboard-settings-btn-secondary" onClick={async () => downloadFile(a.storage_path)}>
                    Scarica
                  </button>
                  <button type="button" className="dashboard-settings-btn-secondary" onClick={() => void removeAllegato("doc", a.id)}>
                    Elimina
                  </button>
                </li>
              ))}
            </ul>
            {allegati.length === 0 ? <p style={{ color: "#94a3b8", fontSize: 13 }}>Nessun allegato.</p> : null}
          </div>
        )}

        {tab === "buste" && (
          <div>
            <p style={{ fontSize: 13, color: "#64748b", marginBottom: 8 }}>
              Carica le buste paga (PDF). Per l&apos;invio: usa «Apri email» — il browser apre il client di posta; allega il file scaricato (non è possibile allegare automaticamente da web).
            </p>
            <input type="file" accept=".pdf,application/pdf" disabled={fileBusy} onChange={(e) => void uploadAllegato(e.target.files?.[0], "busta")} />
            <ul style={{ margin: "12px 0 0", padding: 0, listStyle: "none" }}>
              {buste.map((b) => (
                <li key={b.id} style={{ padding: "10px 0", borderBottom: "1px solid #f1f5f9" }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                    <span style={{ fontWeight: 600 }}>{b.nome}</span>
                    <label style={{ fontSize: 12 }}>
                      Mese riferimento{" "}
                      <input type="month" value={b.mese_riferimento || ""} onChange={(e) => updateBustaMese(b.id, e.target.value)} className="dashboard-search-input" style={{ width: 140 }} />
                    </label>
                    <button type="button" className="dashboard-settings-btn-secondary" onClick={() => void downloadFile(b.storage_path)}>
                      Scarica
                    </button>
                    <button type="button" className="btn-primary-dashboard" style={{ padding: "6px 10px", fontSize: 12 }} onClick={() => openMailtoBusta(b)}>
                      Apri email
                    </button>
                    <button type="button" className="dashboard-settings-btn-secondary" onClick={() => void removeAllegato("busta", b.id)}>
                      Elimina
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            {buste.length === 0 ? <p style={{ color: "#94a3b8", fontSize: 13 }}>Nessuna busta caricata.</p> : null}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18, paddingTop: 12, borderTop: "1px solid #e2e8f0" }}>
          <button type="button" className="dashboard-settings-btn-secondary" disabled={saving} onClick={onClose}>
            Chiudi
          </button>
          <button type="button" className="btn-primary-dashboard" disabled={saving} onClick={() => void saveHr()}>
            {saving ? "Salvataggio…" : "Salva scheda HR"}
          </button>
        </div>
      </div>
    </Modal>
  )
}

async function downloadFile(storagePath) {
  try {
    const url = await getStaffHrSignedUrl(storagePath, 120)
    window.open(url, "_blank", "noopener,noreferrer")
  } catch (e) {
    console.error(e)
    alert(e?.message || "Download non disponibile.")
  }
}

function Field({ label, children }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>{label}</span>
      {children}
    </label>
  )
}
