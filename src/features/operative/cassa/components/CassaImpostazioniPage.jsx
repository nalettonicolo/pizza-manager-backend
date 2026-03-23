import { useState, useEffect } from "react"
import { useTenant } from "@/app/contexts/TenantContext"
import { getTenantSettings, updateTenantSettings } from "@/features/admin/services/adminService"

const defaultParametri = () => ({
  pony_lun_gio: "",
  pony_ven_dom: "",
  pizze_ogni_15_min: "",
  consegne_ogni_min: "",
  ritiro_ogni_min: "",
  tempo_preparazione_pizza: "",
  velocita_pony_kmh: "",
  soglia_giallo_pizze: "10",
  pizzaiolo_ordini_visibili_minuti: "45",
  pizzaiolo_partenza_consegne_minuti: "30",
  pizzaiolo_tempo_viaggio_minuti: "15",
  comanda_copie: "1",
  comanda_font_size: "13",
  comanda_stampanti: "",
})

export default function CassaImpostazioniPage({ onBack }) {
  const { tenantId } = useTenant()
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const raw = settings?.parametri_operativi && typeof settings.parametri_operativi === "object"
    ? settings.parametri_operativi
    : {}
  const p = {
    ...defaultParametri(),
    ...raw,
    pony_lun_gio: raw.pony_lun_gio !== undefined && raw.pony_lun_gio !== "" ? raw.pony_lun_gio : (raw.pony_consegna ?? ""),
    pony_ven_dom: raw.pony_ven_dom !== undefined && raw.pony_ven_dom !== "" ? raw.pony_ven_dom : "",
    pizze_ogni_15_min: raw.pizze_ogni_15_min !== undefined && raw.pizze_ogni_15_min !== "" ? raw.pizze_ogni_15_min : (raw.pizze_ogni_min ?? ""),
    comanda_stampanti: Array.isArray(raw.comanda_stampanti) ? raw.comanda_stampanti.join(", ") : (raw.comanda_stampanti ?? ""),
  }

  useEffect(() => {
    if (!tenantId) return
    let cancelled = false
    async function load() {
      try {
        setLoading(true)
        const data = await getTenantSettings(tenantId)
        if (!cancelled) setSettings(data || {})
      } catch (err) {
        console.error(err)
        if (!cancelled) setSettings({})
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [tenantId])

  const setParam = (key, value) => {
    setSettings({
      ...settings,
      parametri_operativi: { ...(settings?.parametri_operativi || {}), [key]: value },
    })
  }

  async function handleSave() {
    if (!tenantId || !settings) return
    try {
      setSaving(true)
      const payload = {
        ...(settings?.parametri_operativi || {}),
        pony_lun_gio: p.pony_lun_gio === "" ? 0 : Number(p.pony_lun_gio) || 0,
        pony_ven_dom: p.pony_ven_dom === "" ? 0 : Number(p.pony_ven_dom) || 0,
        pizze_ogni_15_min: p.pizze_ogni_15_min === "" ? 0 : Number(p.pizze_ogni_15_min) || 0,
        consegne_ogni_min: p.consegne_ogni_min === "" ? 0 : Number(p.consegne_ogni_min) || 0,
        ritiro_ogni_min: p.ritiro_ogni_min === "" ? 0 : Number(p.ritiro_ogni_min) || 0,
        tempo_preparazione_pizza: p.tempo_preparazione_pizza === "" ? 0 : Number(p.tempo_preparazione_pizza) || 0,
        velocita_pony_kmh: p.velocita_pony_kmh === "" ? 0 : Number(p.velocita_pony_kmh) || 0,
        soglia_giallo_pizze: p.soglia_giallo_pizze === "" ? 10 : Number(p.soglia_giallo_pizze) || 10,
        pizzaiolo_ordini_visibili_minuti: p.pizzaiolo_ordini_visibili_minuti === "" ? 45 : Number(p.pizzaiolo_ordini_visibili_minuti) || 45,
        pizzaiolo_partenza_consegne_minuti: p.pizzaiolo_partenza_consegne_minuti === "" ? 30 : Number(p.pizzaiolo_partenza_consegne_minuti) || 30,
        pizzaiolo_tempo_viaggio_minuti: p.pizzaiolo_tempo_viaggio_minuti === "" ? 15 : Number(p.pizzaiolo_tempo_viaggio_minuti) || 15,
        comanda_copie: p.comanda_copie === "" ? 1 : Math.max(1, Number(p.comanda_copie) || 1),
        comanda_font_size: p.comanda_font_size === "" ? 13 : Math.max(9, Number(p.comanda_font_size) || 13),
        comanda_stampanti: String(p.comanda_stampanti || "")
          .split(/\r?\n|,/)
          .map((v) => v.trim())
          .filter(Boolean),
      }
      await updateTenantSettings(tenantId, { parametri_operativi: payload })
      setSettings({ ...settings, parametri_operativi: payload })
      alert("Parametri salvati.")
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
  return (
    <div style={styles.wrapper}>
      <div style={styles.header}>
        <button type="button" style={styles.backBtn} onClick={onBack}>
          ← Indietro
        </button>
        <h1 style={styles.title}>Impostazioni cassa</h1>
      </div>
      <section style={styles.section}>
        <div style={styles.fields}>
          <label>
            Pony disponibili (lun–gio)
            <input type="number" min={0} placeholder="es. 2" value={p.pony_lun_gio === "" ? "" : p.pony_lun_gio} onChange={(e) => setParam("pony_lun_gio", e.target.value === "" ? "" : e.target.value)} style={inputStyle} />
          </label>
          <label>
            Pony disponibili (ven–dom)
            <input type="number" min={0} placeholder="es. 3" value={p.pony_ven_dom === "" ? "" : p.pony_ven_dom} onChange={(e) => setParam("pony_ven_dom", e.target.value === "" ? "" : e.target.value)} style={inputStyle} />
          </label>
          <label>
            Pizze ogni 15 minuti
            <input type="number" min={1} placeholder="es. 8" value={p.pizze_ogni_15_min === "" ? "" : p.pizze_ogni_15_min} onChange={(e) => setParam("pizze_ogni_15_min", e.target.value === "" ? "" : e.target.value)} style={inputStyle} />
          </label>
          <label>
            Consegne ogni (min)
            <input type="number" min={1} placeholder="es. 15" value={p.consegne_ogni_min === "" ? "" : p.consegne_ogni_min} onChange={(e) => setParam("consegne_ogni_min", e.target.value === "" ? "" : e.target.value)} style={inputStyle} />
          </label>
          <label>
            Ritiro in negozio ogni (min)
            <input type="number" min={1} placeholder="es. 5" value={p.ritiro_ogni_min === "" ? "" : p.ritiro_ogni_min} onChange={(e) => setParam("ritiro_ogni_min", e.target.value === "" ? "" : e.target.value)} style={inputStyle} />
          </label>
          <label>
            Tempo preparazione pizza (min)
            <input type="number" min={1} placeholder="es. 5" value={p.tempo_preparazione_pizza === "" ? "" : p.tempo_preparazione_pizza} onChange={(e) => setParam("tempo_preparazione_pizza", e.target.value === "" ? "" : e.target.value)} style={inputStyle} />
          </label>
          <label>
            Velocità pony (km/h)
            <input type="number" min={1} step={0.5} placeholder="es. 25" value={p.velocita_pony_kmh === "" ? "" : p.velocita_pony_kmh} onChange={(e) => setParam("velocita_pony_kmh", e.target.value === "" ? "" : e.target.value)} style={inputStyle} />
          </label>
          <label>
            Soglia giallo (pizze)
            <input type="number" min={0} placeholder="es. 10" value={p.soglia_giallo_pizze === "" ? "" : p.soglia_giallo_pizze} onChange={(e) => setParam("soglia_giallo_pizze", e.target.value === "" ? "" : e.target.value)} style={inputStyle} />
          </label>
        </div>
      </section>
      <section style={styles.section}>
        <h3 style={{ margin: "0 0 12px", fontSize: 16 }}>Pizzaiolo e consegne</h3>
        <div style={styles.fields}>
          <label>
            Ordini visibili (minuti prima dell&apos;orario)
            <input type="number" min={15} placeholder="45" value={p.pizzaiolo_ordini_visibili_minuti === "" ? "" : p.pizzaiolo_ordini_visibili_minuti} onChange={(e) => setParam("pizzaiolo_ordini_visibili_minuti", e.target.value === "" ? "" : e.target.value)} style={inputStyle} />
          </label>
          <label>
            Partenza consegne (minuti prima dell&apos;orario)
            <input type="number" min={5} placeholder="30" value={p.pizzaiolo_partenza_consegne_minuti === "" ? "" : p.pizzaiolo_partenza_consegne_minuti} onChange={(e) => setParam("pizzaiolo_partenza_consegne_minuti", e.target.value === "" ? "" : e.target.value)} style={inputStyle} />
          </label>
          <label>
            Tempo viaggio consegna (minuti)
            <input type="number" min={5} placeholder="15" value={p.pizzaiolo_tempo_viaggio_minuti === "" ? "" : p.pizzaiolo_tempo_viaggio_minuti} onChange={(e) => setParam("pizzaiolo_tempo_viaggio_minuti", e.target.value === "" ? "" : e.target.value)} style={inputStyle} />
          </label>
        </div>
      </section>
      <section style={styles.section}>
        <h3 style={{ margin: "0 0 12px", fontSize: 16 }}>Comanda</h3>
        <div style={styles.fields}>
          <label>
            Numero copie comanda
            <input type="number" min={1} placeholder="es. 1" value={p.comanda_copie === "" ? "" : p.comanda_copie} onChange={(e) => setParam("comanda_copie", e.target.value === "" ? "" : e.target.value)} style={inputStyle} />
          </label>
          <label>
            Dimensione carattere comanda
            <input type="number" min={9} max={24} placeholder="es. 13" value={p.comanda_font_size === "" ? "" : p.comanda_font_size} onChange={(e) => setParam("comanda_font_size", e.target.value === "" ? "" : e.target.value)} style={inputStyle} />
          </label>
          <label>
            Stampanti comanda (una per riga o separate da virgola)
            <textarea rows={3} placeholder="es. Cucina, Bancone" value={p.comanda_stampanti || ""} onChange={(e) => setParam("comanda_stampanti", e.target.value)} style={{ ...inputStyle, resize: "vertical", minHeight: 84 }} />
          </label>
        </div>
      </section>
      <div style={styles.actions}>
        <button type="button" style={styles.saveBtn} onClick={handleSave} disabled={saving}>
          {saving ? "Salvataggio..." : "Salva"}
        </button>
      </div>
    </div>
  )
}

const styles = {
  wrapper: { padding: 20, maxWidth: 480 },
  header: { marginBottom: 20 },
  backBtn: { padding: "8px 14px", marginBottom: 12, background: "#f0f0f0", border: "1px solid #ccc", borderRadius: 8, cursor: "pointer", fontSize: 14 },
  title: { margin: 0, fontSize: 20, fontWeight: 600 },
  section: { background: "#fff", border: "1px solid #e0e0e0", borderRadius: 8, padding: 20, marginBottom: 16 },
  fields: { display: "flex", flexDirection: "column", gap: 20 },
  actions: { marginTop: 16 },
  saveBtn: { padding: "10px 20px", background: "#2e7d32", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: 600 },
}
