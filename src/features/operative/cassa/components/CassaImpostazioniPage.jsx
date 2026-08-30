import { useState, useEffect, useCallback } from "react"
import { Link, useLocation } from "react-router-dom"
import { withPreservedSupportSearch } from "@/utils/supportTenantOverride"
import { useTenant } from "@/app/contexts/TenantContext"
import {
  getTenantSettings,
  updateTenantSettings,
  logCassaAuditEvent,
  listCassaAuditEvents,
} from "@/features/admin/services/adminService"

/** Solo parametri operativi giornalieri (CA-12 / foto 3). */
const OPERATIVE_KEYS = [
  "pony_lun_gio",
  "pony_ven_dom",
  "capienza_bauletto",
  "pizze_ogni_15_min",
  "consegne_ogni_min",
  "ritiro_ogni_min",
  "tempo_preparazione_pizza",
  "velocita_pony_kmh",
  "soglia_giallo_pizze",
  "pizzaiolo_ordini_visibili_minuti",
  "pizzaiolo_partenza_consegne_minuti",
  "pizzaiolo_tempo_viaggio_minuti",
]

const LABELS = {
  pony_lun_gio: "Pony lun–gio",
  pony_ven_dom: "Pony ven–dom",
  capienza_bauletto: "Capienza bauletto (pz)",
  pizze_ogni_15_min: "Pizze / 15 min",
  consegne_ogni_min: "Consegne ogni (min)",
  ritiro_ogni_min: "Ritiro ogni (min)",
  tempo_preparazione_pizza: "Prep. pizza (min)",
  velocita_pony_kmh: "Velocità pony (km/h)",
  soglia_giallo_pizze: "Soglia giallo",
  pizzaiolo_ordini_visibili_minuti: "Ordini visibili (min)",
  pizzaiolo_partenza_consegne_minuti: "Pronte in forno (min)",
  pizzaiolo_tempo_viaggio_minuti: "Viaggio consegna (min)",
}

function readOperativeSlice(raw) {
  const r = raw && typeof raw === "object" ? raw : {}
  return {
    pony_lun_gio: r.pony_lun_gio !== undefined && r.pony_lun_gio !== "" ? r.pony_lun_gio : (r.pony_consegna ?? ""),
    pony_ven_dom: r.pony_ven_dom !== undefined && r.pony_ven_dom !== "" ? r.pony_ven_dom : "",
    capienza_bauletto: r.capienza_bauletto !== undefined && r.capienza_bauletto !== "" ? r.capienza_bauletto : "12",
    pizze_ogni_15_min: r.pizze_ogni_15_min !== undefined && r.pizze_ogni_15_min !== "" ? r.pizze_ogni_15_min : (r.pizze_ogni_min ?? ""),
    consegne_ogni_min: r.consegne_ogni_min ?? "",
    ritiro_ogni_min: r.ritiro_ogni_min ?? "",
    tempo_preparazione_pizza: r.tempo_preparazione_pizza ?? "",
    velocita_pony_kmh: r.velocita_pony_kmh ?? "",
    soglia_giallo_pizze: r.soglia_giallo_pizze ?? "10",
    pizzaiolo_ordini_visibili_minuti: r.pizzaiolo_ordini_visibili_minuti ?? "45",
    pizzaiolo_partenza_consegne_minuti: r.pizzaiolo_partenza_consegne_minuti ?? "10",
    pizzaiolo_tempo_viaggio_minuti: r.pizzaiolo_tempo_viaggio_minuti ?? "10",
  }
}

