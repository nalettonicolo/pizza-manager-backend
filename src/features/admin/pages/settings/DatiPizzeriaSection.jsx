import { useState, useRef, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { useTenant } from "@/app/contexts/TenantContext";
import {
  updateTenantSettings,
  saveTenantStripeSecret,
  fetchTenantStripeSecretConfigured,
} from "@/features/admin/services/adminService";
import { KEY_TITOLARE_ESERCENTE } from "@/config/legalEntity";
import { loadGoogleMapsScript } from "@/lib/googleMapsLoader";
import {
  formatIndirizzoFromNominatim,
  formatIndirizzoFromGoogleAddressComponents,
} from "@/utils/formatIndirizzoItaliano";

const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse";
const DEFAULT_PRIVACY_TEMPLATE =
  `<h2>Informativa privacy</h2>
<p>La presente informativa descrive il trattamento dei dati personali degli utenti che visitano il sito <strong>{{nome_attivita}}</strong>, ai sensi del Regolamento (UE) 2016/679 (GDPR).</p>
<h3>Titolare del trattamento</h3>
<p>Titolare: <strong>{{ragione_sociale}}</strong>. Sede: {{indirizzo}}. Email: {{email}}. PEC: {{pec}}. P.IVA: {{piva}}.</p>
<h3>Finalita' e base giuridica</h3>
<p>I dati sono trattati per gestione richieste, ordini online, assistenza clienti e adempimenti di legge (art. 6, par. 1, lett. b, c e f GDPR).</p>
<h3>Conservazione</h3>
<p>I dati sono conservati per il tempo necessario all'erogazione del servizio e agli obblighi fiscali/legali applicabili.</p>
<h3>Diritti dell'interessato</h3>
<p>L'interessato puo' esercitare i diritti previsti dagli artt. 15-22 GDPR contattando {{email}}. E' sempre possibile proporre reclamo al Garante Privacy.</p>`;
const DEFAULT_COOKIE_TEMPLATE =
  `<h2>Cookie policy</h2>
<p>Il sito <strong>{{nome_attivita}}</strong> utilizza cookie tecnici necessari al corretto funzionamento del menu e delle funzionalita' di navigazione.</p>
<h3>Tipologie utilizzate</h3>
<ul>
  <li>Cookie tecnici di sessione e sicurezza (necessari).</li>
  <li>Cookie di preferenza, ove attivati.</li>
</ul>
<h3>Cookie di profilazione o terze parti</h3>
<p>Non vengono installati cookie di profilazione senza consenso. Se in futuro verranno introdotti strumenti di analisi/marketing, sara' richiesto il consenso secondo normativa.</p>
<h3>Gestione cookie</h3>
<p>E' possibile gestire o disabilitare i cookie dalle impostazioni del browser. La disattivazione dei cookie tecnici puo' compromettere alcune funzionalita'.</p>`;

export default function DatiPizzeriaSection() {
  const { settings, setSettings } = useOutletContext();
  const { tenantId, refreshTenant } = useTenant();
  const [saving, setSaving] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState(null);
  const [geoResetKey, setGeoResetKey] = useState(0);
  const [stripeSecretInput, setStripeSecretInput] = useState("");
  const [stripeSecretSaving, setStripeSecretSaving] = useState(false);
  const [stripeSecretConfigured, setStripeSecretConfigured] = useState(false);
  const placeAcContainerRef = useRef(null);
  const placeAcCleanupRef = useRef(() => {});

  const indirizzo = settings?.indirizzo ?? "";
  const lat = settings?.lat;
  const lng = settings?.lng;
  const parametriOperativi =
    settings?.parametri_operativi && typeof settings.parametri_operativi === "object"
      ? settings.parametri_operativi
      : {};
  const titolareEsercente =
    typeof parametriOperativi[KEY_TITOLARE_ESERCENTE] === "string"
      ? parametriOperativi[KEY_TITOLARE_ESERCENTE]
      : "";

  const mapQuery =
    lat != null && lng != null && !Number.isNaN(Number(lat)) && !Number.isNaN(Number(lng))
      ? `${lat},${lng}`
      : indirizzo.trim() || "Italia";
  const mapEmbedUrl = `https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&output=embed`;

  useEffect(() => {
    if (!tenantId) return;
    let cancelled = false;
    void (async () => {
      try {
        const ok = await fetchTenantStripeSecretConfigured(tenantId);
        if (!cancelled) setStripeSecretConfigured(!!ok);
      } catch {
        if (!cancelled) setStripeSecretConfigured(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  useEffect(() => {
    if (!GOOGLE_API_KEY || !placeAcContainerRef.current) return;
    let cancelled = false;

    async function init() {
      placeAcCleanupRef.current?.();
      placeAcCleanupRef.current = () => {};

      try {
        await loadGoogleMapsScript(GOOGLE_API_KEY, null);
        if (cancelled || !placeAcContainerRef.current) return;

        const g = window.google;
        const placesLib = await g.maps.importLibrary("places");
        if (cancelled || !placeAcContainerRef.current) return;

        const PlaceAutocompleteElement =
          placesLib.PlaceAutocompleteElement ?? g.maps.places?.PlaceAutocompleteElement;
        if (!PlaceAutocompleteElement) {
          console.warn("Google Maps: PlaceAutocompleteElement non disponibile dopo importLibrary(places).");
          return;
        }

        const el = new PlaceAutocompleteElement({
          includedRegionCodes: ["it"],
        });
        el.placeholder = "Es. Via Roma 1, Roma";
        if (indirizzo) {
          el.value = indirizzo;
        }

        placeAcContainerRef.current.innerHTML = "";
        placeAcContainerRef.current.appendChild(el);

        const onSelect = async (event) => {
          const placePrediction = event.placePrediction ?? event.detail?.placePrediction;
          if (!placePrediction) return;
          const place = placePrediction.toPlace();
          await place.fetchFields({
            fields: ["addressComponents", "formattedAddress", "location"],
          });
          const fromComponents = formatIndirizzoFromGoogleAddressComponents(place.addressComponents || []);
          const formatted = fromComponents || place.formattedAddress || "";
          if (!formatted) return;
          const loc = place.location;
          let nextLat;
          let nextLng;
          if (loc) {
            if (typeof loc.lat === "function") {
              nextLat = loc.lat();
              nextLng = loc.lng();
            } else {
              nextLat = loc.lat;
              nextLng = loc.lng;
            }
          }
          setSettings((s) => ({
            ...s,
            indirizzo: formatted,
            ...(nextLat != null && nextLng != null ? { lat: nextLat, lng: nextLng } : {}),
          }));
        };

        el.addEventListener("gmp-select", onSelect);

        placeAcCleanupRef.current = () => {
          el.removeEventListener("gmp-select", onSelect);
          try {
            el.remove();
          } catch {
            /* ignore */
          }
        };
      } catch (err) {
        console.warn("Google Places PlaceAutocompleteElement:", err);
      }
    }

    void init();

    return () => {
      cancelled = true;
      placeAcCleanupRef.current?.();
      placeAcCleanupRef.current = () => {};
    };
  }, [geoResetKey, indirizzo, setSettings]);

  useEffect(() => {
    const host = placeAcContainerRef.current?.firstElementChild;
    if (!host || typeof host.value === "undefined" || !String(indirizzo).trim()) return;
    if (!String(host.value || "").trim()) host.value = indirizzo;
  }, [indirizzo]);

  async function handleUseMyLocation() {
    if (!navigator.geolocation) {
      setGeoError("Geolocalizzazione non supportata dal browser.");
      return;
    }
    setGeoError(null);
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const revParams = new URLSearchParams({
            lat: String(latitude),
            lon: String(longitude),
            format: "json",
            addressdetails: "1",
          });
          const res = await fetch(`${NOMINATIM_URL}?${revParams}`, {
            headers: { Accept: "application/json", "User-Agent": "PizzaManagerApp/1.0" },
          });
          const data = await res.json();
          const address =
            formatIndirizzoFromNominatim({
              address: data?.address,
              display_name: data?.display_name,
            }) || data?.display_name || `${latitude}, ${longitude}`;
          setSettings((s) => ({
            ...s,
            indirizzo: address,
            lat: latitude,
            lng: longitude,
          }));
          setGeoResetKey((k) => k + 1);
        } catch {
          setGeoError("Impossibile ottenere l'indirizzo dalla posizione.");
          setSettings((s) => ({
            ...s,
            lat: latitude,
            lng: longitude,
            indirizzo: indirizzo || `${latitude}, ${longitude}`,
          }));
          setGeoResetKey((k) => k + 1);
        } finally {
          setGeoLoading(false);
        }
      },
      () => {
        setGeoError("Impossibile ottenere la posizione. Abilita la geolocalizzazione per il sito.");
        setGeoLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }

  async function handleSaveStripeSecret() {
    if (!tenantId) return;
    const s = String(stripeSecretInput || "").trim();
    if (!s.startsWith("sk_")) {
      alert("Incolla la chiave segreta Stripe (inizia con sk_test_ o sk_live_).");
      return;
    }
    try {
      setStripeSecretSaving(true);
      await saveTenantStripeSecret(tenantId, s);
      setStripeSecretInput("");
      setStripeSecretConfigured(true);
      alert("Chiave segreta Stripe salvata (non viene mostrata di nuovo).");
    } catch (err) {
      console.error(err);
      alert("Salvataggio chiave Stripe: " + (err?.message || "errore"));
    } finally {
      setStripeSecretSaving(false);
    }
  }

  async function handleSave() {
    if (!tenantId || !settings) return;
    try {
      setSaving(true);
      const prevPo =
        settings.parametri_operativi && typeof settings.parametri_operativi === "object"
          ? { ...settings.parametri_operativi }
          : {};
      const titolareTrim =
        typeof prevPo[KEY_TITOLARE_ESERCENTE] === "string" ? prevPo[KEY_TITOLARE_ESERCENTE].trim() : "";
      prevPo[KEY_TITOLARE_ESERCENTE] = titolareTrim;

      const payload = {
        nome: settings.nome ?? "",
        telefono: settings.telefono ?? "",
        indirizzo: settings.indirizzo ?? "",
        email: settings.email ?? "",
        parametri_operativi: prevPo,
      };
      if (settings.lat != null) payload.lat = settings.lat;
      if (settings.lng != null) payload.lng = settings.lng;
      if (settings.legal_ragione_sociale !== undefined) payload.legal_ragione_sociale = settings.legal_ragione_sociale || null;
      if (settings.legal_piva !== undefined) payload.legal_piva = settings.legal_piva || null;
      if (settings.legal_pec !== undefined) payload.legal_pec = settings.legal_pec || null;
      if (settings.privacy_policy_html !== undefined) payload.privacy_policy_html = settings.privacy_policy_html || null;
      if (settings.cookie_policy_html !== undefined) payload.cookie_policy_html = settings.cookie_policy_html || null;
      if (settings.pagamento_online_provider !== undefined)
        payload.pagamento_online_provider = settings.pagamento_online_provider || null;
      if (settings.stripe_publishable_key !== undefined) payload.stripe_publishable_key = settings.stripe_publishable_key || null;
      if (settings.sumup_merchant_public_id !== undefined)
        payload.sumup_merchant_public_id = settings.sumup_merchant_public_id || null;
      await updateTenantSettings(tenantId, payload);
      if (refreshTenant) await refreshTenant();
      alert("Dati pizzeria salvati.");
    } catch (err) {
      console.error(err);
      alert("Errore durante il salvataggio. " + (err?.message || ""));
    } finally {
      setSaving(false);
    }
  }

  const mapsSearchUrl =
    indirizzo.trim() || (lat != null && lng != null)
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`
      : null;

  return (
    <div className="dashboard-settings-page">
      <h1 className="dashboard-page-title">Dati pizzeria</h1>

      <section className="dashboard-box dashboard-settings-section">
        <h2 className="dashboard-settings-section-title">Anagrafica</h2>
        <div className="dashboard-settings-fields">
          <label>
            Nome pizzeria
            <input
              type="text"
              value={settings?.nome || ""}
              onChange={(e) => setSettings({ ...settings, nome: e.target.value })}
              placeholder="Es. Pizzeria Da Mario"
            />
          </label>
          <label>
            Titolare / referente legale (per privacy e cookie sul sito pubblico)
            <input
              type="text"
              value={titolareEsercente}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  parametri_operativi: {
                    ...parametriOperativi,
                    [KEY_TITOLARE_ESERCENTE]: e.target.value,
                  },
                })
              }
              placeholder="Es. Mario Rossi (nome e cognome del titolare)"
            />
            <span className="dati-pizzeria-hint" style={{ display: "block", marginTop: 6 }}>
              Comparirà nelle informative legali insieme al nome pizzeria sul dominio del locale.
            </span>
          </label>
          <label>
            Telefono
            <input
              type="text"
              value={settings?.telefono || ""}
              onChange={(e) => setSettings({ ...settings, telefono: e.target.value })}
              placeholder="Es. 06 1234567"
            />
          </label>
          <label>
            Email di contatto
            <input
              type="email"
              value={settings?.email || ""}
              onChange={(e) => setSettings({ ...settings, email: e.target.value })}
              placeholder="Es. info@pizzeria.it"
            />
          </label>
          <label>
            Indirizzo
            <div className="dati-pizzeria-address-row">
              <div ref={placeAcContainerRef} className="dati-pizzeria-gmp-ac" />
              <button
                type="button"
                className="dashboard-settings-btn-secondary dati-pizzeria-geo-btn"
                onClick={handleUseMyLocation}
                disabled={geoLoading}
                title="Usa la mia posizione (geolocalizzazione)"
              >
                {geoLoading ? "..." : "📍 Usa la mia posizione"}
              </button>
            </div>
            {geoError && <p className="dati-pizzeria-geo-error">{geoError}</p>}
            {GOOGLE_API_KEY && (
              <p className="dati-pizzeria-hint">
                Suggerimenti indirizzo con Google Places (widget PlaceAutocompleteElement). In Google Cloud abilita{" "}
                <strong>Places API (New)</strong> per il progetto della chiave Maps.
              </p>
            )}
            {mapsSearchUrl && (
              <a
                href={mapsSearchUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 13, marginTop: 4, display: "inline-block" }}
              >
                Apri in Google Maps
              </a>
            )}
            <div className="dati-pizzeria-map-wrap">
              <iframe
                title="Mappa indirizzo"
                src={mapEmbedUrl}
                width="100%"
                height="320"
                style={{ border: 0, borderRadius: 8 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </label>
        </div>
      </section>

      <section className="dashboard-box dashboard-settings-section">
        <h2 className="dashboard-settings-section-title">Vetrina web — normativa e pagamenti online</h2>
        <p className="dati-pizzeria-hint" style={{ marginBottom: 16, lineHeight: 1.55 }}>
          Testi privacy/cookie con segnaposto tipo <code>{"{{nome_attivita}}"}</code>, <code>{"{{piva}}"}</code>,{" "}
          <code>{"{{pec}}"}</code>, <code>{"{{indirizzo}}"}</code>, <code>{"{{email}}"}</code>. Se lasci i campi vuoti,
          resta la policy predefinita dell&apos;app.
        </p>
        <div
          style={{
            marginBottom: 16,
            padding: "12px 14px",
            border: "1px solid #dbeafe",
            background: "#eff6ff",
            borderRadius: 8,
            fontSize: 13,
            lineHeight: 1.55,
            color: "#1e3a8a",
          }}
        >
          <strong>Pagamenti online - come funziona:</strong>
          <br />
          <strong>Stripe</strong>: inserisci chiave pubblica <code>pk_...</code> e salva la chiave segreta{" "}
          <code>sk_...</code>. La segreta viene usata solo lato server.
          <br />
          <strong>SumUp</strong>: inserisci il merchant/public id richiesto dalla tua integrazione.
          <br />
          Il provider selezionato viene usato dalla vetrina per proporre il checkout online.
        </div>
        <div className="dashboard-settings-fields">
          <label>
            Ragione sociale (P.IVA / contratti)
            <input
              type="text"
              value={settings?.legal_ragione_sociale || ""}
              onChange={(e) => setSettings({ ...settings, legal_ragione_sociale: e.target.value })}
            />
          </label>
          <label>
            Partita IVA
            <input
              type="text"
              value={settings?.legal_piva || ""}
              onChange={(e) => setSettings({ ...settings, legal_piva: e.target.value })}
            />
          </label>
          <label>
            PEC
            <input
              type="text"
              value={settings?.legal_pec || ""}
              onChange={(e) => setSettings({ ...settings, legal_pec: e.target.value })}
            />
          </label>
          <label>
            Pagamento online — provider (predisposizione)
            <select
              value={settings?.pagamento_online_provider || ""}
              onChange={(e) => setSettings({ ...settings, pagamento_online_provider: e.target.value || null })}
            >
              <option value="">Non configurato</option>
              <option value="stripe">Stripe</option>
              <option value="sumup">SumUp</option>
            </select>
          </label>
          <label>
            Stripe — chiave pubblica (pk_…)
            <input
              type="text"
              value={settings?.stripe_publishable_key || ""}
              onChange={(e) => setSettings({ ...settings, stripe_publishable_key: e.target.value })}
              placeholder="pk_live_… o pk_test_…"
              autoComplete="off"
            />
          </label>
          <div style={{ marginBottom: 12 }}>
            <label>
              Stripe — chiave segreta (sk_…) — solo server, non esposta in vetrina
              <input
                type="password"
                value={stripeSecretInput}
                onChange={(e) => setStripeSecretInput(e.target.value)}
                placeholder={stripeSecretConfigured ? "•••• già configurata — incolla per sostituire" : "sk_test_… o sk_live_…"}
                autoComplete="off"
              />
            </label>
            <p className="dati-pizzeria-hint" style={{ marginTop: 6 }}>
              Salvata in modo riservato sul database (tabella dedicata, non visibile ai clienti). Serve alle Edge Functions per
              PaymentIntent e rimborsi. Ruolo richiesto: <strong>admin</strong>.
            </p>
            <button
              type="button"
              className="dashboard-settings-btn-secondary"
              onClick={() => void handleSaveStripeSecret()}
              disabled={stripeSecretSaving || !String(stripeSecretInput || "").trim().startsWith("sk_")}
              style={{ marginTop: 8 }}
            >
              {stripeSecretSaving ? "Salvataggio…" : "Salva chiave segreta Stripe"}
            </button>
            {stripeSecretConfigured ? (
              <span style={{ marginLeft: 10, fontSize: 13, color: "#166534", fontWeight: 600 }}>Segreto presente</span>
            ) : (
              <span style={{ marginLeft: 10, fontSize: 13, color: "#b45309" }}>Segreto mancante — il checkout online non funziona</span>
            )}
          </div>
          <label>
            SumUp — merchant / id pubblico
            <input
              type="text"
              value={settings?.sumup_merchant_public_id || ""}
              onChange={(e) => setSettings({ ...settings, sumup_merchant_public_id: e.target.value })}
              autoComplete="off"
            />
          </label>
          <label>
            Privacy policy (HTML, opzionale)
            <div style={{ marginBottom: 8 }}>
              <button
                type="button"
                className="dashboard-settings-btn-secondary"
                onClick={() => setSettings({ ...settings, privacy_policy_html: DEFAULT_PRIVACY_TEMPLATE })}
              >
                Usa modello professionale privacy
              </button>
            </div>
            <textarea
              rows={5}
              value={settings?.privacy_policy_html || ""}
              onChange={(e) => setSettings({ ...settings, privacy_policy_html: e.target.value })}
              placeholder="<p>Informativa personalizzata… {{nome_attivita}}</p>"
            />
          </label>
          <label>
            Cookie policy (HTML, opzionale)
            <div style={{ marginBottom: 8 }}>
              <button
                type="button"
                className="dashboard-settings-btn-secondary"
                onClick={() => setSettings({ ...settings, cookie_policy_html: DEFAULT_COOKIE_TEMPLATE })}
              >
                Usa modello professionale cookie
              </button>
            </div>
            <textarea
              rows={5}
              value={settings?.cookie_policy_html || ""}
              onChange={(e) => setSettings({ ...settings, cookie_policy_html: e.target.value })}
            />
          </label>
        </div>
      </section>

      <div className="dashboard-settings-actions">
        <button type="button" className="btn-primary-dashboard" onClick={handleSave} disabled={saving}>
          {saving ? "Salvataggio..." : "Salva"}
        </button>
      </div>
    </div>
  );
}
