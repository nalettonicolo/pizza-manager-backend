import { useEffect, useMemo, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { getPublicTenantInfo } from "@/features/services/publicService"
import { signUpCliente } from "@/features/public/services/clienteAuthService"
import Loader from "@/components/feedback/Loader"
import ErrorState from "@/components/feedback/ErrorState"
import { loadGoogleMapsScript } from "@/lib/googleMapsLoader"
import {
  formatIndirizzoFromGoogleAddressComponents,
} from "@/utils/formatIndirizzoItaliano"
import { getDeliveryPolygonOuterRing } from "@/utils/deliveryArea"
import "@/styles/login.css"

const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY

export default function ClienteRegistrazionePage() {
  const [tenant, setTenant] = useState(null)
  const [loadingTenant, setLoadingTenant] = useState(true)
  const [tenantError, setTenantError] = useState(null)

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [nome, setNome] = useState("")
  const [telefono, setTelefono] = useState("")
  const [indirizzo, setIndirizzo] = useState("")
  const [coords, setCoords] = useState(null)
  const [noteConsegna, setNoteConsegna] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [doneMessage, setDoneMessage] = useState(null)
  const indirizzoInputRef = useRef(null)
  const autocompleteRef = useRef(null)
  const mapRef = useRef(null)
  const polygonRef = useRef(null)
  const markerRef = useRef(null)
  const mapContainerRef = useRef(null)
  const mapClickListenerRef = useRef(null)

  const deliveryRing = useMemo(() => getDeliveryPolygonOuterRing(tenant?.parametri_operativi), [tenant?.parametri_operativi])

  function syncCoordsFromLatLng(lat, lng) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
    setCoords({ lat, lng })
  }

  function ensureDeliveryMarker(g) {
    if (!mapRef.current) return
    if (!markerRef.current) {
      markerRef.current = new g.maps.Marker({
        map: mapRef.current,
        draggable: true,
        title: "Trascina per indicare il punto di consegna",
      })
      markerRef.current.addListener("dragend", () => {
        const pos = markerRef.current?.getPosition()
        if (!pos) return
        syncCoordsFromLatLng(pos.lat(), pos.lng())
      })
    }
    markerRef.current.setDraggable(true)
  }

  useEffect(() => {
    let c = false
    ;(async () => {
      try {
        setLoadingTenant(true)
        setTenantError(null)
        const t = await getPublicTenantInfo()
        if (!c) {
          if (!t?.id) setTenantError("Impossibile identificare la pizzeria da questo dominio.")
          else setTenant(t)
        }
      } catch (e) {
        if (!c) setTenantError(e?.message || "Errore caricamento.")
      } finally {
        if (!c) setLoadingTenant(false)
      }
    })()
    return () => {
      c = true
    }
  }, [])

  useEffect(() => {
    if (!GOOGLE_API_KEY || loadingTenant || !tenant?.id || !indirizzoInputRef.current) return
    let cancelled = false
    async function initAutocomplete() {
      try {
        await loadGoogleMapsScript(GOOGLE_API_KEY, "places")
        if (cancelled || !indirizzoInputRef.current) return
        const g = window.google
        const placesLib = await g.maps.importLibrary("places")
        if (cancelled || !indirizzoInputRef.current) return
        const Autocomplete = placesLib.Autocomplete ?? g.maps.places?.Autocomplete
        if (!Autocomplete) return
        if (autocompleteRef.current) {
          g.maps.event.clearInstanceListeners(autocompleteRef.current)
          autocompleteRef.current = null
        }
        const inputEl = indirizzoInputRef.current
        const ac = new Autocomplete(inputEl, {
          componentRestrictions: { country: "it" },
          fields: ["address_components", "formatted_address", "geometry"],
          types: ["address"],
        })
        autocompleteRef.current = ac
        ac.addListener("place_changed", () => {
          const place = ac.getPlace()
          if (!place) return
          const components = place.address_components || place.addressComponents || []
          const fromComponents = formatIndirizzoFromGoogleAddressComponents(components)
          const formatted = fromComponents || place.formatted_address || place.formattedAddress || ""
          if (formatted) {
            inputEl.value = formatted
            setIndirizzo(formatted)
          }
          const loc = place.geometry?.location
          if (loc) {
            const lat = typeof loc.lat === "function" ? loc.lat() : loc.lat
            const lng = typeof loc.lng === "function" ? loc.lng() : loc.lng
            if (Number.isFinite(lat) && Number.isFinite(lng)) syncCoordsFromLatLng(lat, lng)
          }
        })
      } catch {
        /* ignore maps errors */
      }
    }
    void initAutocomplete()
    return () => {
      cancelled = true
      if (autocompleteRef.current && window.google?.maps?.event) {
        window.google.maps.event.clearInstanceListeners(autocompleteRef.current)
        autocompleteRef.current = null
      }
    }
  }, [loadingTenant, tenant?.id])

  useEffect(() => {
    if (!GOOGLE_API_KEY || loadingTenant || !tenant?.id || !mapContainerRef.current) return
    let cancelled = false
    async function initMap() {
      try {
        await loadGoogleMapsScript(GOOGLE_API_KEY, "places")
        if (cancelled || !mapContainerRef.current) return
        const g = window.google
        const mapOptions = {
          center: { lat: 45.4642, lng: 9.19 },
          zoom: 11,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          scrollwheel: true,
          gestureHandling: "greedy",
        }
        if (!mapRef.current) {
          mapRef.current = new g.maps.Map(mapContainerRef.current, mapOptions)
          if (mapClickListenerRef.current) {
            g.maps.event.removeListener(mapClickListenerRef.current)
          }
          mapClickListenerRef.current = mapRef.current.addListener("click", (ev) => {
            const ll = ev.latLng
            if (!ll) return
            syncCoordsFromLatLng(ll.lat(), ll.lng())
          })
        } else {
          mapRef.current.setOptions(mapOptions)
        }
        ensureDeliveryMarker(g)
        if (polygonRef.current) {
          polygonRef.current.setMap(null)
          polygonRef.current = null
        }
        if (Array.isArray(deliveryRing) && deliveryRing.length > 2) {
          const path = deliveryRing
            .map((p) => ({ lng: Number(p?.[0]), lat: Number(p?.[1]) }))
            .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
          if (path.length > 2) {
            polygonRef.current = new g.maps.Polygon({
              paths: path,
              strokeColor: "#0f766e",
              strokeOpacity: 0.9,
              strokeWeight: 2,
              fillColor: "#2dd4bf",
              fillOpacity: 0.18,
              map: mapRef.current,
            })
            const bounds = new g.maps.LatLngBounds()
            path.forEach((p) => bounds.extend(p))
            mapRef.current.fitBounds(bounds)
          }
        }
      } catch {
        /* ignore maps errors */
      }
    }
    void initMap()
    return () => {
      cancelled = true
      if (mapClickListenerRef.current && window.google?.maps?.event) {
        window.google.maps.event.removeListener(mapClickListenerRef.current)
        mapClickListenerRef.current = null
      }
    }
  }, [deliveryRing, loadingTenant, tenant?.id])

  useEffect(() => {
    if (!coords || !mapRef.current || !window.google?.maps) return
    const g = window.google
    ensureDeliveryMarker(g)
    markerRef.current.setPosition(coords)
    markerRef.current.setVisible(true)
    mapRef.current.panTo(coords)
  }, [coords])

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setDoneMessage(null)
    if (!tenant?.id) return
    if (password.length < 6) {
      setError("La password deve avere almeno 6 caratteri.")
      return
    }
    setBusy(true)
    try {
      const { data, error: err } = await signUpCliente({
        email,
        password,
        tenantId: tenant.id,
        nome,
        telefono,
        indirizzo,
        latitudine: coords?.lat ?? null,
        longitudine: coords?.lng ?? null,
        noteConsegna,
      })
      if (err) {
        setError(err.message || "Registrazione non riuscita.")
        return
      }
      if (data?.session) {
        setDoneMessage("Account creato. Reindirizzamento…")
        window.location.assign("/cliente/dashboard")
        return
      }
      setDoneMessage(
        "Ti abbiamo inviato un’email di conferma. Apri il link per attivare l’account, poi accedi da Login.",
      )
    } catch (ex) {
      setError(ex?.message || "Errore imprevisto.")
    } finally {
      setBusy(false)
    }
  }

  if (loadingTenant) return <Loader />
  if (tenantError) return <ErrorState message={tenantError} />
  if (!tenant) return <ErrorState message="Tenant non disponibile." />

  return (
    <div className="login-page">
      <div className="login-page-inner">
        <div className="login-card">
          <div className="login-brand">
            <div className="login-brand-mark" aria-hidden="true">
              🍕
            </div>
            <h1 className="login-brand-title">Crea il tuo account</h1>
            <p className="login-brand-sub">
              Ordini e profilo per <strong>{tenant.nome || "la pizzeria"}</strong>. Dopo la registrazione potrai accedere al
              menu e (in seguito) completare gli ordini online.
            </p>
          </div>

          {doneMessage ? (
            <p className="login-error" style={{ color: "#166534", background: "#ecfdf5", border: "1px solid #a7f3d0" }}>
              {doneMessage}
            </p>
          ) : (
            <form className="login-form" onSubmit={handleSubmit} noValidate>
              <div className="login-field">
                <label className="login-label" htmlFor="reg-nome">
                  Nome e cognome
                </label>
                <input
                  id="reg-nome"
                  className="login-input"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  autoComplete="name"
                />
              </div>
              <div className="login-field">
                <label className="login-label" htmlFor="reg-email">
                  Email
                </label>
                <input
                  id="reg-email"
                  type="email"
                  className="login-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <div className="login-field">
                <label className="login-label" htmlFor="reg-tel">
                  Telefono
                </label>
                <input
                  id="reg-tel"
                  type="tel"
                  className="login-input"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  autoComplete="tel"
                />
              </div>
              <div className="login-field">
                <label className="login-label" htmlFor="reg-ind">
                  Indirizzo (utile per consegne)
                </label>
                <input
                  id="reg-ind"
                  key={tenant.id}
                  ref={indirizzoInputRef}
                  className="login-input login-input--places"
                  defaultValue={indirizzo}
                  onBlur={(e) => setIndirizzo(e.target.value)}
                  onChange={(e) => setIndirizzo(e.target.value)}
                  placeholder={GOOGLE_API_KEY ? "Via, civico, città" : undefined}
                  autoComplete="off"
                />
                <p className="login-brand-sub" style={{ fontSize: 12, marginTop: 6, lineHeight: 1.45 }}>
                  Inserisci l&apos;indirizzo completo (via, numero civico, città) e seleziona un suggerimento Google. Sulla
                  mappa puoi <strong>trascinare il puntatore</strong> o <strong>cliccare sulla posizione</strong> per
                  indicare con precisione il punto di consegna.
                </p>
                {GOOGLE_API_KEY ? (
                  <div
                    ref={mapContainerRef}
                    className="login-registrazione-mappa"
                    style={{
                      marginTop: 10,
                      width: "100%",
                      height: 220,
                      borderRadius: 12,
                      border: "1px solid #d0d8e6",
                      overflow: "hidden",
                    }}
                    aria-label="Mappa punto di consegna: trascina il puntatore o clicca sulla mappa"
                  />
                ) : null}
                {GOOGLE_API_KEY && coords ? (
                  <p className="login-brand-sub" style={{ fontSize: 12, marginTop: 6, color: "#0f766e" }}>
                    Punto consegna impostato. Puoi spostare ancora il puntatore sulla mappa se serve.
                  </p>
                ) : null}
                {GOOGLE_API_KEY && (!deliveryRing || deliveryRing.length < 3) ? (
                  <p className="login-brand-sub" style={{ fontSize: 12, marginTop: 6 }}>
                    La mappa mostra la zona del locale quando disponibile.
                  </p>
                ) : null}
              </div>
              <div className="login-field">
                <label className="login-label" htmlFor="reg-note">
                  Note per la consegna
                </label>
                <textarea
                  id="reg-note"
                  className="login-input login-textarea"
                  value={noteConsegna}
                  onChange={(e) => setNoteConsegna(e.target.value)}
                  placeholder="Es. codice citofono, piano, scala, lasciare al portiere, campanello non funzionante…"
                  rows={3}
                  maxLength={500}
                />
                <p className="login-brand-sub" style={{ fontSize: 12, marginTop: 6, lineHeight: 1.45 }}>
                  Informazioni utili al rider: accesso al palazzo, citofono, orari particolari o altre istruzioni per il
                  recapito.
                </p>
              </div>
              <div className="login-field">
                <label className="login-label" htmlFor="reg-pw">
                  Password
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    id="reg-pw"
                    type={showPassword ? "text" : "password"}
                    className="login-input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    style={{ paddingRight: 44 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Nascondi password" : "Mostra password"}
                    style={{
                      position: "absolute",
                      right: 10,
                      top: "50%",
                      transform: "translateY(-50%)",
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      fontSize: 18,
                    }}
                  >
                    {showPassword ? "🙈" : "👁️"}
                  </button>
                </div>
              </div>
              {error ? (
                <p className="login-error" role="alert">
                  {error}
                </p>
              ) : null}
              <p className="login-brand-sub" style={{ fontSize: 13, color: "#64748b", marginBottom: 12, lineHeight: 1.5 }}>
                Registrandoti confermi di aver letto l&apos;{" "}
                <Link to="/privacy" style={{ color: "#c0392b", fontWeight: 600 }}>
                  informativa sulla privacy
                </Link>{" "}
                e la{" "}
                <Link to="/cookie" style={{ color: "#c0392b", fontWeight: 600 }}>
                  cookie policy
                </Link>
                . Ti invieremo un&apos;email per confermare l&apos;indirizzo prima di poter ordinare online.
              </p>
              <button type="submit" className="login-submit" disabled={busy}>
                {busy ? "Registrazione…" : "Registrati"}
              </button>
            </form>
          )}

          <div className="login-footer-links">
            <Link to="/login" className="login-back">
              Hai già un account? Accedi
            </Link>
            <Link to="/" className="login-back">
              ← Menù
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
