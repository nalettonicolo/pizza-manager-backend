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
  comanda_titolo_scale: "1.12",
  comanda_qty_scale: "1",
  comanda_dettaglio_scale: "0.95",
  comanda_line_height: "1.35",
  comanda_margin_mm: "8",
  comanda_width_mm: "0",
  comanda_font_family: "system",
  comanda_mostra_locale: true,
  comanda_mostra_banner_comanda: true,
  comanda_mostra_data_ora_stampa: true,
  comanda_mostra_numero_ordine: true,
  comanda_mostra_tipo_servizio: true,
  comanda_mostra_cliente: true,
  comanda_mostra_orario: true,
  comanda_mostra_indirizzo: true,
  comanda_mostra_note_ordine: true,
  comanda_mostra_id_ordine: true,
  comanda_mostra_pagamento: true,
  comanda_mostra_dest_stampanti: true,
  comanda_mostra_riga_impasto: true,
  comanda_mostra_riga_cottura: true,
  comanda_mostra_riga_ingredienti: true,
  comanda_stampanti: "",
  comanda_stampa_auto: false,
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
        comanda_font_size: p.comanda_font_size === "" ? 13 : Math.max(8, Math.min(28, Number(p.comanda_font_size) || 13)),
        comanda_titolo_scale:
          p.comanda_titolo_scale === "" ? 1.12 : Math.max(0.85, Math.min(1.6, Number(p.comanda_titolo_scale) || 1.12)),
        comanda_qty_scale:
          p.comanda_qty_scale === "" ? 1 : Math.max(0.85, Math.min(1.5, Number(p.comanda_qty_scale) || 1)),
        comanda_dettaglio_scale:
          p.comanda_dettaglio_scale === ""
            ? 0.95
            : Math.max(0.75, Math.min(1.15, Number(p.comanda_dettaglio_scale) || 0.95)),
        comanda_line_height:
          p.comanda_line_height === "" ? 1.35 : Math.max(1.05, Math.min(1.9, Number(p.comanda_line_height) || 1.35)),
        comanda_margin_mm:
          p.comanda_margin_mm === "" ? 8 : Math.max(2, Math.min(24, Number(p.comanda_margin_mm) || 8)),
        comanda_width_mm:
          p.comanda_width_mm === "" ? 0 : Math.max(0, Math.min(120, Number(p.comanda_width_mm) || 0)),
        comanda_font_family: ["system", "sans", "mono", "serif"].includes(p.comanda_font_family)
          ? p.comanda_font_family
          : "system",
        comanda_mostra_locale: Boolean(p.comanda_mostra_locale),
        comanda_mostra_banner_comanda: Boolean(p.comanda_mostra_banner_comanda),
        comanda_mostra_data_ora_stampa: Boolean(p.comanda_mostra_data_ora_stampa),
        comanda_mostra_numero_ordine: Boolean(p.comanda_mostra_numero_ordine),
        comanda_mostra_tipo_servizio: Boolean(p.comanda_mostra_tipo_servizio),
        comanda_mostra_cliente: Boolean(p.comanda_mostra_cliente),
        comanda_mostra_orario: Boolean(p.comanda_mostra_orario),
        comanda_mostra_indirizzo: Boolean(p.comanda_mostra_indirizzo),
        comanda_mostra_note_ordine: Boolean(p.comanda_mostra_note_ordine),
        comanda_mostra_id_ordine: Boolean(p.comanda_mostra_id_ordine),
        comanda_mostra_pagamento: Boolean(p.comanda_mostra_pagamento),
        comanda_mostra_dest_stampanti: Boolean(p.comanda_mostra_dest_stampanti),
        comanda_mostra_riga_impasto: Boolean(p.comanda_mostra_riga_impasto),
        comanda_mostra_riga_cottura: Boolean(p.comanda_mostra_riga_cottura),
        comanda_mostra_riga_ingredienti: Boolean(p.comanda_mostra_riga_ingredienti),
        comanda_stampanti: String(p.comanda_stampanti || "")
          .split(/\r?\n|,/)
          .map((v) => v.trim())
          .filter(Boolean),
        comanda_stampa_auto: Boolean(p.comanda_stampa_auto),
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
        <h3 style={{ margin: "0 0 12px", fontSize: 16 }}>Comanda — stampa</h3>
        <p style={{ margin: "0 0 16px", fontSize: 13, color: "#555", lineHeight: 1.45 }}>
          Regola testo e pagina per stampante termica o PDF. Le anteprime dipendono dal browser; per 80 mm usa larghezza ~72 mm e margini bassi.
        </p>
        <div style={styles.fields}>
          <label>
            Numero copie comanda
            <input type="number" min={1} max={5} placeholder="es. 1" value={p.comanda_copie === "" ? "" : p.comanda_copie} onChange={(e) => setParam("comanda_copie", e.target.value === "" ? "" : e.target.value)} style={inputStyle} />
          </label>
          <label>
            Dimensione testo corpo (px)
            <input type="number" min={8} max={28} placeholder="es. 13" value={p.comanda_font_size === "" ? "" : p.comanda_font_size} onChange={(e) => setParam("comanda_font_size", e.target.value === "" ? "" : e.target.value)} style={inputStyle} />
          </label>
          <label>
            Scala titolo «COMANDA» (× testo corpo, es. 1.12)
            <input type="number" min={0.85} max={1.6} step={0.01} placeholder="1.12" value={p.comanda_titolo_scale === "" ? "" : p.comanda_titolo_scale} onChange={(e) => setParam("comanda_titolo_scale", e.target.value === "" ? "" : e.target.value)} style={inputStyle} />
          </label>
          <label>
            Scala quantità (× corpo, es. 1)
            <input type="number" min={0.85} max={1.5} step={0.01} placeholder="1" value={p.comanda_qty_scale === "" ? "" : p.comanda_qty_scale} onChange={(e) => setParam("comanda_qty_scale", e.target.value === "" ? "" : e.target.value)} style={inputStyle} />
          </label>
          <label>
            Scala dettagli righe (ingredienti, × corpo)
            <input type="number" min={0.75} max={1.15} step={0.01} placeholder="0.95" value={p.comanda_dettaglio_scale === "" ? "" : p.comanda_dettaglio_scale} onChange={(e) => setParam("comanda_dettaglio_scale", e.target.value === "" ? "" : e.target.value)} style={inputStyle} />
          </label>
          <label>
            Interlinea (righe)
            <input type="number" min={1.05} max={1.9} step={0.05} placeholder="1.35" value={p.comanda_line_height === "" ? "" : p.comanda_line_height} onChange={(e) => setParam("comanda_line_height", e.target.value === "" ? "" : e.target.value)} style={inputStyle} />
          </label>
          <label>
            Famiglia carattere
            <select value={p.comanda_font_family || "system"} onChange={(e) => setParam("comanda_font_family", e.target.value)} style={inputStyle}>
              <option value="system">Sistema (consigliato)</option>
              <option value="sans">Sans (Arial / simile)</option>
              <option value="mono">Monospazio (termica)</option>
              <option value="serif">Serif</option>
            </select>
          </label>
          <label>
            Margini pagina stampa (mm, tutti i lati)
            <input type="number" min={2} max={24} placeholder="8" value={p.comanda_margin_mm === "" ? "" : p.comanda_margin_mm} onChange={(e) => setParam("comanda_margin_mm", e.target.value === "" ? "" : e.target.value)} style={inputStyle} />
          </label>
          <label>
            Larghezza massima contenuto (mm, 0 = tutta la pagina)
            <input type="number" min={0} max={120} placeholder="0 o 72 per 80mm" value={p.comanda_width_mm === "" ? "" : p.comanda_width_mm} onChange={(e) => setParam("comanda_width_mm", e.target.value === "" ? "" : e.target.value)} style={inputStyle} />
          </label>
          <label>
            Stampanti / reparti (testo su comanda, una per riga o virgole)
            <textarea rows={3} placeholder="es. Cucina, Bancone" value={p.comanda_stampanti || ""} onChange={(e) => setParam("comanda_stampanti", e.target.value)} style={{ ...inputStyle, resize: "vertical", minHeight: 84 }} />
          </label>
          <fieldset style={{ border: "1px solid #e0e0e0", borderRadius: 8, padding: "12px 14px", margin: 0 }}>
            <legend style={{ fontSize: 13, fontWeight: 600, padding: "0 6px" }}>Cosa includere in stampa</legend>
            <p style={{ margin: "0 0 10px", fontSize: 12, color: "#666", lineHeight: 1.4 }}>Intestazione</p>
            {[
              ["comanda_mostra_locale", "Nome locale"],
              ["comanda_mostra_banner_comanda", "Titolo «COMANDA CUCINA»"],
              ["comanda_mostra_data_ora_stampa", "Data e ora (in alto)"],
              ["comanda_mostra_numero_ordine", "Numero ordine (#…)"],
              ["comanda_mostra_tipo_servizio", "Tipo servizio (ritiro / consegna)"],
              ["comanda_mostra_cliente", "Nome cliente"],
              ["comanda_mostra_orario", "Orario ritiro / consegna"],
              ["comanda_mostra_indirizzo", "Indirizzo consegna"],
              ["comanda_mostra_note_ordine", "Note ordine"],
              ["comanda_mostra_id_ordine", "ID ordine (UUID)"],
              ["comanda_mostra_pagamento", "Tipo pagamento"],
              ["comanda_mostra_dest_stampanti", "Riga «Dest. stampa»"],
            ].map(([key, label]) => (
              <label key={key} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", marginBottom: 10 }}>
                <input type="checkbox" checked={Boolean(p[key])} onChange={(e) => setParam(key, e.target.checked)} />
                <span>{label}</span>
              </label>
            ))}
            <p style={{ margin: "14px 0 10px", fontSize: 12, color: "#666", lineHeight: 1.4 }}>Sotto ogni prodotto</p>
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", marginBottom: 10 }}>
              <input type="checkbox" checked={Boolean(p.comanda_mostra_riga_impasto)} onChange={(e) => setParam("comanda_mostra_riga_impasto", e.target.checked)} />
              <span>Riga impasto</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", marginBottom: 10 }}>
              <input type="checkbox" checked={Boolean(p.comanda_mostra_riga_cottura)} onChange={(e) => setParam("comanda_mostra_riga_cottura", e.target.checked)} />
              <span>Riga cottura (tipo pizza)</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", marginBottom: 0 }}>
              <input type="checkbox" checked={Boolean(p.comanda_mostra_riga_ingredienti)} onChange={(e) => setParam("comanda_mostra_riga_ingredienti", e.target.checked)} />
              <span>Riga ingredienti (base + varianti e aggiunte)</span>
            </label>
          </fieldset>
          <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={Boolean(p.comanda_stampa_auto)}
              onChange={(e) => setParam("comanda_stampa_auto", e.target.checked)}
              style={{ marginTop: 4 }}
            />
            <span>
              Stampa comanda automaticamente dopo la conferma ordine
              <span style={{ display: "block", fontSize: 12, color: "#666", fontWeight: 400, marginTop: 4 }}>
                Si apre la finestra di stampa del browser (scegli stampante termica o PDF). Se disattivato, compare un avviso con pulsante «Stampa comanda».
              </span>
            </span>
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
  wrapper: { padding: 20, maxWidth: 560 },
  header: { marginBottom: 20 },
  backBtn: { padding: "8px 14px", marginBottom: 12, background: "#f0f0f0", border: "1px solid #ccc", borderRadius: 8, cursor: "pointer", fontSize: 14 },
  title: { margin: 0, fontSize: 20, fontWeight: 600 },
  section: { background: "#fff", border: "1px solid #e0e0e0", borderRadius: 8, padding: 20, marginBottom: 16 },
  fields: { display: "flex", flexDirection: "column", gap: 20 },
  actions: { marginTop: 16 },
  saveBtn: { padding: "10px 20px", background: "#2e7d32", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: 600 },
}
