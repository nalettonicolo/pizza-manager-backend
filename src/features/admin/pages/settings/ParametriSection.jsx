import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { useTenant } from "@/app/contexts/TenantContext";
import {
  updateTenantSettings,
  getCategories,
  getFoodcostPriceMismatchReport,
} from "@/features/admin/services/adminService";
import PromozioniCalendarioEditor from "@/features/admin/components/PromozioniCalendarioEditor";
import { sortByOrdine } from "@/utils/sortByOrdine";
import {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_PARAM_KEYS,
  notificationAdapterReadiness,
} from "@/integrations/notifications";

function serializePromozioniCalendario(list) {
  if (!Array.isArray(list)) return [];
  return list.map((r) => ({
    id: String(r.id || `pc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`),
    nome: String(r.nome || "").trim(),
    giorno_settimana: Math.min(6, Math.max(0, Number(r.giorno_settimana) || 0)),
    ora_inizio: r.ora_inizio || "11:00",
    ora_fine: r.ora_fine || "15:00",
    prezzo_fisso_euro: Math.max(0, Number(r.prezzo_fisso_euro) || 0),
    categoria_ids: Array.isArray(r.categoria_ids) ? r.categoria_ids.map(String) : [],
    solo_senza_modifiche_ingredienti: r.solo_senza_modifiche_ingredienti !== false,
    disabilita_fidelity: r.disabilita_fidelity === true,
    attivo: r.attivo !== false,
  }));
}

const defaultParametri = () => ({
  pony_lun_gio: "",
  pony_ven_dom: "",
  pizze_ogni_15_min: "",
  consegne_ogni_min: "",
  ritiro_ogni_min: "",
  tempo_preparazione_pizza: "",
  foodcost_margine_percent: "0",
  soglia_giallo_pizze: "10",
  comanda_copie: "1",
  comanda_font_size: "13",
  comanda_stampanti: "",
});

