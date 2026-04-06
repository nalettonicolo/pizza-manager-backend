import { useState, useRef, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { useTenant } from "@/app/contexts/TenantContext";
import { updateTenantSettings } from "@/features/admin/services/adminService";
import { KEY_TITOLARE_ESERCENTE } from "@/config/legalEntity";

const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse";

function loadGoogleMapsScript(apiKey) {
  return new Promise((resolve, reject) => {
    if (window.google?.maps?.places) {
      resolve();
      return;
    }
    const cbName = `__pmGoogleMapsCb_${Math.random().toString(36).slice(2, 11)}`;
    window[cbName] = () => {
      try {
        delete window[cbName];
      } catch (_) {
        window[cbName] = undefined;
      }
      resolve();
    };
    const script = document.createElement("script");
    /* loading=async + callback: pattern raccomandato da Google (evita warning "without loading=async"). */
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&loading=async&callback=${encodeURIComponent(cbName)}`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      try {
        delete window[cbName];
      } catch (_) {
        /* ignore */
      }
      reject(new Error("Caricamento Google Maps fallito"));
    };
    document.head.appendChild(script);
  });
}

export default function DatiPizzeriaSection() {
  const { settings, setSettings } = useOutletContext();
  const { tenantId, refreshTenant } = useTenant();
  const [saving, setSaving] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState(null);
  const addressInputRef = useRef(null);
  const autocompleteRef = useRef(null);

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

  // Mappa: query per iframe (subito visibile, aggiornata in base a indirizzo o lat/lng)
  const mapQuery =
    lat != null && lng != null && !Number.isNaN(Number(lat)) && !Number.isNaN(Number(lng))
      ? `${lat},${lng}`
      : indirizzo.trim() || "Italia";
  const mapEmbedUrl = `https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&output=embed`;

  // Google Places Autocomplete (solo se è configurata la API key)
  useEffect(() => {
    if (!GOOGLE_API_KEY || !addressInputRef.current) return;
    let cancelled = false;
    loadGoogleMapsScript(GOOGLE_API_KEY)
      .then(() => {
        if (cancelled || !addressInputRef.current) return;
        if (autocompleteRef.current) return; // già inizializzato
        const Autocomplete = window.google?.maps?.places?.Autocomplete;
        if (!Autocomplete) return;
        const ac = new Autocomplete(addressInputRef.current, {
          types: ["address"],
          fields: ["formatted_address", "geometry"],
        });
        ac.addListener("place_changed", () => {
          const place = ac.getPlace();
          if (!place?.formatted_address) return;
          const loc = place.geometry?.location;
          setSettings((s) => ({
            ...s,
            indirizzo: place.formatted_address,
            ...(loc ? { lat: loc.lat(), lng: loc.lng() } : {}),
          }));
        });
        autocompleteRef.current = ac;
      })
      .catch((err) => console.warn("Google Places Autocomplete:", err));
    return () => {
      cancelled = true;
    };
  }, [GOOGLE_API_KEY, setSettings]);

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
          const res = await fetch(
            `${NOMINATIM_URL}?lat=${latitude}&lon=${longitude}&format=json`,
            { headers: { Accept: "application/json", "User-Agent": "PizzaManagerApp/1.0" } }
          );
          const data = await res.json();
          const address = data?.display_name ?? `${latitude}, ${longitude}`;
          setSettings((s) => ({
            ...s,
            indirizzo: address,
            lat: latitude,
            lng: longitude,
          }));
        } catch (e) {
          setGeoError("Impossibile ottenere l'indirizzo dalla posizione.");
          setSettings((s) => ({
            ...s,
            lat: latitude,
            lng: longitude,
            indirizzo: indirizzo || `${latitude}, ${longitude}`,
          }));
        } finally {
          setGeoLoading(false);
        }
      },
      () => {
        setGeoError("Impossibile ottenere la posizione. Abilita la geolocalizzazione per il sito.");
        setGeoLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }

  async function handleSave() {
    if (!tenantId || !settings) return;
    try {
      setSaving(true);
      const prevPo =
        settings.parametri_operativi && typeof settings.parametri_operativi === "object"
          ? { ...settings.parametri_operativi }
          : {};
      const titolareEsercente =
        typeof prevPo[KEY_TITOLARE_ESERCENTE] === "string" ? prevPo[KEY_TITOLARE_ESERCENTE].trim() : "";
      prevPo[KEY_TITOLARE_ESERCENTE] = titolareEsercente;

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
              <input
                ref={addressInputRef}
                type="text"
                value={indirizzo}
                onChange={(e) => setSettings({ ...settings, indirizzo: e.target.value })}
                placeholder="Es. Via Roma 1, Roma"
                autoComplete="off"
              />
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
              <p className="dati-pizzeria-hint">Scrivi per vedere i suggerimenti indirizzi (Google Places).</p>
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
          <code>{"{{pec}}"}</code>, <code>{"{{indirizzo}}"}</code>, <code>{"{{email}}"}</code>. Se lasci vuoti, restano i
          testi predefiniti dell&apos;app.
        </p>
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
            <textarea
              rows={5}
              value={settings?.privacy_policy_html || ""}
              onChange={(e) => setSettings({ ...settings, privacy_policy_html: e.target.value })}
              placeholder="<p>Informativa personalizzata… {{nome_attivita}}</p>"
            />
          </label>
          <label>
            Cookie policy (HTML, opzionale)
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
