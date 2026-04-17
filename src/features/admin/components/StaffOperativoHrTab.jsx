import { useEffect, useState, useCallback } from "react"
import {
  updateRuoloPizzeriaPermessi,
  listStaffPasswordNotes,
  upsertStaffPasswordNote,
} from "@/features/admin/services/adminService"
import { isDefaultAreaForRole, isDedicatedRepartoRole } from "@/utils/operativeAreaAccess"
import { labelFromEmailPrefix } from "@/utils/emailDisplayLabel"
import { verifyCurrentAdminPassword } from "@/utils/adminPasswordReverify"
import {
  AREE_NAV,
  ACCESS_TO_AREA_KEY,
  RUOLO_BASE_OPTIONS,
  RUOLO_BASE_VALUES,
  nomeInSedeOEmail,
  getCosaPuoFare,
} from "@/features/admin/utils/ruoliPizzeriaUi"

const ARCHIVIO_PASSWORD_MS = 10 * 60 * 1000

export default function StaffOperativoHrTab({
  tenantId,
  detailUser,
  onDetailUserRefresh,
}) {
  const [roleBusyUserId, setRoleBusyUserId] = useState(null)
  const [archivioUnlockUntil, setArchivioUnlockUntil] = useState(0)
  const [noteByUserId, setNoteByUserId] = useState({})
  const [reauthOpen, setReauthOpen] = useState(false)
  const [reauthPassword, setReauthPassword] = useState("")
  const [reauthBusy, setReauthBusy] = useState(false)
  const [reauthError, setReauthError] = useState(null)
  const [noteDraft, setNoteDraft] = useState("")
  const [noteSaveBusy, setNoteSaveBusy] = useState(false)

  const archivioSbloccato = typeof archivioUnlockUntil === "number" && Date.now() < archivioUnlockUntil

  const chiudiArchivio = useCallback(() => {
    setArchivioUnlockUntil(0)
    setNoteByUserId({})
  }, [])

  useEffect(() => {
    if (!archivioUnlockUntil || Date.now() >= archivioUnlockUntil) return undefined
    const ms = archivioUnlockUntil - Date.now()
    const id = window.setTimeout(() => chiudiArchivio(), Math.max(ms, 0))
    return () => window.clearTimeout(id)
  }, [archivioUnlockUntil, chiudiArchivio])

  useEffect(() => {
    if (!detailUser || !tenantId) {
      setNoteDraft("")
      return
    }
    if (archivioSbloccato && Object.prototype.hasOwnProperty.call(noteByUserId, detailUser.user_id)) {
      setNoteDraft(noteByUserId[detailUser.user_id] ?? "")
      return
    }
    setNoteDraft("")
  }, [detailUser, tenantId, archivioSbloccato, noteByUserId])

  async function apriReauthMostraNote() {
    setReauthError(null)
    setReauthPassword("")
    setReauthOpen(true)
  }

  async function confermaReauth() {
    if (!tenantId) return
    setReauthBusy(true)
    setReauthError(null)
    try {
      const v = await verifyCurrentAdminPassword(reauthPassword)
      if (!v.ok) {
        setReauthError(v.message || "Verifica non riuscita.")
        return
      }
      const rows = await listStaffPasswordNotes(tenantId)
      const map = {}
      for (const row of rows) {
        map[row.user_id] = row.password_nota ?? ""
      }
      setNoteByUserId(map)
      setArchivioUnlockUntil(Date.now() + ARCHIVIO_PASSWORD_MS)
      setReauthOpen(false)
      setReauthPassword("")
    } catch (err) {
      console.error(err)
      setReauthError(err?.message || "Impossibile caricare le note.")
    } finally {
      setReauthBusy(false)
    }
  }

  async function salvaNotaPasswordDettaglio() {
    if (!tenantId || !detailUser?.user_id) return
    setNoteSaveBusy(true)
    try {
      await upsertStaffPasswordNote(tenantId, detailUser.user_id, noteDraft)
      setNoteByUserId((prev) => ({
        ...prev,
        [detailUser.user_id]: noteDraft.trim(),
      }))
      alert(noteDraft.trim() ? "Nota salvata." : "Nota rimossa.")
    } catch (err) {
      console.error(err)
      alert(err?.message || "Salvataggio non riuscito.")
    } finally {
      setNoteSaveBusy(false)
    }
  }

  async function handleToggleParametri(ruoloRecord) {
    if (!tenantId || !ruoloRecord?.user_id) return
    try {
      await updateRuoloPizzeriaPermessi(tenantId, ruoloRecord.user_id, {
        puo_modificare_parametri: !ruoloRecord.puo_modificare_parametri,
      })
      await onDetailUserRefresh?.()
    } catch (err) {
      console.error(err)
      alert("Errore nell'aggiornare i permessi. " + (err?.message || ""))
    }
  }

  async function handleToggleArea(ruoloRecord, areaKey) {
    if (!tenantId || !ruoloRecord?.user_id) return
    if (isDedicatedRepartoRole(ruoloRecord.ruolo)) return
    const ak = ACCESS_TO_AREA_KEY[areaKey]
    if (ak && isDefaultAreaForRole(ruoloRecord.ruolo, ak)) return
    const current = ruoloRecord[areaKey] === true
    try {
      await updateRuoloPizzeriaPermessi(tenantId, ruoloRecord.user_id, { [areaKey]: !current })
      await onDetailUserRefresh?.()
    } catch (err) {
      console.error(err)
      alert("Errore nell'aggiornare l'accesso. " + (err?.message || ""))
    }
  }

  async function handleRuoloBaseChange(record, nuovoRuolo) {
    if (!tenantId || !record?.user_id) return
    if (record.ruolo === nuovoRuolo) return
    setRoleBusyUserId(record.user_id)
    try {
      await updateRuoloPizzeriaPermessi(tenantId, record.user_id, { ruolo: nuovoRuolo })
      await onDetailUserRefresh?.()
    } catch (err) {
      console.error(err)
      alert(err?.message || "Aggiornamento ruolo non riuscito.")
    } finally {
      setRoleBusyUserId(null)
    }
  }

  if (!detailUser) return null

  return (
    <div style={{ padding: "4px 0 0" }}>
      <p style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700, color: "#0f172a" }}>{nomeInSedeOEmail(detailUser)}</p>
      <p style={{ margin: "0 0 12px", fontSize: 13, color: "#64748b" }}>{detailUser.email}</p>
      {detailUser.nome_visualizzato && String(detailUser.nome_visualizzato).trim() ? (
        <p style={{ margin: "0 0 12px", fontSize: 12, color: "#94a3b8" }}>
          Etichetta account: {labelFromEmailPrefix(detailUser.email) || "—"}
        </p>
      ) : null}
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 6 }}>
          Ruolo base
        </label>
        <select
          className="dipendenti-role-select"
          style={{ maxWidth: "100%" }}
          value={detailUser.ruolo}
          disabled={roleBusyUserId === detailUser.user_id}
          onChange={(e) => handleRuoloBaseChange(detailUser, e.target.value)}
        >
          {RUOLO_BASE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
          {detailUser.ruolo && !RUOLO_BASE_VALUES.has(detailUser.ruolo) ? (
            <option value={detailUser.ruolo}>{detailUser.ruolo}</option>
          ) : null}
        </select>
        <p style={{ margin: "6px 0 0", fontSize: 11, color: "#94a3b8" }}>Valore tecnico: {detailUser.ruolo || "—"}</p>
      </div>
      <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.8, marginBottom: 16 }}>
        {getCosaPuoFare(detailUser.ruolo, detailUser.puo_modificare_parametri).map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
      <p style={{ marginBottom: 8, fontSize: 14, fontWeight: 600, color: "#334155" }}>Aree consentite</p>
      {isDedicatedRepartoRole(detailUser.ruolo) ? (
        <p style={{ marginBottom: 12, fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>
          Per i ruoli di reparto è attiva <strong>solo</strong> l&apos;area del ruolo. Per più reparti usa il ruolo{" "}
          <strong>operatore</strong> e spunta le aree qui sotto.
        </p>
      ) : (
        <p style={{ marginBottom: 12, fontSize: 12, color: "#64748b" }}>
          L&apos;area del ruolo è sempre attiva. Spunta le altre aree per il menù operativo.
        </p>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {AREE_NAV.map((area) => {
          const ak = ACCESS_TO_AREA_KEY[area.key]
          const fixedByRole = ak ? isDefaultAreaForRole(detailUser.ruolo, ak) : false
          const dedicated = isDedicatedRepartoRole(detailUser.ruolo)
          const checked = fixedByRole || (!dedicated && detailUser[area.key] === true)
          const disabled = fixedByRole || dedicated
          return (
            <label
              key={area.key}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 14,
                cursor: disabled ? "default" : "pointer",
                opacity: disabled ? 0.85 : 1,
              }}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={() => handleToggleArea(detailUser, area.key)}
                style={{ width: 18, height: 18, cursor: disabled ? "not-allowed" : "pointer" }}
              />
              {area.label}
              {fixedByRole ? <span style={{ fontSize: 11, color: "#94a3b8" }}>(sempre per questo ruolo)</span> : null}
            </label>
          )
        })}
      </div>
      {detailUser.ruolo === "cassa" && (
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, marginTop: 12, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={!!detailUser.puo_modificare_parametri}
            onChange={() => handleToggleParametri(detailUser)}
            style={{ width: 18, height: 18, cursor: "pointer" }}
          />
          Può modificare parametri cassa
        </label>
      )}

      <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #e2e8f0" }}>
        <p style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 600, color: "#334155" }}>Password d&apos;accesso (archivio)</p>
        <p style={{ margin: "0 0 10px", fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>
          Nota opzionale per il titolare (non è la password Supabase Auth).
        </p>
        {archivioSbloccato ? (
          <p style={{ margin: "0 0 8px", fontSize: 13 }}>
            <span style={{ color: "#166534", fontWeight: 600 }}>Note visibili.</span>{" "}
            <button type="button" className="dashboard-settings-btn-secondary" style={{ marginLeft: 8 }} onClick={chiudiArchivio}>
              Nascondi
            </button>
          </p>
        ) : (
          <p style={{ margin: "0 0 10px", fontSize: 13 }}>
            <button type="button" className="btn-primary-dashboard" style={{ padding: "6px 12px", fontSize: 12 }} onClick={apriReauthMostraNote}>
              Sblocca lettura note (password admin)
            </button>
          </p>
        )}
        {!archivioSbloccato ? (
          <p style={{ margin: "0 0 8px", fontSize: 12, color: "#b45309" }}>
            Per leggere in chiaro le note già salvate, sblocca con la tua password admin (pulsante sopra).
          </p>
        ) : null}
        <textarea
          value={noteDraft}
          onChange={(e) => setNoteDraft(e.target.value)}
          rows={2}
          className="dashboard-search-input"
          style={{ width: "100%", maxWidth: "100%", boxSizing: "border-box", fontFamily: "inherit", fontSize: 13 }}
          placeholder={archivioSbloccato ? "Password o nota…" : "Nuova nota…"}
        />
        <button
          type="button"
          className="btn-primary-dashboard"
          style={{ marginTop: 10, padding: "8px 16px", fontSize: 13 }}
          disabled={noteSaveBusy}
          onClick={() => void salvaNotaPasswordDettaglio()}
        >
          {noteSaveBusy ? "Salvataggio…" : "Salva nota password"}
        </button>
      </div>

      {reauthOpen ? (
        <div style={{ marginTop: 16, padding: 12, background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
          <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 600 }}>Conferma password admin</p>
          <input
            type="password"
            autoComplete="current-password"
            value={reauthPassword}
            onChange={(e) => setReauthPassword(e.target.value)}
            className="dashboard-search-input"
            style={{ width: "100%", marginBottom: 8 }}
            disabled={reauthBusy}
            onKeyDown={(e) => e.key === "Enter" && !reauthBusy && void confermaReauth()}
          />
          {reauthError ? (
            <p style={{ color: "#b91c1c", fontSize: 13 }} role="alert">
              {reauthError}
            </p>
          ) : null}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button type="button" className="dashboard-settings-btn-secondary" disabled={reauthBusy} onClick={() => setReauthOpen(false)}>
              Annulla
            </button>
            <button type="button" className="btn-primary-dashboard" disabled={reauthBusy} onClick={() => void confermaReauth()}>
              {reauthBusy ? "Verifica…" : "Conferma"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
