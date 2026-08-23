import { useState, useMemo } from "react"
import { Link, useLocation, useOutletContext } from "react-router-dom"
import { withPreservedSupportSearch } from "@/utils/supportTenantOverride"
import { useTenant } from "@/app/contexts/TenantContext"
import { updateTenantSettings } from "@/features/admin/services/adminService"
import SettingsSectionHeader from "@/features/admin/components/SettingsSectionHeader"
import {
  COMANDA_ETICHETTE_DEFAULT,
  normalizeComandaBlocchiOrdine,
  normalizeComandaDettagliOrdine,
  buildComandaKitchenHtmlDocument,
} from "@/features/operative/cassa/utils/printComanda"
import {
  STAMPA_MODALITA_OPTIONS,
  STAMPA_QUANDO_OPTIONS,
  STAMPA_CORTESIA_REPARTI,
  readStampaModalita,
  readStampaQuando,
  readStampaRicevutaCortesiaReparto,
} from "@/utils/stampaOperativaConfig"

function FieldHint({ children, style }) {
  return (
    <p style={{ margin: "6px 0 0", fontSize: 12, color: "#555", lineHeight: 1.5, ...style }}>
      {children}
    </p>
  )
}

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
  pizzaiolo_partenza_consegne_minuti: "10",
  pizzaiolo_tempo_viaggio_minuti: "10",
  comanda_copie: "1",
  comanda_font_size: "13",
  comanda_titolo_scale: "1.12",
  comanda_qty_scale: "1",
  comanda_dettaglio_scale: "0.95",
  comanda_line_height: "1.35",
  comanda_margin_mm: "8",
  comanda_width_mm: "0",
  /** 0 = solo larghezza manuale; 58/76/80 = rotolo termico (imposta anche area foglio in stampa) */
  comanda_rotolo_mm: 0,
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
  comanda_mostra_id_ordine: false,
  comanda_mostra_pagamento: true,
  comanda_mostra_dest_stampanti: true,
  comanda_mostra_riga_impasto: true,
  comanda_mostra_riga_cottura: true,
  comanda_mostra_riga_ingredienti: true,
  comanda_stampanti: "",
  comanda_stampa_auto: false,
  /** Stampa ricevuta cliente dopo conferma (indipendente dalla comanda cucina). */
  cassa_stampa_ricevuta_auto: false,
  /** solo_cassa | con_tablet */
  stampa_modalita: "solo_cassa",
  /** Tablet dedicato Cucina (false = prep integrate nel Bancone) */
  cucina_tablet_abilitato: true,
  /** auto | manuale | mai — comanda dalla cassa */
  comanda_stampa_quando: "manuale",
  /** auto | manuale | mai — ricevuta da cassa (utile in solo_cassa) */
  cassa_stampa_ricevuta_quando: "manuale",
  /** Reparto che può stampare ricevuta di cortesia (con_tablet) */
  stampa_ricevuta_cortesia_reparto: "delivery",
  comanda_titolo_banner: "",
})

/** Metadati UI per blocchi intestazione (ordine stampa + flag visibilità). */
const COMANDA_BLOCCHI_UI = [
  { id: "banner", flag: "comanda_mostra_banner_comanda", label: "Titolo banner (centrato)", hint: "Testo grande in cima; puoi cambiarlo sotto in «Titolo personalizzato»." },
  { id: "data_stampa", flag: "comanda_mostra_data_ora_stampa", label: "Data e ora di stampa", hint: "Momento in cui avvii la stampa dal browser." },
  { id: "locale", flag: "comanda_mostra_locale", label: "Nome locale", hint: "Nome della pizzeria (tenant)." },
  { id: "numero_ordine", flag: "comanda_mostra_numero_ordine", label: "Numero ordine (#…)", hint: "Numero progressivo in cassa." },
  { id: "id_ordine", flag: "comanda_mostra_id_ordine", label: "ID ordine (UUID)", hint: "Di default spento: su termica è illeggibile. Se attivo, stampa solo i primi caratteri in nero." },
  { id: "tipo_servizio", flag: "comanda_mostra_tipo_servizio", label: "Tipo servizio", hint: "Ritiro in negozio o Consegna." },
  { id: "cliente", flag: "comanda_mostra_cliente", label: "Nome cliente", hint: "Come salvato sull’ordine." },
  { id: "orario", flag: "comanda_mostra_orario", label: "Orario ritiro / consegna", hint: "Fascia oraria scelta in cassa." },
  { id: "indirizzo", flag: "comanda_mostra_indirizzo", label: "Indirizzo consegna", hint: "Solo ordini delivery." },
  { id: "pagamento", flag: "comanda_mostra_pagamento", label: "Tipo pagamento", hint: "Contanti, carta, da pagare…" },
  { id: "note", flag: "comanda_mostra_note_ordine", label: "Note ordine", hint: "Note libere cassa." },
  { id: "dest_stampanti", flag: "comanda_mostra_dest_stampanti", label: "Riga «Dest. stampa»", hint: "Testo del campo Stampanti / reparti." },
]