function toNumberPayload(p) {
  return {
    pony_lun_gio: p.pony_lun_gio === "" ? 0 : Number(p.pony_lun_gio) || 0,
    pony_ven_dom: p.pony_ven_dom === "" ? 0 : Number(p.pony_ven_dom) || 0,
    capienza_bauletto:
      p.capienza_bauletto === "" ? 12 : Math.min(99, Math.max(1, Number(p.capienza_bauletto) || 12)),
    pizze_ogni_15_min: p.pizze_ogni_15_min === "" ? 0 : Number(p.pizze_ogni_15_min) || 0,
    consegne_ogni_min: p.consegne_ogni_min === "" ? 0 : Number(p.consegne_ogni_min) || 0,
    ritiro_ogni_min: p.ritiro_ogni_min === "" ? 0 : Number(p.ritiro_ogni_min) || 0,
    tempo_preparazione_pizza: p.tempo_preparazione_pizza === "" ? 0 : Number(p.tempo_preparazione_pizza) || 0,
    velocita_pony_kmh: p.velocita_pony_kmh === "" ? 0 : Number(p.velocita_pony_kmh) || 0,
    soglia_giallo_pizze: p.soglia_giallo_pizze === "" ? 10 : Number(p.soglia_giallo_pizze) || 10,
    pizzaiolo_ordini_visibili_minuti:
      p.pizzaiolo_ordini_visibili_minuti === "" ? 45 : Number(p.pizzaiolo_ordini_visibili_minuti) || 45,
    pizzaiolo_partenza_consegne_minuti:
      p.pizzaiolo_partenza_consegne_minuti === "" ? 10 : Number(p.pizzaiolo_partenza_consegne_minuti) || 10,
    pizzaiolo_tempo_viaggio_minuti:
      p.pizzaiolo_tempo_viaggio_minuti === "" ? 10 : Number(p.pizzaiolo_tempo_viaggio_minuti) || 10,
  }
}

function diffChanges(before, after) {
  const changes = {}
  for (const key of OPERATIVE_KEYS) {
    const a = before[key]
    const b = after[key]
    if (String(a) !== String(b)) {
      changes[key] = { da: a, a: b, label: LABELS[key] || key }
    }
  }
  return changes
}

/**
 * Impostazioni cassa per operatore: solo capacità/tempi operativi + audit (CA-10/11/12).
 */