export default function ParametriSection() {
  const { settings, setSettings } = useOutletContext();
  const { tenantId } = useTenant();
  const [saving, setSaving] = useState(false);
  const [promoCategories, setPromoCategories] = useState([]);
  const [foodcostCheckLoading, setFoodcostCheckLoading] = useState(false);
  const [foodcostMismatchCount, setFoodcostMismatchCount] = useState(0);
  const [foodcostModalOpen, setFoodcostModalOpen] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    let c = false;
    void getCategories(tenantId)
      .then((d) => {
        if (!c) setPromoCategories(sortByOrdine(d || []));
      })
      .catch(() => {
        if (!c) setPromoCategories([]);
      });
    return () => {
      c = true;
    };
  }, [tenantId]);

  useEffect(() => {
    if (!tenantId) return;
    let cancelled = false;
    setFoodcostCheckLoading(true);
    void getFoodcostPriceMismatchReport(tenantId)
      .then((res) => {
        if (cancelled) return;
        const count = Array.isArray(res?.mismatches) ? res.mismatches.length : 0;
        setFoodcostMismatchCount(count);
        if (count > 0) setFoodcostModalOpen(true);
      })
      .catch(() => {
        if (!cancelled) setFoodcostMismatchCount(0);
      })
      .finally(() => {
        if (!cancelled) setFoodcostCheckLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tenantId, settings?.parametri_operativi]);

  const raw = settings?.parametri_operativi && typeof settings.parametri_operativi === "object"
    ? settings.parametri_operativi
    : {};
  const p = {
    ...defaultParametri(),
    ...raw,
    // retrocompatibilità: vecchio pony_consegna → pony_lun_gio se non impostati
    pony_lun_gio: raw.pony_lun_gio !== undefined && raw.pony_lun_gio !== "" ? raw.pony_lun_gio : (raw.pony_consegna ?? ""),
    pony_ven_dom: raw.pony_ven_dom !== undefined && raw.pony_ven_dom !== "" ? raw.pony_ven_dom : "",
    pizze_ogni_15_min: raw.pizze_ogni_15_min !== undefined && raw.pizze_ogni_15_min !== "" ? raw.pizze_ogni_15_min : (raw.pizze_ogni_min ?? ""),
    comanda_stampanti: Array.isArray(raw.comanda_stampanti) ? raw.comanda_stampanti.join(", ") : (raw.comanda_stampanti ?? ""),
    abilita_gestione_listini_multipli:
      raw.abilita_gestione_listini_multipli === true || raw.listini_multipli === true,
    promozioni_calendario: Array.isArray(raw.promozioni_calendario) ? raw.promozioni_calendario : [],
    stampa_comanda_ordine_web_automatica: raw.stampa_comanda_ordine_web_automatica === true,
    ordini_web_accettazione_mode:
      String(raw.ordini_web_accettazione_mode || "auto").toLowerCase() === "manuale" ? "manuale" : "auto",
    chiusura_giornata_automatica: raw.chiusura_giornata_automatica !== false,
    cassa_turno_obbligatorio: raw.cassa_turno_obbligatorio === true,
    cassa_arrotonda_5_cent: raw.cassa_arrotonda_5_cent === true,
    cassa_pagamento_contanti: raw.cassa_pagamento_contanti !== false,
    cassa_pagamento_carta: raw.cassa_pagamento_carta !== false,
    cassa_pagamento_paga_online: raw.cassa_pagamento_paga_online !== false,
    vetrina_consegna_filtro_quarto_attivo: raw.vetrina_consegna_filtro_quarto_attivo !== false,
    vetrina_consegna_filtro_quarto_ora_fine:
      raw.vetrina_consegna_filtro_quarto_ora_fine !== undefined && raw.vetrina_consegna_filtro_quarto_ora_fine !== ""
        ? raw.vetrina_consegna_filtro_quarto_ora_fine
        : "15",
    vetrina_consegna_filtro_quarto_minuto: [0, 15, 30, 45].includes(Number(raw.vetrina_consegna_filtro_quarto_minuto))
      ? String(raw.vetrina_consegna_filtro_quarto_minuto)
      : "45",
    rider_velocita_media_kmh:
      raw.rider_velocita_media_kmh !== undefined && raw.rider_velocita_media_kmh !== ""
        ? String(raw.rider_velocita_media_kmh)
        : "28",
    rider_velocita_mal_tempo_kmh:
      raw.rider_velocita_mal_tempo_kmh !== undefined && raw.rider_velocita_mal_tempo_kmh !== ""
        ? String(raw.rider_velocita_mal_tempo_kmh)
        : "22",
    rider_ritardo_soglia_min:
      raw.rider_ritardo_soglia_min !== undefined && raw.rider_ritardo_soglia_min !== ""
        ? String(raw.rider_ritardo_soglia_min)
        : "5",
    rider_tempo_fermata_cliente_min:
      raw.rider_tempo_fermata_cliente_min !== undefined && raw.rider_tempo_fermata_cliente_min !== ""
        ? String(raw.rider_tempo_fermata_cliente_min)
        : "2",
    rider_forno_evidenza_min:
      raw.rider_forno_evidenza_min !== undefined && raw.rider_forno_evidenza_min !== ""
        ? String(raw.rider_forno_evidenza_min)
        : "15",
    rider_partenza_buffer_min:
      raw.rider_partenza_buffer_min !== undefined && raw.rider_partenza_buffer_min !== ""
        ? String(raw.rider_partenza_buffer_min)
        : "5",
    rider_ricalcolo_automatico: raw.rider_ricalcolo_automatico === true,
    notifica_ordine_web_canale: raw.notifica_ordine_web_canale || NOTIFICATION_CHANNELS.EMAIL,
    notifica_ordine_web_email: raw.notifica_ordine_web_email ?? "",
    notifica_ordine_web_telefono_sms: raw.notifica_ordine_web_telefono_sms ?? "",
    notifica_ordine_web_telefono_whatsapp: raw.notifica_ordine_web_telefono_whatsapp ?? "",
  };

  const setParam = (key, value) => {
    setSettings({
      ...settings,
      parametri_operativi: { ...(settings?.parametri_operativi || {}), [key]: value },
    });
  };

  async function handleSave() {
    if (!tenantId || !settings) return;
    try {
      setSaving(true);
      const payload = {
        ...(settings?.parametri_operativi || {}),
        pony_lun_gio: p.pony_lun_gio === "" ? 0 : Number(p.pony_lun_gio) || 0,
        pony_ven_dom: p.pony_ven_dom === "" ? 0 : Number(p.pony_ven_dom) || 0,
        pizze_ogni_15_min: p.pizze_ogni_15_min === "" ? 0 : Number(p.pizze_ogni_15_min) || 0,
        consegne_ogni_min: p.consegne_ogni_min === "" ? 0 : Number(p.consegne_ogni_min) || 0,
        ritiro_ogni_min: p.ritiro_ogni_min === "" ? 0 : Number(p.ritiro_ogni_min) || 0,
        tempo_preparazione_pizza: p.tempo_preparazione_pizza === "" ? 0 : Number(p.tempo_preparazione_pizza) || 0,
        foodcost_margine_percent:
          p.foodcost_margine_percent === "" ? 0 : Math.min(95, Math.max(0, Number(p.foodcost_margine_percent) || 0)),
        soglia_giallo_pizze: p.soglia_giallo_pizze === "" ? 10 : Number(p.soglia_giallo_pizze) || 10,
        comanda_copie: p.comanda_copie === "" ? 1 : Math.max(1, Number(p.comanda_copie) || 1),
        comanda_font_size: p.comanda_font_size === "" ? 13 : Math.max(9, Number(p.comanda_font_size) || 13),
        comanda_stampanti: String(p.comanda_stampanti || "")
          .split(/\r?\n|,/)
          .map((v) => v.trim())
          .filter(Boolean),
        abilita_gestione_listini_multipli: p.abilita_gestione_listini_multipli === true,
        promozioni_calendario: serializePromozioniCalendario(p.promozioni_calendario),
        stampa_comanda_ordine_web_automatica: p.stampa_comanda_ordine_web_automatica === true,
        ordini_web_accettazione_mode: p.ordini_web_accettazione_mode === "manuale" ? "manuale" : "auto",
        chiusura_giornata_automatica: p.chiusura_giornata_automatica !== false,
        cassa_turno_obbligatorio: p.cassa_turno_obbligatorio === true,
        cassa_arrotonda_5_cent: p.cassa_arrotonda_5_cent === true,
        cassa_pagamento_contanti: p.cassa_pagamento_contanti !== false,
        cassa_pagamento_carta: p.cassa_pagamento_carta !== false,
        cassa_pagamento_paga_online: p.cassa_pagamento_paga_online !== false,
        vetrina_consegna_filtro_quarto_attivo: p.vetrina_consegna_filtro_quarto_attivo !== false,
        vetrina_consegna_filtro_quarto_ora_fine:
          p.vetrina_consegna_filtro_quarto_ora_fine === "" ? 15 : Math.min(23, Math.max(0, Number(p.vetrina_consegna_filtro_quarto_ora_fine) || 15)),
        vetrina_consegna_filtro_quarto_minuto: [0, 15, 30, 45].includes(Number(p.vetrina_consegna_filtro_quarto_minuto))
          ? Number(p.vetrina_consegna_filtro_quarto_minuto)
          : 45,
        rider_velocita_media_kmh:
          p.rider_velocita_media_kmh === "" ? 28 : Math.min(120, Math.max(5, Number(p.rider_velocita_media_kmh) || 28)),
        rider_velocita_mal_tempo_kmh:
          p.rider_velocita_mal_tempo_kmh === "" ? 22 : Math.min(120, Math.max(5, Number(p.rider_velocita_mal_tempo_kmh) || 22)),
        rider_ritardo_soglia_min:
          p.rider_ritardo_soglia_min === "" ? 5 : Math.min(180, Math.max(1, Number(p.rider_ritardo_soglia_min) || 5)),
        rider_tempo_fermata_cliente_min:
          p.rider_tempo_fermata_cliente_min === "" ? 2 : Math.min(60, Math.max(0, Number(p.rider_tempo_fermata_cliente_min) || 2)),
        rider_forno_evidenza_min:
          p.rider_forno_evidenza_min === "" ? 15 : Math.min(120, Math.max(1, Number(p.rider_forno_evidenza_min) || 15)),
        rider_partenza_buffer_min:
          p.rider_partenza_buffer_min === "" ? 5 : Math.min(60, Math.max(0, Number(p.rider_partenza_buffer_min) || 5)),
        rider_ricalcolo_automatico: p.rider_ricalcolo_automatico === true,
        [NOTIFICATION_PARAM_KEYS.ordine_web_canale]: String(p.notifica_ordine_web_canale || NOTIFICATION_CHANNELS.EMAIL),
        [NOTIFICATION_PARAM_KEYS.ordine_web_email]: String(p.notifica_ordine_web_email || "").trim(),
        [NOTIFICATION_PARAM_KEYS.ordine_web_telefono_sms]: String(p.notifica_ordine_web_telefono_sms || "").trim(),
        [NOTIFICATION_PARAM_KEYS.ordine_web_telefono_whatsapp]: String(p.notifica_ordine_web_telefono_whatsapp || "").trim(),
      };
      await updateTenantSettings(tenantId, { parametri_operativi: payload });
      setSettings({ ...settings, parametri_operativi: payload });
      alert("Parametri salvati.");
    } catch (err) {
      console.error(err);
      alert("Errore durante il salvataggio. " + (err?.message || ""));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="dashboard-settings-page">
      <h1 className="dashboard-page-title">Parametri operativi</h1>
      <section className="dashboard-box dashboard-settings-section">
        {foodcostMismatchCount > 0 ? (
          <div
            style={{
              marginBottom: 14,
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid #fecaca",
              background: "#fef2f2",
              color: "#991b1b",
              fontSize: 13,
              lineHeight: 1.5,
            }}
          >
            <strong>Controllo foodcost/listino:</strong> trovati {foodcostMismatchCount} prodotti con prezzo listino non allineato al costo ingredienti.
            Verifica in Menu e ricalcola prezzi prima del servizio.
          </div>
        ) : null}
        {foodcostCheckLoading ? (
          <p style={{ marginTop: 0, marginBottom: 12, fontSize: 12, color: "#64748b" }}>
            Verifica allineamento foodcost in corso...
          </p>
        ) : null}
        <div className="dashboard-settings-fields" style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 420 }}>
          <label>
            Pony disponibili per consegna da lunedì a giovedì 
            <input
              type="number"
              min={0}
              placeholder="es. 2"
              value={p.pony_lun_gio === "" ? "" : p.pony_lun_gio}
              onChange={(e) => setParam("pony_lun_gio", e.target.value === "" ? "" : e.target.value)}
              style={{ marginTop: 6, padding: "8px 10px", width: "100%", boxSizing: "border-box" }}
            />
          </label>
          <label>
            Pony disponibili per consegna da venerdì a domenica 
            <input
              type="number"
              min={0}
              placeholder="es. 3"
              value={p.pony_ven_dom === "" ? "" : p.pony_ven_dom}
              onChange={(e) => setParam("pony_ven_dom", e.target.value === "" ? "" : e.target.value)}
              style={{ marginTop: 6, padding: "8px 10px", width: "100%", boxSizing: "border-box" }}
            />
          </label>
          <label>
            Pizze ogni 15 minuti - capacità forno 
            <input
              type="number"
              min={1}
              placeholder="es. 8"
              value={p.pizze_ogni_15_min === "" ? "" : p.pizze_ogni_15_min}
              onChange={(e) => setParam("pizze_ogni_15_min", e.target.value === "" ? "" : e.target.value)}
              style={{ marginTop: 6, padding: "8px 10px", width: "100%", boxSizing: "border-box" }}
            />
          </label>
          <label>
            Consegne programmate ogni tot. di minuti 
            <input
              type="number"
              min={1}
              placeholder="es. 15"
              value={p.consegne_ogni_min === "" ? "" : p.consegne_ogni_min}
              onChange={(e) => setParam("consegne_ogni_min", e.target.value === "" ? "" : e.target.value)}
              style={{ marginTop: 6, padding: "8px 10px", width: "100%", boxSizing: "border-box" }}
            />
          </label>
          <label>
            Ritiro in negozio ogni tot. di minuti 
            <input
              type="number"
              min={1}
              placeholder="es. 15 (quarti d’ora)"
              value={p.ritiro_ogni_min === "" ? "" : p.ritiro_ogni_min}
              onChange={(e) => setParam("ritiro_ogni_min", e.target.value === "" ? "" : e.target.value)}
              style={{ marginTop: 6, padding: "8px 10px", width: "100%", boxSizing: "border-box" }}
            />
          </label>
          <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={p.abilita_gestione_listini_multipli}
              onChange={(e) => setParam("abilita_gestione_listini_multipli", e.target.checked)}
              style={{ marginTop: 4 }}
            />
            <span>
              Consenti gestione listini multipli (archivio): di default un solo listino attivo; se attivo, in Menu → Listini e backup
              puoi salvare snapshot JSON oltre all&apos;export PDF.
            </span>
          </label>
          <h3 style={{ margin: "16px 0 8px", fontSize: 16 }}>Cassa</h3>
          <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={p.cassa_turno_obbligatorio}
              onChange={(e) => setParam("cassa_turno_obbligatorio", e.target.checked)}
              style={{ marginTop: 4 }}
            />
            <span>
              Richiedi turno cassa aperto (stesso punto vendita attivo) prima di confermare ordini in cassa. Configura i turni in
              Operative → Turni cassa.
            </span>
          </label>
          <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={p.cassa_arrotonda_5_cent}
              onChange={(e) => setParam("cassa_arrotonda_5_cent", e.target.checked)}
              style={{ marginTop: 4 }}
            />
            <span>
              In cassa, arrotonda il totale da incassare a 0,05 € (contanti) dopo eventuali sconti a cassa.
            </span>
          </label>
          <fieldset style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "12px 14px", margin: "12px 0 0" }}>
            <legend style={{ padding: "0 6px", fontSize: 13, fontWeight: 600 }}>Pagamenti consentiti</legend>
            <p style={{ margin: "0 0 10px", fontSize: 13, color: "#64748b", lineHeight: 1.45 }}>
              Per gli <strong>ordini online</strong> (vetrina) restano solo Contanti, Carta e Paga online, se attivi qui.
              In cassa locale restano anche Misto, Da pagare e Altro.
            </p>
            <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", marginBottom: 8 }}>
              <input
                type="checkbox"
                checked={p.cassa_pagamento_contanti}
                onChange={(e) => setParam("cassa_pagamento_contanti", e.target.checked)}
                style={{ marginTop: 4 }}
              />
              <span>Contanti</span>
            </label>
            <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", marginBottom: 8 }}>
              <input
                type="checkbox"
                checked={p.cassa_pagamento_carta}
                onChange={(e) => setParam("cassa_pagamento_carta", e.target.checked)}
                style={{ marginTop: 4 }}
              />
              <span>Carta (POS in locale / alla consegna)</span>
            </label>
            <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={p.cassa_pagamento_paga_online}
                onChange={(e) => setParam("cassa_pagamento_paga_online", e.target.checked)}
                style={{ marginTop: 4 }}
              />
              <span>Paga online (link / carta da casa)</span>
            </label>
          </fieldset>
          <h3 style={{ margin: "16px 0 8px", fontSize: 16 }}>Ordini web (vetrina)</h3>
          <fieldset style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "12px 14px", margin: "0 0 12px" }}>
            <legend style={{ padding: "0 6px", fontSize: 13, fontWeight: 600 }}>Accettazione ordini</legend>
            <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", marginBottom: 10 }}>
              <input
                type="radio"
                name="ordini_web_accettazione_mode"
                checked={p.ordini_web_accettazione_mode !== "manuale"}
                onChange={() => setParam("ordini_web_accettazione_mode", "auto")}
                style={{ marginTop: 4 }}
              />
              <span>
                <strong>Automatica</strong> — il sistema accetta l&apos;ordine in base alla capacità (pizze ogni 15 min /
                fasce orarie). La cassa riceve comunque l&apos;avviso in sala se configurato.
              </span>
            </label>
            <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
              <input
                type="radio"
                name="ordini_web_accettazione_mode"
                checked={p.ordini_web_accettazione_mode === "manuale"}
                onChange={() => setParam("ordini_web_accettazione_mode", "manuale")}
                style={{ marginTop: 4 }}
              />
              <span>
                <strong>Manuale in cassa</strong> — ogni ordine web resta in attesa: la cassa deve accettarlo, spostare
                l&apos;orario o rifiutarlo. Non entra in cucina finché non è accettato.
              </span>
            </label>
          </fieldset>
          <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={p.stampa_comanda_ordine_web_automatica}
              onChange={(e) => setParam("stampa_comanda_ordine_web_automatica", e.target.checked)}
              style={{ marginTop: 4 }}
            />
            <span>
              Stampa comanda automatica in sala per nuovi ordini web (se attiva, non vengono accodate notifiche
              opzionali — configura comunque la stampa in cassa). In modalità manuale le notifiche restano attive.
            </span>
          </label>
          {!p.stampa_comanda_ordine_web_automatica ? (
            <div
              style={{
                marginTop: 12,
                padding: 12,
                borderRadius: 8,
                border: "1px solid #e2e8f0",
                background: "#f8fafc",
                fontSize: 13,
                lineHeight: 1.5,
              }}
            >
              <h4 style={{ margin: "0 0 10px", fontSize: 14 }}>Notifica staff (coda — adapter da completare)</h4>
              <p style={{ margin: "0 0 10px", color: "#64748b" }}>
                Percorso alternativo alla stampa. Gli invii automatici email/SMS/WhatsApp sono predisposti nel codice
                ma richiedono ancora le API del provider scelto dal locale. Vedi{" "}
                <code>docs/NOTIFICHE_INTEGRAZIONE.md</code>.
              </p>
              <label style={{ display: "block", marginBottom: 10 }}>
                Canale preferito
                <select
                  value={p.notifica_ordine_web_canale}
                  onChange={(e) => setParam("notifica_ordine_web_canale", e.target.value)}
                  style={{ display: "block", width: "100%", marginTop: 4, padding: 8 }}
                >
                  <option value={NOTIFICATION_CHANNELS.EMAIL}>Email (SMTP — da implementare)</option>
                  <option value={NOTIFICATION_CHANNELS.SMS}>SMS (gateway — da implementare)</option>
                  <option value={NOTIFICATION_CHANNELS.WHATSAPP}>WhatsApp API (da implementare)</option>
                  <option value={NOTIFICATION_CHANNELS.IN_APP}>Solo in-app (cucina/cassa/delivery)</option>
                </select>
              </label>
              <label style={{ display: "block", marginBottom: 10 }}>
                Email staff (override, opzionale)
                <input
                  type="email"
                  value={p.notifica_ordine_web_email}
                  onChange={(e) => setParam("notifica_ordine_web_email", e.target.value)}
                  placeholder="Default: email fatturazione tenant"
                  style={{ display: "block", width: "100%", marginTop: 4, padding: 8 }}
                />
              </label>
              <label style={{ display: "block", marginBottom: 10 }}>
                Telefono SMS staff
                <input
                  type="tel"
                  value={p.notifica_ordine_web_telefono_sms}
                  onChange={(e) => setParam("notifica_ordine_web_telefono_sms", e.target.value)}
                  placeholder="+39..."
                  style={{ display: "block", width: "100%", marginTop: 4, padding: 8 }}
                />
              </label>
              <label style={{ display: "block", marginBottom: 10 }}>
                Telefono WhatsApp staff
                <input
                  type="tel"
                  value={p.notifica_ordine_web_telefono_whatsapp}
                  onChange={(e) => setParam("notifica_ordine_web_telefono_whatsapp", e.target.value)}
                  placeholder="+39..."
                  style={{ display: "block", width: "100%", marginTop: 4, padding: 8 }}
                />
              </label>
              <ul style={{ margin: 0, paddingLeft: 18, color: "#64748b", fontSize: 12 }}>
                {Object.entries(notificationAdapterReadiness()).map(([key, v]) => (
                  <li key={key}>
                    {v.label}: {v.ready ? "pronto" : "da integrare"} — {v.note}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={p.chiusura_giornata_automatica}
              onChange={(e) => setParam("chiusura_giornata_automatica", e.target.checked)}
              style={{ marginTop: 4 }}
            />
            <span>
              Chiusura giornata automatica in cassa (dopo l’orario di chiusura: alle 23:59 se chiusura è 00:00, altrimenti un’ora dopo l’orario di chiusura del giorno).
            </span>
          </label>
          <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={p.vetrina_consegna_filtro_quarto_attivo !== false}
              onChange={(e) => setParam("vetrina_consegna_filtro_quarto_attivo", e.target.checked)}
              style={{ marginTop: 4 }}
            />
            <span>
              <strong>Checkout consegna (vetrina):</strong> limita le fasce orarie al solo quarto d’ora scelto fino all’ora indicata
              (es. solo :45 fino alle 15:00). Dopo quell’ora il cliente vede tutti i quarti d’ora. Disattiva per mostrare sempre
              :00, :15, :30, :45 (dopo il tempo minimo di preparazione).
            </span>
          </label>
          <label>
            Ora fino a cui applica il filtro (0–23, esclusa: dopo l’ora indicata si usano tutti i quarti)
            <input
              type="number"
              min={0}
              max={23}
              placeholder="15"
              value={p.vetrina_consegna_filtro_quarto_ora_fine === "" ? "" : p.vetrina_consegna_filtro_quarto_ora_fine}
              onChange={(e) => setParam("vetrina_consegna_filtro_quarto_ora_fine", e.target.value === "" ? "" : e.target.value)}
              style={{ marginTop: 6, padding: "8px 10px", width: "100%", boxSizing: "border-box" }}
            />
          </label>
          <label>
            Minuto della fascia (in quell’intervallo orario)
            <select
              value={p.vetrina_consegna_filtro_quarto_minuto || "45"}
              onChange={(e) => setParam("vetrina_consegna_filtro_quarto_minuto", e.target.value)}
              style={{ marginTop: 6, padding: "8px 10px", width: "100%", boxSizing: "border-box" }}
            >
              <option value="0">:00</option>
              <option value="15">:15</option>
              <option value="30">:30</option>
              <option value="45">:45</option>
            </select>
          </label>

          <h3 style={{ margin: "20px 0 8px", fontSize: 16 }}>Consegne / rider (logistica)</h3>
          <p className="dati-pizzeria-hint" style={{ marginBottom: 12, lineHeight: 1.5 }}>
            Parametri per pianificazione percorsi (Google Maps), soglie ritardo e evidenziazione in cucina/bancone. Il ricalcolo
            percorsi non sposta ordini già in forno (regola operativa). Valori modificabili in qualsiasi momento.
          </p>
          <label>
            Velocità media pianificazione (km/h)
            <input
              type="number"
              min={5}
              max={120}
              value={p.rider_velocita_media_kmh === "" ? "" : p.rider_velocita_media_kmh}
              onChange={(e) => setParam("rider_velocita_media_kmh", e.target.value === "" ? "" : e.target.value)}
              style={{ marginTop: 6, padding: "8px 10px", width: "100%", boxSizing: "border-box" }}
            />
          </label>
          <label>
            Velocità in condizioni avverse (km/h, più bassa = tempi più lunghi)
            <input
              type="number"
              min={5}
              max={120}
              value={p.rider_velocita_mal_tempo_kmh === "" ? "" : p.rider_velocita_mal_tempo_kmh}
              onChange={(e) => setParam("rider_velocita_mal_tempo_kmh", e.target.value === "" ? "" : e.target.value)}
              style={{ marginTop: 6, padding: "8px 10px", width: "100%", boxSizing: "border-box" }}
            />
          </label>
          <label>
            Soglia ritardo consegne (minuti) per allarmi tra reparti
            <input
              type="number"
              min={1}
              max={180}
              value={p.rider_ritardo_soglia_min === "" ? "" : p.rider_ritardo_soglia_min}
              onChange={(e) => setParam("rider_ritardo_soglia_min", e.target.value === "" ? "" : e.target.value)}
              style={{ marginTop: 6, padding: "8px 10px", width: "100%", boxSizing: "border-box" }}
            />
          </label>
          <label>
            Tempo medio al citofono / consegna fisica (minuti per fermata)
            <input
              type="number"
              min={0}
              max={60}
              value={p.rider_tempo_fermata_cliente_min === "" ? "" : p.rider_tempo_fermata_cliente_min}
              onChange={(e) => setParam("rider_tempo_fermata_cliente_min", e.target.value === "" ? "" : e.target.value)}
              style={{ marginTop: 6, padding: "8px 10px", width: "100%", boxSizing: "border-box" }}
            />
          </label>
          <label>
            Evidenza forno — minuti prima della scadenza “pronto per partenza rider” (cucina / pizzaioli)
            <input
              type="number"
              min={1}
              max={120}
              value={p.rider_forno_evidenza_min === "" ? "" : p.rider_forno_evidenza_min}
              onChange={(e) => setParam("rider_forno_evidenza_min", e.target.value === "" ? "" : e.target.value)}
              style={{ marginTop: 6, padding: "8px 10px", width: "100%", boxSizing: "border-box" }}
            />
          </label>
          <label>
            Buffer partenza rider (minuti prima dell’orario cliente) — bancone pronto
            <input
              type="number"
              min={0}
              max={60}
              value={p.rider_partenza_buffer_min === "" ? "" : p.rider_partenza_buffer_min}
              onChange={(e) => setParam("rider_partenza_buffer_min", e.target.value === "" ? "" : e.target.value)}
              style={{ marginTop: 6, padding: "8px 10px", width: "100%", boxSizing: "border-box" }}
            />
          </label>
          <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={p.rider_ricalcolo_automatico}
              onChange={(e) => setParam("rider_ricalcolo_automatico", e.target.checked)}
              style={{ marginTop: 4 }}
            />
            <span>
              Ricalcolo automatico consegne (quando il modulo sarà attivo; altrimenti resta solo ricalcolo manuale in cassa).
            </span>
          </label>

          <label>
            Tempo di preparazione pizza in minuti 
            <input
              type="number"
              min={1}
              placeholder="es. 5"
              value={p.tempo_preparazione_pizza === "" ? "" : p.tempo_preparazione_pizza}
              onChange={(e) => setParam("tempo_preparazione_pizza", e.target.value === "" ? "" : e.target.value)}
              style={{ marginTop: 6, padding: "8px 10px", width: "100%", boxSizing: "border-box" }}
            />
          </label>
          <label>
            Soglia giallo (pizze sotto il max per mostrare slot in giallo)
            <input
              type="number"
              min={0}
              placeholder="es. 10"
              value={p.soglia_giallo_pizze === "" ? "" : p.soglia_giallo_pizze}
              onChange={(e) => setParam("soglia_giallo_pizze", e.target.value === "" ? "" : e.target.value)}
              style={{ marginTop: 6, padding: "8px 10px", width: "100%", boxSizing: "border-box" }}
            />
          </label>
          <h3 style={{ margin: "16px 0 8px", fontSize: 16 }}>Comanda</h3>
          <label>
            Numero copie comanda
            <input
              type="number"
              min={1}
              placeholder="es. 1"
              value={p.comanda_copie === "" ? "" : p.comanda_copie}
              onChange={(e) => setParam("comanda_copie", e.target.value === "" ? "" : e.target.value)}
              style={{ marginTop: 6, padding: "8px 10px", width: "100%", boxSizing: "border-box" }}
            />
          </label>
          <label>
            Dimensione carattere comanda
            <input
              type="number"
              min={9}
              max={24}
              placeholder="es. 13"
              value={p.comanda_font_size === "" ? "" : p.comanda_font_size}
              onChange={(e) => setParam("comanda_font_size", e.target.value === "" ? "" : e.target.value)}
              style={{ marginTop: 6, padding: "8px 10px", width: "100%", boxSizing: "border-box" }}
            />
          </label>
          <label>
            Stampanti comanda (una per riga o separate da virgola)
            <textarea
              rows={3}
              placeholder="es. Cucina, Bancone"
              value={p.comanda_stampanti || ""}
              onChange={(e) => setParam("comanda_stampanti", e.target.value)}
              style={{ marginTop: 6, padding: "8px 10px", width: "100%", boxSizing: "border-box", resize: "vertical" }}
            />
          </label>
        </div>
      </section>

      {foodcostModalOpen && foodcostMismatchCount > 0 ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            zIndex: 10050,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setFoodcostModalOpen(false)}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 10,
              maxWidth: 560,
              width: "100%",
              padding: "16px 18px",
              border: "1px solid #fecaca",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 8px", fontSize: 18, color: "#991b1b" }}>Controllo foodcost/listino</h3>
            <p style={{ margin: "0 0 12px", fontSize: 14, lineHeight: 1.5, color: "#334155" }}>
              Rilevati <strong>{foodcostMismatchCount}</strong> prodotti con prezzo listino non coerente rispetto al costo ingredienti.
              Aggiorna i prezzi in menu prima del servizio.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" className="dashboard-settings-btn-secondary" onClick={() => setFoodcostModalOpen(false)}>
                Chiudi
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <section className="dashboard-box dashboard-settings-section" style={{ marginTop: 24 }}>
        <h2 className="dashboard-page-title" style={{ fontSize: 18, marginBottom: 12 }}>
          Promozioni per giorno e fascia oraria
        </h2>
        <PromozioniCalendarioEditor
          categories={promoCategories}
          value={p.promozioni_calendario}
          onChange={(v) => setParam("promozioni_calendario", v)}
        />
      </section>

      <div className="dashboard-settings-actions" style={{ marginTop: 16 }}>
        <button type="button" className="btn-primary-dashboard" onClick={handleSave} disabled={saving}>
          {saving ? "Salvataggio..." : "Salva"}
        </button>
      </div>
    </div>
  );
}
