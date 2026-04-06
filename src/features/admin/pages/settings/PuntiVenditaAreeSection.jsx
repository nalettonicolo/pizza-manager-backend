import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useOutletContext } from "react-router-dom"
import { supabase } from "@/lib/supabaseClient"
import { useTenant } from "@/app/contexts/TenantContext"
import DeliveryAreaMapEditor from "@/features/admin/components/DeliveryAreaMapEditor"
import Loader from "@/components/feedback/Loader"
import {
  geoJsonCirclePolygon,
  radiusKmFromSpeedAndMinutes,
  radiusMetersFromSpeedAndMinutes,
} from "@/utils/deliveryArea"

export default function PuntiVenditaAreeSection() {
  const { settings } = useOutletContext()
  const { tenantId } = useTenant()
  const [loading, setLoading] = useState(true)
  const [punti, setPunti] = useState([])
  const [editing, setEditing] = useState({})
  /** Coordinate marcatore sede per PV (drag su mappa); null = usa fallback tenant. */
  const [pvCoords, setPvCoords] = useState({})
  const [savingId, setSavingId] = useState(null)

  const tenantCenter = useMemo(
    () => ({
      lat: settings?.lat ?? null,
      lng: settings?.lng ?? null,
    }),
    [settings?.lat, settings?.lng],
  )

  /** Stima raggio area da Parametri: velocità pony (default 20 km/h) × minuti (default 15). */
  const stimaConsegna = useMemo(() => {
    const po = settings?.parametri_operativi || {}
    const minuti = Number(po.consegna_stima_raggio_minuti) >= 1 ? Number(po.consegna_stima_raggio_minuti) : 15
    const vel = Number(po.velocita_pony_kmh) >= 1 ? Number(po.velocita_pony_kmh) : 20
    const raggioKm = radiusKmFromSpeedAndMinutes(vel, minuti)
    return { minuti, vel, raggioKm }
  }, [settings?.parametri_operativi])

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("punti_vendita")
        .select("id, nome, slug, attivo, consegna_area_poligono, lat, lng")
        .eq("tenant_id", tenantId)
        .order("nome", { ascending: true })
      if (error) throw error
      const rows = Array.isArray(data) ? data : []
      setPunti(rows)
      const nextPoly = {}
      const nextCoords = {}
      for (const r of rows) {
        const raw = r.consegna_area_poligono
        nextPoly[r.id] = raw && typeof raw === "object" && raw.type === "Polygon" ? raw : null
        const la = Number(r.lat)
        const lo = Number(r.lng)
        if (Number.isFinite(la) && Number.isFinite(lo)) {
          nextCoords[r.id] = { lat: la, lng: lo }
        } else {
          nextCoords[r.id] = null
        }
      }
      setEditing(nextPoly)
      setPvCoords(nextCoords)
    } catch (e) {
      console.error(e)
      setPunti([])
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => {
    void load()
  }, [load])

  const setPoly = (pvId, gj) => {
    setEditing((prev) => ({ ...prev, [pvId]: gj }))
  }

  const centerForPv = (pv) => {
    const local = pvCoords[pv.id]
    if (local && Number.isFinite(local.lat) && Number.isFinite(local.lng)) {
      return { lat: local.lat, lng: local.lng }
    }
    const la = Number(pv.lat)
    const lo = Number(pv.lng)
    if (Number.isFinite(la) && Number.isFinite(lo)) {
      return { lat: la, lng: lo }
    }
    return tenantCenter
  }

  const copyTenantCoordsToPv = (pvId) => {
    if (tenantCenter.lat == null || tenantCenter.lng == null) {
      window.alert("Imposta prima latitudine e longitudine in Dati pizzeria.")
      return
    }
    setPvCoords((prev) => ({
      ...prev,
      [pvId]: { lat: Number(tenantCenter.lat), lng: Number(tenantCenter.lng) },
    }))
  }

  const generaAreaCircolareStima = (pv) => {
    const cc = centerForPv(pv)
    if (cc.lat == null || cc.lng == null || !Number.isFinite(Number(cc.lat)) || !Number.isFinite(Number(cc.lng))) {
      window.alert("Imposta le coordinate della sede (marcatore sulla mappa o «Usa coordinate da Dati pizzeria»).")
      return
    }
    const meters = radiusMetersFromSpeedAndMinutes(stimaConsegna.vel, stimaConsegna.minuti)
    const gj = geoJsonCirclePolygon(Number(cc.lat), Number(cc.lng), meters)
    if (!gj) {
      window.alert("Impossibile calcolare il poligono.")
      return
    }
    setPoly(pv.id, gj)
  }

  const savePv = async (pvId) => {
    const gj = editing[pvId]
    const c = pvCoords[pvId]
    setSavingId(pvId)
    try {
      const payload = {
        consegna_area_poligono: gj && gj.type === "Polygon" ? gj : null,
        lat: c != null && Number.isFinite(c.lat) ? c.lat : null,
        lng: c != null && Number.isFinite(c.lng) ? c.lng : null,
      }
      const { error } = await supabase.from("punti_vendita").update(payload).eq("id", pvId).eq("tenant_id", tenantId)
      if (error) throw error
      window.alert("Area di consegna e posizione sede salvate.")
      await load()
    } catch (e) {
      console.error(e)
      window.alert(
        e?.message?.includes("column") || e?.code === "42703"
          ? "Aggiorna il database (sql/sql_upgrade.sql: colonne lat/lng su punti_vendita) e riprova."
          : e?.message || "Salvataggio non riuscito.",
      )
    } finally {
      setSavingId(null)
    }
  }

  if (loading) return <Loader />

  return (
    <div className="dashboard-settings-page">
      <h1 className="dashboard-page-title">Sedi e aree di consegna</h1>
      <p style={{ fontSize: 14, color: "#64748b", maxWidth: 720, lineHeight: 1.55 }}>
        Per ogni punto vendita imposta il <strong>marcatore sede</strong> (trascina sulla mappa) e disegna il poligono. Puoi partire da un’
        <strong>area circolare stimata</strong> in base alla velocità media in città (~20 km/h se non imposti altro) e ai minuti di
        percorrenza verso il bordo (parametro in{" "}
        <Link to="/admin/settings/parametri" style={{ fontWeight: 600 }}>
          Parametri operativi
        </Link>
        ): è solo un punto di partenza visivo — poi adatta i vertici sulla mappa. Se il poligono manca, in checkout si usa il poligono
        globale in Parametri.
      </p>

      {punti.length === 0 ? (
        <p style={{ marginTop: 16, color: "#94a3b8" }}>Nessun punto vendita configurato.</p>
      ) : (
        punti.map((pv) => {
          const cc = centerForPv(pv)
          return (
            <section
              key={pv.id}
              className="dashboard-box dashboard-settings-section"
              style={{ marginTop: 24, maxWidth: 900 }}
            >
              <h2 style={{ fontSize: 16, marginBottom: 8 }}>
                {pv.nome || "Sede"}
                {pv.attivo === false ? (
                  <span style={{ marginLeft: 8, fontSize: 12, color: "#b45309" }}>(non attiva)</span>
                ) : null}
              </h2>
              <div style={{ marginBottom: 10, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                <button
                  type="button"
                  onClick={() => copyTenantCoordsToPv(pv.id)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 8,
                    border: "1px solid #0f766e",
                    background: "#ecfdf5",
                    cursor: "pointer",
                    fontSize: 13,
                  }}
                >
                  Usa coordinate da Dati pizzeria
                </button>
                <button
                  type="button"
                  onClick={() => generaAreaCircolareStima(pv)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 8,
                    border: "1px solid #c2410c",
                    background: "#fff7ed",
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                  title="Sostituisce il poligono con un cerchio centrato sul marcatore"
                >
                  Genera area da stima moto (~{stimaConsegna.vel} km/h × {stimaConsegna.minuti} min → ~{stimaConsegna.raggioKm.toFixed(1)} km)
                </button>
                <button
                  type="button"
                  onClick={() => setPoly(pv.id, null)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 8,
                    border: "1px solid #ccc",
                    background: "#f5f5f5",
                    cursor: "pointer",
                    fontSize: 13,
                  }}
                >
                  Rimuovi area per questa sede
                </button>
              </div>
              <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 10px", lineHeight: 1.5, maxWidth: 720 }}>
                La stima usa <strong>velocità pony</strong> e <strong>minuti per raggio</strong> da Parametri (default 20 km/h e 15 min se
                non imposti nulla). Modifica i vertici dopo la generazione per seguire strade e zone reali.
              </p>
              <DeliveryAreaMapEditor
                center={cc}
                value={editing[pv.id] ?? null}
                onChange={(gj) => setPoly(pv.id, gj)}
                onCenterMarkerDrag={(la, lo) =>
                  setPvCoords((prev) => ({
                    ...prev,
                    [pv.id]: { lat: la, lng: lo },
                  }))
                }
                height={380}
              />
              <p style={{ fontSize: 12, color: "#64748b", marginTop: 8 }}>
                Centro mappa:{" "}
                {cc.lat != null && cc.lng != null ? (
                  <>
                    {Number(cc.lat).toFixed(5)}, {Number(cc.lng).toFixed(5)}
                  </>
                ) : (
                  "— (imposta coordinate in Dati pizzeria o trascina il marcatore dopo aver salvato lat/lng sul DB)"
                )}
              </p>
              <div style={{ marginTop: 12 }}>
                <button
                  type="button"
                  className="btn-primary-dashboard"
                  disabled={savingId === pv.id}
                  onClick={() => void savePv(pv.id)}
                >
                  {savingId === pv.id ? "Salvataggio…" : "Salva area e posizione sede"}
                </button>
              </div>
            </section>
          )
        })
      )}
    </div>
  )
}
