import { useState, useRef, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { useTenant } from "@/app/contexts/TenantContext";
import { updateTenantSettings } from "@/features/admin/services/adminService";

const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse";

function loadGoogleMapsScript(apiKey) {
  return new Promise((resolve, reject) => {
    if (window.google?.maps?.places) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Caricamento Google Maps fallito"));
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
      const payload = {
        nome: settings.nome ?? "",
        telefono: settings.telefono ?? "",
        indirizzo: settings.indirizzo ?? "",
        email: settings.email ?? "",
      };
      if (settings.lat != null) payload.lat = settings.lat;
      if (settings.lng != null) payload.lng = settings.lng;
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

      <div className="dashboard-settings-actions">
        <button type="button" className="btn-primary-dashboard" onClick={handleSave} disabled={saving}>
          {saving ? "Salvataggio..." : "Salva"}
        </button>
      </div>
    </div>
  );
}