const COMANDA_DETTAGLI_UI = [
  { id: "impasto", flag: "comanda_mostra_riga_impasto", label: "Riga impasto", hint: "Impasto scelto in modale pizza." },
  { id: "cottura", flag: "comanda_mostra_riga_cottura", label: "Riga cottura (tipo pizza)", hint: "Normale, ben cotta, ecc." },
  { id: "ingredienti", flag: "comanda_mostra_riga_ingredienti", label: "Riga ingredienti", hint: "Base, varianti, aggiunte, fasi." },
]

const COMANDA_PREVIEW_MOCK = {
  tenantNome: "Pizzeria Demo",
  orderId: "00000000-0000-0000-0000-000000000001",
  numero: 42,
  createdAt: new Date().toISOString(),
  tipoOrdine: "delivery",
  nomeCliente: "Mario Rossi",
  orarioRitiro: "20:30",
  indirizzoConsegna: "Via Esempio 1, Milano",
  note: "Citofono rosso",
  tipoPagamento: "Contanti",
  righe: [
    {
      qty: 2,
      titolo: "Margherita (Classica)",
      dettagli: [
        { tag: "impasto", text: "Impasto: Classico" },
        { tag: "cottura", text: "Cottura: Normale" },
        // Stesso formato di buildComandaIngredientiSummary + split « · » in stampa:
        // ordine di ricetta (prodotto_ingrediente.ordine), non alfabetico.
        {
          tag: "ingredienti",
          text: "In cottura: Pomodoro, Mozzarella, Basilico",
        },
      ],
    },
    {
      qty: 1,
      titolo: "Capricciosa (Classica)",
      dettagli: [
        { tag: "impasto", text: "Impasto: Integrale" },
        { tag: "cottura", text: "Cottura: Ben cotta" },
        {
          tag: "ingredienti",
          text:
            "Senza: Carciofi · Abbondante Funghi · In cottura: Pomodoro, Mozzarella, Prosciutto cotto, Funghi · A fine cottura: Olive",
        },
      ],
    },
  ],
}