export default function CassaImpostazioniPage({ onBack }) {
  const location = useLocation()
  const { tenantId, refreshTenant } = useTenant()
  const [settings, setSettings] = useState(null)
  const [form, setForm] = useState(() => readOperativeSlice({}))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [auditRows, setAuditRows] = useState([])

  const loadAudit = useCallback(async () => {
    if (!tenantId) return
    try {
      const rows = await listCassaAuditEvents(tenantId, {
        eventType: "parametri_cassa_operatore",
        limit: 12,
      })
      setAuditRows(Array.isArray(rows) ? rows : [])
    } catch {
      setAuditRows([])
    }
  }, [tenantId])

  useEffect(() => {
    if (!tenantId) return
    let cancelled = false
    async function load() {
      try {
        setLoading(true)
        const data = await getTenantSettings(tenantId)
        if (cancelled) return
        setSettings(data || {})
        setForm(readOperativeSlice(data?.parametri_operativi))
        await loadAudit()
      } catch (err) {
        console.error(err)
        if (!cancelled) {
          setSettings({})
          setForm(readOperativeSlice({}))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [tenantId, loadAudit])

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    if (!tenantId || !settings) return
    try {
      setSaving(true)
      const before = toNumberPayload(readOperativeSlice(settings?.parametri_operativi))
      const patch = toNumberPayload(form)
      const changes = diffChanges(before, patch)
      const payload = {
        ...(settings?.parametri_operativi || {}),
        ...patch,
      }
      await updateTenantSettings(tenantId, { parametri_operativi: payload })
      setSettings({ ...settings, parametri_operativi: payload })
      setForm(readOperativeSlice(payload))
      if (refreshTenant) await refreshTenant()
      if (Object.keys(changes).length > 0) {
        await logCassaAuditEvent(tenantId, {
          ordineId: null,
          eventType: "parametri_cassa_operatore",
          payload: {
            source: "cassa_impostazioni",
            changes,
            keys: Object.keys(changes),
          },
        })
        await loadAudit()
      }
      alert(
        Object.keys(changes).length > 0
          ? "Parametri salvati. Modifica registrata nel report audit."
          : "Parametri salvati (nessuna variazione).",
      )
    } catch (err) {
      console.error(err)
      alert("Errore durante il salvataggio. " + (err?.message || ""))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: "center" }}>
        Caricamento...
      </div>
    )
  }

  const inputStyle = { marginTop: 6, padding: "8px 10px", width: "100%", boxSizing: "border-box" }
  const adminStampa = withPreservedSupportSearch("/admin/settings/stampa-operativa", location.search)
  const adminPay = withPreservedSupportSearch("/admin/settings/pagamenti-online", location.search)

  return (
    <div style={styles.wrapper}>
      <div style={styles.header}>
        <button type="button" style={styles.backBtn} onClick={onBack}>
          ← Indietro
        </button>
        <h1 style={styles.title}>Parametri operativi cassa</h1>
        <p style={{ margin: "8px 0 0", fontSize: 13, color: "#555", lineHeight: 1.45, maxWidth: 640 }}>
          Solo i valori usati in sala (pony, capacità, tempi). Catalogo pagamenti e flusso stampa sono in{" "}
          <strong>Admin → Impostazioni</strong>.
        </p>
      </div>

      <div className="cassa-impostazioni-grid" style={styles.twoColGrid}>
      <section style={styles.section}>
          <h3 style={{ margin: "0 0 12px", fontSize: 16 }}>Capacità e slot</h3>
        <div style={styles.fields}>
          <label>
            Pony disponibili (lun–gio)
              <input
                type="number"
                min={0}
                placeholder="es. 2"
                value={form.pony_lun_gio === "" ? "" : form.pony_lun_gio}
                onChange={(e) => setField("pony_lun_gio", e.target.value === "" ? "" : e.target.value)}
                style={inputStyle}
              />
          </label>
          <label>
            Pony disponibili (ven–dom)
              <input
                type="number"
                min={0}
                placeholder="es. 3"
                value={form.pony_ven_dom === "" ? "" : form.pony_ven_dom}
                onChange={(e) => setField("pony_ven_dom", e.target.value === "" ? "" : e.target.value)}
                style={inputStyle}
              />
          </label>
          <label>
            Capienza bauletto (pizze / giro)
              <input
                type="number"
                min={1}
                max={99}
                placeholder="es. 12"
                value={form.capienza_bauletto === "" ? "" : form.capienza_bauletto}
                onChange={(e) => setField("capienza_bauletto", e.target.value === "" ? "" : e.target.value)}
                style={inputStyle}
              />
          </label>
          <label>
            Pizze ogni 15 minuti
              <input
                type="number"
                min={1}
                placeholder="es. 8"
                value={form.pizze_ogni_15_min === "" ? "" : form.pizze_ogni_15_min}
                onChange={(e) => setField("pizze_ogni_15_min", e.target.value === "" ? "" : e.target.value)}
                style={inputStyle}
              />
          </label>
          <label>
            Consegne ogni (min)
              <input
                type="number"
                min={1}
                placeholder="es. 15"
                value={form.consegne_ogni_min === "" ? "" : form.consegne_ogni_min}
                onChange={(e) => setField("consegne_ogni_min", e.target.value === "" ? "" : e.target.value)}
                style={inputStyle}
              />
          </label>
          <label>
            Ritiro in negozio ogni (min)
              <input
                type="number"
                min={1}
                placeholder="es. 15"
                value={form.ritiro_ogni_min === "" ? "" : form.ritiro_ogni_min}
                onChange={(e) => setField("ritiro_ogni_min", e.target.value === "" ? "" : e.target.value)}
                style={inputStyle}
              />
          </label>
          <label>
            Tempo preparazione pizza (min)
              <input
                type="number"
                min={1}
                placeholder="es. 5"
                value={form.tempo_preparazione_pizza === "" ? "" : form.tempo_preparazione_pizza}
                onChange={(e) => setField("tempo_preparazione_pizza", e.target.value === "" ? "" : e.target.value)}
                style={inputStyle}
              />
          </label>
          <label>
            Velocità pony (km/h)
              <input
                type="number"
                min={1}
                step={0.5}
                placeholder="es. 25"
                value={form.velocita_pony_kmh === "" ? "" : form.velocita_pony_kmh}
                onChange={(e) => setField("velocita_pony_kmh", e.target.value === "" ? "" : e.target.value)}
                style={inputStyle}
              />
          </label>
          <label>
            Soglia giallo (pizze)
              <input
                type="number"
                min={0}
                placeholder="es. 10"
                value={form.soglia_giallo_pizze === "" ? "" : form.soglia_giallo_pizze}
                onChange={(e) => setField("soglia_giallo_pizze", e.target.value === "" ? "" : e.target.value)}
                style={inputStyle}
              />
          </label>
        </div>
      </section>
      <div className="cassa-impostazioni-right" style={styles.rightCol}>
      <section style={styles.section}>
        <h3 style={{ margin: "0 0 12px", fontSize: 16 }}>Pizzaiolo e consegne</h3>
        <div style={styles.fields}>
          <label>
            Ordini visibili (minuti prima dell&apos;orario)
              <input
                type="number"
                min={15}
                placeholder="45"
                value={form.pizzaiolo_ordini_visibili_minuti === "" ? "" : form.pizzaiolo_ordini_visibili_minuti}
                onChange={(e) =>
                  setField("pizzaiolo_ordini_visibili_minuti", e.target.value === "" ? "" : e.target.value)
                }
                style={inputStyle}
              />
          </label>
          <label>
              Pronte in forno (minuti prima della consegna)
              <input
                type="number"
                min={5}
                placeholder="10"
                value={
                  form.pizzaiolo_partenza_consegne_minuti === "" ? "" : form.pizzaiolo_partenza_consegne_minuti
                }
                onChange={(e) =>
                  setField("pizzaiolo_partenza_consegne_minuti", e.target.value === "" ? "" : e.target.value)
                }
                style={inputStyle}
              />
              <span style={{ display: "block", fontSize: 12, color: "#666", marginTop: 4, fontWeight: 400 }}>
                Es. consegna 19:15 → pizze pronte entro 19:05 se valore 10.
              </span>
          </label>
          <label>
            Tempo viaggio consegna (minuti)
              <input
                type="number"
                min={5}
                placeholder="10"
                value={form.pizzaiolo_tempo_viaggio_minuti === "" ? "" : form.pizzaiolo_tempo_viaggio_minuti}
                onChange={(e) =>
                  setField("pizzaiolo_tempo_viaggio_minuti", e.target.value === "" ? "" : e.target.value)
                }
                style={inputStyle}
              />
          </label>
        </div>
      </section>

      <section style={{ ...styles.section, background: "#f8fafc" }}>
        <h3 style={{ margin: "0 0 8px", fontSize: 15 }}>Configurazioni admin (non in cassa)</h3>
        <p style={{ margin: "0 0 10px", fontSize: 13, color: "#475569", lineHeight: 1.45 }}>
          Per catalogo sistemi di pagamento e flusso stampa / layout comanda apri l’area gestore.
        </p>
        <p style={{ margin: 0, fontSize: 13 }}>
          <Link to={adminPay} style={{ color: "#1565c0", fontWeight: 600 }}>
            Pagamenti online e catalogo sistemi
          </Link>
          {" · "}
          <Link to={adminStampa} style={{ color: "#1565c0", fontWeight: 600 }}>
            Stampa operativa
          </Link>
        </p>
      </section>

      <section style={styles.section}>
        <h3 style={{ margin: "0 0 8px", fontSize: 15 }}>Report modifiche operatore</h3>
        <p style={{ margin: "0 0 12px", fontSize: 12, color: "#64748b" }}>
          Ogni salvataggio con variazioni viene scritto nell’audit cassa del locale.
        </p>
        {auditRows.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: "#94a3b8" }}>Nessuna modifica parametri registrata ancora.</p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            {auditRows.map((row) => {
              const keys = Array.isArray(row?.payload?.keys) ? row.payload.keys : Object.keys(row?.payload?.changes || {})
              const when = row.created_at ? new Date(row.created_at).toLocaleString("it-IT") : "—"
              return (
                <li
                  key={row.id}
                  style={{
                    fontSize: 13,
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
                    background: "#fff",
                  }}
                >
                  <strong>{when}</strong>
                  <span style={{ color: "#64748b" }}>
                    {" — "}
                    {keys.map((k) => LABELS[k] || k).join(", ") || "parametri"}
                    </span>
                </li>
              )
            })}
          </ul>
        )}
      </section>
      </div>
      </div>

      <div style={styles.actions}>
        <button type="button" style={styles.saveBtn} onClick={handleSave} disabled={saving}>
          {saving ? "Salvataggio..." : "Salva"}
        </button>
      </div>
    </div>
  )
}

const styles = {
  wrapper: { padding: 20, maxWidth: "none", width: "100%", margin: 0, boxSizing: "border-box" },
  header: { marginBottom: 20 },
  backBtn: {
    padding: "8px 14px",
    marginBottom: 12,
    background: "#f0f0f0",
    border: "1px solid #ccc",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 14,
  },
  title: { margin: 0, fontSize: 20, fontWeight: 600 },
  section: { background: "#fff", border: "1px solid #e0e0e0", borderRadius: 8, padding: 20, marginBottom: 16 },
  fields: { display: "flex", flexDirection: "column", gap: 20 },
  twoColGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: 16,
    marginBottom: 16,
    alignItems: "start",
  },
  rightCol: {
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
  },
  actions: { marginTop: 8 },
  saveBtn: {
    padding: "10px 20px",
    background: "#2e7d32",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 600,
  },
}
