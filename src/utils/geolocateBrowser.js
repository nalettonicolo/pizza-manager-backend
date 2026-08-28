import { formatIndirizzoFromNominatim } from "@/utils/formatIndirizzoItaliano"

const NOMINATIM_REVERSE_URL = "https://nominatim.openstreetmap.org/reverse"

/**
 * Stessa logica di "Usa la mia posizione" già in uso in Admin → Dati Pizzeria
 * (DatiPizzeriaSection.jsx): GPS del browser (navigator.geolocation) + reverse
 * geocoding Nominatim, per riempire un campo indirizzo con un click invece di
 * doverlo digitare/cercare a mano. Estratta qui come utility condivisa così i
 * campi indirizzo cliente (registrazione/profilo, Nuovo cliente in Cassa)
 * possono offrire lo stesso pulsante 📍 senza duplicare la chiamata GPS.
 *
 * Il GPS del browser (specie su desktop, dove spesso è solo triangolazione WiFi/IP) può avere
 * un margine di errore di centinaia di metri: restituiamo anche `accuracy` (metri, se il browser
 * la fornisce) così chi chiama può avvisare l'utente invece di far sembrare che il punto sulla
 * mappa sia "sparato a caso" senza spiegazione.
 *
 * @returns {Promise<{ lat: number, lng: number, address: string, accuracy: number|null }>}
 */
export function getBrowserLocationAddress() {
  return new Promise((resolve, reject) => {
    if (!navigator?.geolocation) {
      reject(new Error("Geolocalizzazione non supportata dal browser."))
      return
    }
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude, accuracy } = position.coords
        try {
          const params = new URLSearchParams({
            lat: String(latitude),
            lon: String(longitude),
            format: "json",
            addressdetails: "1",
          })
          const res = await fetch(`${NOMINATIM_REVERSE_URL}?${params}`, {
            headers: { Accept: "application/json", "User-Agent": "PizzaManagerApp/1.0" },
          })
          const data = await res.json()
          const address = formatIndirizzoFromNominatim(data) || data?.display_name || ""
          resolve({ lat: latitude, lng: longitude, address, accuracy: Number.isFinite(accuracy) ? accuracy : null })
        } catch (err) {
          reject(err instanceof Error ? err : new Error("Impossibile determinare l'indirizzo dalla posizione."))
        }
      },
      () => {
        reject(new Error("Impossibile ottenere la posizione. Abilita la geolocalizzazione per il sito."))
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    )
  })
}