/** Flusso stampa + layout comanda — solo Admin (non operatore cassa). CA-11 */
export default function StampaOperativaSection() {
  const location = useLocation()
  const { tenantId } = useTenant()
  const { settings, setSettings } = useOutletContext()
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
    comanda_ordine_blocchi: normalizeComandaBlocchiOrdine(raw.comanda_ordine_blocchi),
    comanda_ordine_dettagli_prodotto: normalizeComandaDettagliOrdine(raw.comanda_ordine_dettagli_prodotto),
    comanda_etichette:
      raw.comanda_etichette && typeof raw.comanda_etichette === "object" && !Array.isArray(raw.comanda_etichette)
        ? raw.comanda_etichette
        : {},
    comanda_titolo_banner: raw.comanda_titolo_banner != null ? String(raw.comanda_titolo_banner) : "",
    stampa_modalita: readStampaModalita(raw),
    comanda_stampa_quando: readStampaQuando(raw, "comanda"),
    cassa_stampa_ricevuta_quando: readStampaQuando(raw, "ricevuta"),
    stampa_ricevuta_cortesia_reparto:
      raw.stampa_ricevuta_cortesia_reparto !== undefined && raw.stampa_ricevuta_cortesia_reparto !== null
        ? readStampaRicevutaCortesiaReparto(raw)
        : "delivery",
  }

  const setParam = (key, value) => {
    setSettings({
      ...settings,
      parametri_operativi: { ...(settings?.parametri_operativi || {}), [key]: value },
    })
  }

  const previewDoc = useMemo(() => {
    const raw =
      settings?.parametri_operativi && typeof settings.parametri_operativi === "object"
        ? settings.parametri_operativi
        : {}
    const parametri = {
      ...defaultParametri(),
      ...raw,
      pony_lun_gio: raw.pony_lun_gio !== undefined && raw.pony_lun_gio !== "" ? raw.pony_lun_gio : (raw.pony_consegna ?? ""),
      pony_ven_dom: raw.pony_ven_dom !== undefined && raw.pony_ven_dom !== "" ? raw.pony_ven_dom : "",
      pizze_ogni_15_min: raw.pizze_ogni_15_min !== undefined && raw.pizze_ogni_15_min !== "" ? raw.pizze_ogni_15_min : (raw.pizze_ogni_min ?? ""),
      comanda_stampanti: Array.isArray(raw.comanda_stampanti) ? raw.comanda_stampanti.join(", ") : (raw.comanda_stampanti ?? ""),
      comanda_ordine_blocchi: normalizeComandaBlocchiOrdine(raw.comanda_ordine_blocchi),
      comanda_ordine_dettagli_prodotto: normalizeComandaDettagliOrdine(raw.comanda_ordine_dettagli_prodotto),
      comanda_etichette:
        raw.comanda_etichette && typeof raw.comanda_etichette === "object" && !Array.isArray(raw.comanda_etichette)
          ? raw.comanda_etichette
          : {},
      comanda_titolo_banner: raw.comanda_titolo_banner != null ? String(raw.comanda_titolo_banner) : "",
    }
    return buildComandaKitchenHtmlDocument({ ...COMANDA_PREVIEW_MOCK, parametri })
  }, [settings])

  const setEtichetta = (key, val) => {
    const next = { ...(p.comanda_etichette || {}) }
    const t = String(val).trim()
    const def = COMANDA_ETICHETTE_DEFAULT[key]
    if (!t || (def != null && t === String(def))) delete next[key]
    else next[key] = val
    setParam("comanda_etichette", next)
  }

  const blocchiOrdinati = normalizeComandaBlocchiOrdine(p.comanda_ordine_blocchi)
  const dettagliOrdinati = normalizeComandaDettagliOrdine(p.comanda_ordine_dettagli_prodotto)

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
        pizzaiolo_partenza_consegne_minuti: p.pizzaiolo_partenza_consegne_minuti === "" ? 10 : Number(p.pizzaiolo_partenza_consegne_minuti) || 10,
        pizzaiolo_tempo_viaggio_minuti: p.pizzaiolo_tempo_viaggio_minuti === "" ? 10 : Number(p.pizzaiolo_tempo_viaggio_minuti) || 10,
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
        comanda_rotolo_mm: [0, 58, 76, 80].includes(Number(p.comanda_rotolo_mm)) ? Number(p.comanda_rotolo_mm) : 0,
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
        comanda_stampa_auto: p.comanda_stampa_quando === "auto",
        cassa_stampa_ricevuta_auto: p.cassa_stampa_ricevuta_quando === "auto",
        stampa_modalita: p.stampa_modalita === "con_tablet" ? "con_tablet" : "solo_cassa",
        cucina_tablet_abilitato: p.cucina_tablet_abilitato !== false,
        comanda_stampa_quando: ["auto", "manuale", "mai"].includes(p.comanda_stampa_quando)
          ? p.comanda_stampa_quando
          : "manuale",
        cassa_stampa_ricevuta_quando: ["auto", "manuale", "mai"].includes(p.cassa_stampa_ricevuta_quando)
          ? p.cassa_stampa_ricevuta_quando
          : "manuale",
        stampa_ricevuta_cortesia_reparto: String(p.stampa_ricevuta_cortesia_reparto || ""),
        comanda_ordine_blocchi: normalizeComandaBlocchiOrdine(p.comanda_ordine_blocchi),
        comanda_ordine_dettagli_prodotto: normalizeComandaDettagliOrdine(p.comanda_ordine_dettagli_prodotto),
        comanda_etichette:
          p.comanda_etichette && typeof p.comanda_etichette === "object" && !Array.isArray(p.comanda_etichette)
            ? p.comanda_etichette
            : {},
        comanda_titolo_banner: String(p.comanda_titolo_banner || "").trim(),
      }
      await updateTenantSettings(tenantId, { parametri_operativi: payload })
      setSettings({ ...settings, parametri_operativi: payload })
      alert("Impostazioni stampa salvate.")
    } catch (err) {
      console.error(err)
      alert("Errore durante il salvataggio. " + (err?.message || ""))
    } finally {
      setSaving(false)
    }
  }

  if (!settings) {
    return (
      <div style={{ padding: 24, textAlign: "center" }}>
        Caricamento...
      </div>
    )
  }

  const inputStyle = { marginTop: 6, padding: "8px 10px", width: "100%", boxSizing: "border-box" }
  return (
    <div className="dashboard-settings-page" style={styles.wrapper}>
      <SettingsSectionHeader
        title="Stampa operativa"
        description="Organizzazione tablet, quando stampare e layout comanda cucina. Non visibile all’operatore in cassa."
      />
      <section style={styles.section}>
        <h3 style={{ margin: "0 0 12px", fontSize: 16 }}>Flusso stampa operativa</h3>
        <p style={{ margin: "0 0 16px", fontSize: 13, color: "#555", lineHeight: 1.45 }}>
          Scegli come lavorate in sala: solo stampante in cassa, oppure tablet nei reparti con ricevuta di cortesia
          (non fiscale) per i ragazzi del delivery.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 560 }}>
          <label>
            <span style={{ fontWeight: 600 }}>Organizzazione</span>
            <select
              value={p.stampa_modalita || "solo_cassa"}
              onChange={(e) => setParam("stampa_modalita", e.target.value)}
              style={inputStyle}
            >
              {STAMPA_MODALITA_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
            <FieldHint>
              {STAMPA_MODALITA_OPTIONS.find((o) => o.id === p.stampa_modalita)?.hint}
            </FieldHint>
          </label>

          <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={p.cucina_tablet_abilitato !== false}
              onChange={(e) => setParam("cucina_tablet_abilitato", e.target.checked)}
              style={{ marginTop: 3 }}
            />
            <span>
              <strong>Tablet dedicato Cucina</strong>
              <FieldHint>
                Attivo: area Cucina separata (solo conteggi da preparare). Spento: le preparazioni compaiono nel Bancone
                appena inserisci l’ordine (utile senza tablet in cucina).
              </FieldHint>
            </span>
          </label>

          <label>
            <span style={{ fontWeight: 600 }}>Copie comanda (da cassa)</span>
            <FieldHint>
              Quante copie della comanda cucina stampare in un colpo solo (max 5). Vale quando la stampa parte dalla
              cassa.
            </FieldHint>
            <input
              type="number"
              min={1}
              max={5}
              value={p.comanda_copie === "" ? "" : p.comanda_copie}
              onChange={(e) => setParam("comanda_copie", e.target.value === "" ? "" : e.target.value)}
              style={inputStyle}
            />
          </label>

          <label>
            <span style={{ fontWeight: 600 }}>Quando stampare la comanda (cassa)</span>
            <select
              value={p.comanda_stampa_quando || "manuale"}
              onChange={(e) => setParam("comanda_stampa_quando", e.target.value)}
              style={inputStyle}
            >
              {STAMPA_QUANDO_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          {p.stampa_modalita !== "con_tablet" ? (
            <label>
              <span style={{ fontWeight: 600 }}>Quando stampare la ricevuta di cortesia (cassa)</span>
              <FieldHint>
                Documento non fiscale per il cliente. In modalità «solo cassa» parte dalla conferma ordine in cassa.
              </FieldHint>
              <select
                value={p.cassa_stampa_ricevuta_quando || "manuale"}
                onChange={(e) => setParam("cassa_stampa_ricevuta_quando", e.target.value)}
                style={inputStyle}
              >
                {STAMPA_QUANDO_OPTIONS.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label>
              <span style={{ fontWeight: 600 }}>Reparto che stampa la ricevuta di cortesia</span>
              <FieldHint>
                Nella schermata del reparto compare il pulsante «Stampa ricevuta di cortesia» sull’ordine. Tipico:
                Delivery, così i pony hanno la copia da lasciare al cliente.
              </FieldHint>
              <select
                value={p.stampa_ricevuta_cortesia_reparto ?? "delivery"}
                onChange={(e) => setParam("stampa_ricevuta_cortesia_reparto", e.target.value)}
                style={inputStyle}
              >
                {STAMPA_CORTESIA_REPARTI.map((o) => (
                  <option key={o.id || "none"} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      </section>

      <section style={styles.section}>
        <h3 style={{ margin: "0 0 12px", fontSize: 16 }}>Comanda — layout stampa</h3>
        <p style={{ margin: "0 0 16px", fontSize: 13, color: "#555", lineHeight: 1.45 }}>
          Impostazioni usate quando stampi la comanda cucina dal browser (stampante termica o PDF). Il risultato dipende anche dal driver della stampante: prova una stampa di test dopo ogni modifica.
          Trascina le righe per cambiare l&apos;ordine in stampa; l&apos;anteprima a destra usa dati di esempio e riflette salvataggio dopo «Salva».
        </p>
        <p style={{ margin: "0 0 16px", fontSize: 13 }}>
          <Link
            to={withPreservedSupportSearch("/operative/cassa/stampanti-reparti", location.search)}
            style={{ color: "#1565c0", fontWeight: 600 }}
          >
            Stampanti per reparto (USB o IP)
          </Link>
          {" — "}
          associa cucina, forno, fritti a stampante USB/locale (es. POS-58) o rete IP; in cassa puoi usare «Stampa per
          reparto».
        </p>
        <div style={styles.comandaGrid}>
        <div style={{ ...styles.comandaCol, display: "flex", flexDirection: "column", gap: 20 }}>
          <fieldset style={{ border: "1px solid #c8e6c9", borderRadius: 8, padding: "14px 16px", margin: 0, background: "#f8fff8" }}>
            <legend style={{ fontSize: 13, fontWeight: 600, padding: "0 6px" }}>Rotolo carta termica</legend>
            <label style={{ display: "block", cursor: "pointer" }}>
              <span style={{ fontWeight: 600 }}>Dimensione rotolo (larghezza carta)</span>
              <FieldHint>
                Indica la <strong>larghezza fisica</strong> del rotolo che monti sulla stampante (58 mm, 76 mm o 80 mm). Serve al foglio di stampa per suggerire al browser la <strong>larghezza pagina</strong> corretta.
                Se scegli «Personalizzato», non viene forzata la larghezza del foglio: contano solo margini e «Larghezza contenuto» sotto.
              </FieldHint>
              <select
                value={String([0, 58, 76, 80].includes(Number(p.comanda_rotolo_mm)) ? Number(p.comanda_rotolo_mm) : 0)}
                onChange={(e) => setParam("comanda_rotolo_mm", Number(e.target.value))}
                style={inputStyle}
              >
                <option value="0">Personalizzato (non imposto la larghezza del foglio)</option>
                <option value="58">58 mm — rotolo stretto (spesso scontrino / cassa)</option>
                <option value="76">76 mm — rotolo intermedio</option>
                <option value="80">80 mm — rotolo largo (molto usato in cucina)</option>
              </select>
            </label>
            <FieldHint>
              Con rotolo <strong>58 / 76 / 80 mm</strong>, se lasci <strong>Larghezza contenuto = 0</strong>, il testo usa una larghezza utile predefinita (circa 52 / 68 / 72 mm) per evitare che esca dai bordi. Puoi comunque impostare tu un valore in mm per stringere o allargare.
            </FieldHint>
          </fieldset>

          <label>
            <span style={{ fontWeight: 600 }}>Dimensione testo corpo (px)</span>
            <FieldHint>Altezza base del carattere per righe normali (locale, righe prodotto, note). Più alto = caratteri più grandi su tutta la comanda, tranne dove c’è una scala dedicata sotto.</FieldHint>
            <input type="number" min={8} max={28} placeholder="es. 13" value={p.comanda_font_size === "" ? "" : p.comanda_font_size} onChange={(e) => setParam("comanda_font_size", e.target.value === "" ? "" : e.target.value)} style={inputStyle} />
          </label>
          <label>
            <span style={{ fontWeight: 600 }}>Scala titolo «COMANDA CUCINA»</span>
            <FieldHint>Moltiplicatore rispetto al testo corpo (es. 1,12 = titolo leggermente più grande). Vale solo per la riga di intestazione principale.</FieldHint>
            <input type="number" min={0.85} max={1.6} step={0.01} placeholder="1.12" value={p.comanda_titolo_scale === "" ? "" : p.comanda_titolo_scale} onChange={(e) => setParam("comanda_titolo_scale", e.target.value === "" ? "" : e.target.value)} style={inputStyle} />
          </label>
          <label>
            <span style={{ fontWeight: 600 }}>Scala quantità (es. 2×)</span>
            <FieldHint>Moltiplicatore per il numero a sinistra di ogni riga prodotto (2×, 1×…). Utile per evidenziare le quantità in cucina.</FieldHint>
            <input type="number" min={0.85} max={1.5} step={0.01} placeholder="1" value={p.comanda_qty_scale === "" ? "" : p.comanda_qty_scale} onChange={(e) => setParam("comanda_qty_scale", e.target.value === "" ? "" : e.target.value)} style={inputStyle} />
          </label>
          <label>
            <span style={{ fontWeight: 600 }}>Scala dettagli sotto il prodotto</span>
            <FieldHint>Moltiplicatore per le righe piccole sotto il nome pizza (impasto, cottura, ingredienti). Di solito leggermente più piccolo del corpo per distinguere i dettagli.</FieldHint>
            <input type="number" min={0.75} max={1.15} step={0.01} placeholder="0.95" value={p.comanda_dettaglio_scale === "" ? "" : p.comanda_dettaglio_scale} onChange={(e) => setParam("comanda_dettaglio_scale", e.target.value === "" ? "" : e.target.value)} style={inputStyle} />
          </label>
          <label>
            <span style={{ fontWeight: 600 }}>Interlinea</span>
            <FieldHint>Distanza verticale tra le righe di testo (1 = compatto, valori più alti = più aria). Aiuta la lettura su carta termica piccola.</FieldHint>
            <input type="number" min={1.05} max={1.9} step={0.05} placeholder="1.35" value={p.comanda_line_height === "" ? "" : p.comanda_line_height} onChange={(e) => setParam("comanda_line_height", e.target.value === "" ? "" : e.target.value)} style={inputStyle} />
          </label>
          <label>
            <span style={{ fontWeight: 600 }}>Famiglia carattere</span>
            <FieldHint>
              <strong>Sistema</strong>: font del dispositivo, spesso più leggibile a schermo.
              <strong>Monospazio</strong>: caratteri a larghezza fissa, spesso simile alle stampanti ESC/POS.
              Scegli in base a come rende la tua stampante nel dialogo di stampa.
            </FieldHint>
            <select value={p.comanda_font_family || "system"} onChange={(e) => setParam("comanda_font_family", e.target.value)} style={inputStyle}>
              <option value="system">Sistema (consigliato)</option>
              <option value="sans">Sans (Arial / simile)</option>
              <option value="mono">Monospazio (simile a termica)</option>
              <option value="serif">Serif</option>
            </select>
          </label>
          <label>
            <span style={{ fontWeight: 600 }}>Margini pagina (mm, tutti i lati)</span>
            <FieldHint>Spazio bianco lasciato tra il bordo del foglio (o del rotolo) e il contenuto. Valori bassi (es. 4–6) sfruttano meglio carta stretta; troppo bassi possono tagliare il testo su alcune stampanti.</FieldHint>
            <input type="number" min={2} max={24} placeholder="8" value={p.comanda_margin_mm === "" ? "" : p.comanda_margin_mm} onChange={(e) => setParam("comanda_margin_mm", e.target.value === "" ? "" : e.target.value)} style={inputStyle} />
          </label>
          <label>
            <span style={{ fontWeight: 600 }}>Larghezza massima contenuto (mm)</span>
            <FieldHint>
              Limita la larghezza del blocco di testo al centro (evita righe lunghissime). <strong>0</strong> = nessun limite manuale; se hai scelto un <strong>rotolo</strong> sopra, viene usata la larghezza utile predefinita per quel rotolo finché resta 0.
              Se compili un valore (es. 70), quello ha priorità sul predefinito del rotolo.
            </FieldHint>
            <input type="number" min={0} max={120} placeholder="0 = auto se rotolo impostato" value={p.comanda_width_mm === "" ? "" : p.comanda_width_mm} onChange={(e) => setParam("comanda_width_mm", e.target.value === "" ? "" : e.target.value)} style={inputStyle} />
          </label>
          <label>
            <span style={{ fontWeight: 600 }}>Stampanti / reparti (testo informativo)</span>
            <FieldHint>
              Testo libero mostrato in comanda come «Dest. stampa: …» (se abilitato sotto). Serve a indicare a chi è destinato lo scontrino (Cucina, Pizzeria, Bancone…). Una voce per riga oppure separate da virgola.
            </FieldHint>
            <textarea rows={3} placeholder="es. Cucina, Bancone" value={p.comanda_stampanti || ""} onChange={(e) => setParam("comanda_stampanti", e.target.value)} style={{ ...inputStyle, resize: "vertical", minHeight: 84 }} />
          </label>
        </div>
        <div style={{ ...styles.comandaCol, display: "flex", flexDirection: "column", gap: 16 }}>
          <fieldset style={{ border: "1px solid #e0e0e0", borderRadius: 8, padding: "12px 14px", margin: 0 }}>
            <legend style={{ fontSize: 13, fontWeight: 600, padding: "0 6px" }}>Cosa includere e ordine righe</legend>
            <FieldHint style={{ marginBottom: 10 }}>
              Spunta per mostrare o nascondere. Trascina le righe (⋮⋮) per l&apos;ordine verticale sulla comanda stampata.
            </FieldHint>
            <p style={{ margin: "0 0 8px", fontSize: 12, color: "#666", fontWeight: 600 }}>Intestazione e dati ordine</p>
            <div style={{ marginBottom: 12 }}>
              {blocchiOrdinati.map((blockId) => {
                const meta = COMANDA_BLOCCHI_UI.find((x) => x.id === blockId)
                if (!meta) return null
                return (
                  <div
                    key={blockId}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("application/x-comanda-block", blockId)
                      e.dataTransfer.effectAllowed = "move"
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault()
                      const dragged = e.dataTransfer.getData("application/x-comanda-block")
                      if (!dragged || dragged === blockId) return
                      const order = [...blocchiOrdinati]
                      const fi = order.indexOf(dragged)
                      const ti = order.indexOf(blockId)
                      if (fi < 0 || ti < 0) return
                      order.splice(fi, 1)
                      order.splice(ti, 0, dragged)
                      setParam("comanda_ordine_blocchi", order)
                    }}
                    style={styles.dragRow}
                  >
                    <span style={styles.dragHandle} aria-hidden>⋮⋮</span>
                    <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", flex: 1, minWidth: 0 }}>
                      <input
                        type="checkbox"
                        checked={Boolean(p[meta.flag])}
                        onChange={(ev) => setParam(meta.flag, ev.target.checked)}
                        style={{ marginTop: 3, flexShrink: 0 }}
                      />
                      <span>
                        <span style={{ fontWeight: 500 }}>{meta.label}</span>
                        <FieldHint>{meta.hint}</FieldHint>
                      </span>
                    </label>
                  </div>
                )
              })}
            </div>
            <p style={{ margin: "12px 0 8px", fontSize: 12, color: "#666", fontWeight: 600 }}>Sotto ogni prodotto (ordine righe dettaglio)</p>
            {dettagliOrdinati.map((tag) => {
              const meta = COMANDA_DETTAGLI_UI.find((x) => x.id === tag)
              if (!meta) return null
              return (
                <div
                  key={tag}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("application/x-comanda-dettaglio", tag)
                    e.dataTransfer.effectAllowed = "move"
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault()
                    const dragged = e.dataTransfer.getData("application/x-comanda-dettaglio")
                    if (!dragged || dragged === tag) return
                    const order = [...dettagliOrdinati]
                    const fi = order.indexOf(dragged)
                    const ti = order.indexOf(tag)
                    if (fi < 0 || ti < 0) return
                    order.splice(fi, 1)
                    order.splice(ti, 0, dragged)
                    setParam("comanda_ordine_dettagli_prodotto", order)
                  }}
                  style={{ ...styles.dragRow, marginBottom: 10 }}
                >
                  <span style={styles.dragHandle} aria-hidden>⋮⋮</span>
                  <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", flex: 1, minWidth: 0 }}>
                    <input
                      type="checkbox"
                      checked={Boolean(p[meta.flag])}
                      onChange={(ev) => setParam(meta.flag, ev.target.checked)}
                      style={{ marginTop: 3, flexShrink: 0 }}
                    />
                    <span>
                      <span style={{ fontWeight: 500 }}>{meta.label}</span>
                      <FieldHint>{meta.hint}</FieldHint>
                    </span>
                  </label>
                </div>
              )
            })}
          </fieldset>
          <label>
            <span style={{ fontWeight: 600 }}>Titolo banner (opzionale)</span>
            <FieldHint>
              Sostituisce il testo grande in cima se compilato. Se vuoto, si usa l&apos;etichetta predefinita o il campo «banner» in etichette sotto.
            </FieldHint>
            <input
              type="text"
              placeholder={COMANDA_ETICHETTE_DEFAULT.banner}
              value={p.comanda_titolo_banner || ""}
              onChange={(e) => setParam("comanda_titolo_banner", e.target.value)}
              style={inputStyle}
            />
          </label>
          <details style={{ border: "1px solid #e0e0e0", borderRadius: 8, padding: "10px 12px", background: "#fafafa" }}>
            <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 14 }}>Etichette testi (personalizzazione)</summary>
            <FieldHint style={{ marginTop: 8 }}>
              Lascia vuoto per usare il default. Modifica le parole prima dei due punti (es. «Cliente», «Orario») o il titolo servizio.
            </FieldHint>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
              {Object.keys(COMANDA_ETICHETTE_DEFAULT).map((key) => (
                <label key={key} style={{ display: "block" }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#444" }}>{key}</span>
                  <input
                    type="text"
                    placeholder={COMANDA_ETICHETTE_DEFAULT[key]}
                    value={p.comanda_etichette?.[key] ?? ""}
                    onChange={(e) => setEtichetta(key, e.target.value)}
                    style={inputStyle}
                  />
                </label>
              ))}
            </div>
          </details>
        </div>
        <div style={styles.comandaPreviewCol}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>Layout anteprima</div>
          <FieldHint style={{ marginBottom: 8 }}>
            Anteprima allineata alla stampa reale: ordine ricetta degli ingredienti e fasi
            (in cottura / a fine cottura / senza / aggiunte). Trascina i dettagli a sinistra
            per vedere l&apos;effetto subito. Salva per persistere su tutti i dispositivi del locale.
          </FieldHint>
          <div style={styles.previewFrame}>
            <iframe title="Anteprima comanda" srcDoc={previewDoc} style={{ width: "100%", height: "100%", border: "none", display: "block" }} />
          </div>
        </div>
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
  wrapper: { padding: 20, maxWidth: "none", width: "100%", margin: 0, boxSizing: "border-box" },
  header: { marginBottom: 20 },
  backBtn: { padding: "8px 14px", marginBottom: 12, background: "#f0f0f0", border: "1px solid #ccc", borderRadius: 8, cursor: "pointer", fontSize: 14 },
  title: { margin: 0, fontSize: 20, fontWeight: 600 },
  section: { background: "#fff", border: "1px solid #e0e0e0", borderRadius: 8, padding: 20, marginBottom: 16 },
  fields: { display: "flex", flexDirection: "column", gap: 20 },
  twoColGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16, marginBottom: 16 },
  comandaGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16, alignItems: "start" },
  comandaCol: { minWidth: 0 },
  // Sticky: l'anteprima resta visibile mentre si scorre il resto del form, senza dover
  // continuamente scorrere su e giù per confrontare una modifica col risultato.
  comandaPreviewCol: { minWidth: 220, position: "sticky", top: 16, alignSelf: "start" },
  previewFrame: { height: 440, border: "1px solid #ccc", borderRadius: 8, overflow: "hidden", background: "#fff", boxShadow: "inset 0 0 0 1px #eee" },
  dragRow: {
    display: "flex",
    gap: 10,
    alignItems: "flex-start",
    padding: "8px 8px",
    borderRadius: 6,
    border: "1px solid #e8e8e8",
    marginBottom: 8,
    background: "#fafafa",
    cursor: "grab",
  },
  dragHandle: { flexShrink: 0, color: "#999", userSelect: "none", fontSize: 14, lineHeight: 1.4, width: 22 },
  actions: { marginTop: 16 },
  saveBtn: { padding: "10px 20px", background: "#2e7d32", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: 600 },
}
