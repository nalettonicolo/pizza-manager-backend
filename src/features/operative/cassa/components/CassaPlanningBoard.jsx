import { useMemo, useState, useCallback, useEffect, Fragment } from "react"
import {
  ordineNomeCliente,
  ordineIndirizzoConsegna,
} from "@/features/operative/cassa/utils/ordineFieldHelpers"
import { formatIndirizzoDisplayItaliano } from "@/utils/formatIndirizzoItaliano"
import { ordineIsAnnullato } from "@/utils/incassiFromOrdini"
import { isOrdineOnlineCanale } from "@/features/operative/cassa/utils/cassaPagamentiOptions"
import {
  ponyCountForToday,
  loadPonyOverrides,
  savePonyOverrides,
  ponyDayLoadSummary,
  moveOrdinePony,
  assignDeliveriesToPonies,
  baulettoCapFromParametri,
  combineWindowFromParametri,
} from "@/features/operative/cassa/utils/planningPonyAssign"
import {
  getServizioBandForMinutes,
  getActivePlanningServizioBand,
  timeToMinutes,
  endMinutesForDay,
} from "@/features/operative/cassa/utils/planningUtils"
import { getLocalYYYYMMDD } from "@/utils/localDate"
import { geocodeAddressForDelivery } from "@/utils/geocodeAddress"
import { updateOrder } from "@/features/admin/services/adminService"
import CassaConsegnaMappaSlot from "@/features/operative/cassa/components/CassaConsegnaMappaSlot"

function shortAddress(o) {
  const raw = ordineIndirizzoConsegna(o)
  if (raw) {
    const formatted = formatIndirizzoDisplayItaliano(raw)
    return formatted.length > 36 ? `${formatted.slice(0, 34)}…` : formatted
  }
  return ordineNomeCliente(o) || "Consegna"
}

function ShopIcon({ size = 14 }) {
  return (
    <span aria-hidden style={{ fontSize: size, lineHeight: 1 }} title="Ritiro in negozio">
      🏪
    </span>
  )
}

function PizzaIcon({ size = 12 }) {
  return (
    <span aria-hidden style={{ fontSize: size, lineHeight: 1 }} title="Tot. pizze">
      🍕
    </span>
  )
}

function ScooterIcon({ size = 12 }) {
  return (
    <span aria-hidden style={{ fontSize: size, lineHeight: 1 }} title="Tot. consegne">
      🛵
    </span>
  )
}

function CellStat({ icon, value, title, compact = false }) {
  return (
    <span
      style={{ ...styles.cellStat, ...(compact ? styles.cellStatCompact : {}) }}
      title={title}
    >
      {icon}
      <strong style={styles.cellStatVal}>{value}</strong>
    </span>
  )
}

function MapPinIcon({ size = 14 }) {
  return (
    <span aria-hidden style={{ fontSize: size, lineHeight: 1 }} title="Mappa consegne">
      📍
    </span>
  )
}

function deliveryMapMarkers(orders, slotLabel, coordOverrides = {}) {
  return (orders || [])
    .map((o) => {
      const ov = o?.id != null ? coordOverrides[o.id] || coordOverrides[String(o.id)] : null
      const lat = Number(ov?.lat ?? o.consegna_lat ?? o.consegnaLat)
      const lng = Number(ov?.lng ?? o.consegna_lng ?? o.consegnaLng)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
      return {
        id: o.id,
        numero: o.numero ?? o.numero_ordine ?? o.numeroOrdine,
        orario: o.orario_ritiro ?? o.orarioRitiro ?? slotLabel,
        lat,
        lng,
      }
    })
    .filter(Boolean)
}

function ordersMissingCoords(orders, coordOverrides = {}) {
  return (orders || []).filter((o) => {
    const ov = o?.id != null ? coordOverrides[o.id] || coordOverrides[String(o.id)] : null
    if (ov && Number.isFinite(ov.lat) && Number.isFinite(ov.lng)) return false
    const lat = Number(o.consegna_lat ?? o.consegnaLat)
    const lng = Number(o.consegna_lng ?? o.consegnaLng)
    if (Number.isFinite(lat) && Number.isFinite(lng)) return false
    return Boolean(ordineIndirizzoConsegna(o)?.trim())
  })
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function ordineIsConsegnato(o) {
  const stato = String(o?.stato ?? "").trim().toUpperCase()
  const statoConsegna = String(o?.stato_consegna ?? o?.statoConsegna ?? "").trim().toUpperCase()
  return stato === "CONSEGNATO" || statoConsegna === "CONSEGNATO"
}

function pizzeCountForOrdine(o, pizzePerOrdine) {
  return pizzePerOrdine?.[o.id] ?? pizzePerOrdine?.[String(o.id)] ?? 0
}

function capacityTier(value, max) {
  if (!max || max <= 0) return "ok"
  const pct = (Number(value) || 0) / max
  if (pct >= 1) return "full"
  if (pct >= 0.7) return "warn"
  return "ok"
}

function parseSlotLabel(label) {
  const m = String(label || "")
    .trim()
    .replace(/\./g, ":")
    .match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return null
  return {
    h: Number(m[1]),
    min: Number(m[2]),
    t: `${String(Number(m[1])).padStart(2, "0")}:${m[2]}`,
  }
}

/** Preferisce slotKey numerico (ms) — affidabile anche se la label è «19.00» (locale Windows). */
function timePartsFromRow(row) {
  const key = Number(row?.slotKey)
  if (Number.isFinite(key) && key > 1e11) {
    const d = new Date(key)
    if (!Number.isNaN(d.getTime())) {
      const h = d.getHours()
      const min = d.getMinutes()
      return {
        h,
        min,
        t: `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`,
      }
    }
  }
  return parseSlotLabel(row?.label)
}

function ArrowIcon({ dir }) {
  return (
    <span
      aria-hidden
      style={{
        display: "inline-flex",
        width: 18,
        justifyContent: "center",
        fontWeight: 800,
        color: dir === "up" ? "#1565c0" : "#c62828",
        fontSize: 14,
      }}
      title={dir === "up" ? "Pony dispari" : "Pony pari"}
    >
      {dir === "up" ? "↑" : "↓"}
    </span>
  )
}

/**
 * Planning forno: griglia per fascia con totali (pizze / negozio / consegne) e lista ordini in cella.
 */
export default function CassaPlanningBoard({
  rows,
  pizzePerOrdine,
  parametri,
  tenantId,
  canEditPony = false,
  maxPizzeForno,
  onClose,
  onOpenOrdine,
  ordiniOnlineToggle,
  orariOggi = null,
  shopCoords = null,
  shopLogoUrl = null,
}) {
  const dayKey = getLocalYYYYMMDD()
  const ponyCount = ponyCountForToday(parametri)
  const baulettoCap = baulettoCapFromParametri(parametri)
  const combineWindowMin = combineWindowFromParametri(parametri)
  const [overrides, setOverrides] = useState(() => loadPonyOverrides(tenantId, dayKey))
  const [editSlotKey, setEditSlotKey] = useState(null)
  const [selectedOrdineId, setSelectedOrdineId] = useState(null)
  const [draftOverrides, setDraftOverrides] = useState(null)
  const [focusSlotKey, setFocusSlotKey] = useState(null)
  const [mapSlot, setMapSlot] = useState(null)
  const [coordOverrides, setCoordOverrides] = useState({})
  const [mapGeocodeStatus, setMapGeocodeStatus] = useState(null)

  useEffect(() => {
    setOverrides(loadPonyOverrides(tenantId, dayKey))
  }, [tenantId, dayKey])

  const activeOverrides = draftOverrides || overrides

  const cleanedRows = useMemo(
    () =>
      (rows || []).map((row) => ({
        ...row,
        deliveryOrdiniList: (row.deliveryOrdiniList || []).filter((o) => !ordineIsAnnullato(o)),
        ritiroOrdiniList: (row.ritiroOrdiniList || []).filter((o) => !ordineIsAnnullato(o)),
      })),
    [rows],
  )

  const dayLoad = useMemo(
    () =>
      ponyDayLoadSummary(cleanedRows, ponyCount, activeOverrides, {
        pizzePerOrdine,
        baulettoCap,
        combineWindowMin,
      }),
    [cleanedRows, ponyCount, activeOverrides, pizzePerOrdine, baulettoCap, combineWindowMin],
  )

  const heatmap = useMemo(() => {
    const byHm = new Map()
    const hoursSet = new Set()
    const minsSet = new Set()
    for (const row of cleanedRows) {
      const p = timePartsFromRow(row)
      if (!p) continue
      hoursSet.add(p.h)
      minsSet.add(p.min)
      byHm.set(`${p.h}:${p.min}`, row)
    }
    const hours = [...hoursSet].sort((a, b) => a - b)
    const mins = [...minsSet].sort((a, b) => a - b)
    return {
      hours,
      mins: mins.length ? mins : [0, 15, 30, 45],
      byHm,
    }
  }, [cleanedRows])

  const focusRow = useMemo(
    () => cleanedRows.find((r) => r.slotKey === focusSlotKey) || null,
    [cleanedRows, focusSlotKey],
  )

  const toggleGear = useCallback(
    (slotKey) => {
      if (!canEditPony) return
      if (editSlotKey === slotKey) {
        const next = draftOverrides || overrides
        savePonyOverrides(tenantId, dayKey, next)
        setOverrides(next)
        setDraftOverrides(null)
        setEditSlotKey(null)
        setSelectedOrdineId(null)
        return
      }
      setFocusSlotKey(slotKey)
      setEditSlotKey(slotKey)
      setDraftOverrides({ ...overrides })
      setSelectedOrdineId(null)
    },
    [canEditPony, editSlotKey, draftOverrides, overrides, tenantId, dayKey],
  )

  const onSelectRow = useCallback(
    (ordineId, slotKey) => {
      if (editSlotKey !== slotKey) {
        onOpenOrdine?.(ordineId)
        return
      }
      setSelectedOrdineId((prev) => (prev === ordineId ? null : ordineId))
    },
    [editSlotKey, onOpenOrdine],
  )

  const onMoveSelected = useCallback(
    (direction) => {
      if (!selectedOrdineId || !draftOverrides || !editSlotKey) return
      const row = cleanedRows.find((r) => r.slotKey === editSlotKey)
      const deliveryList = row?.deliveryOrdiniList || []
      const assigned = assignDeliveriesToPonies(deliveryList, ponyCount, draftOverrides, {
        pizzePerOrdine,
        baulettoCap,
        combineWindowMin,
      })
      const cur = assigned.find((a) => a.ordine.id === selectedOrdineId)
      setDraftOverrides((prev) =>
        moveOrdinePony(prev || {}, selectedOrdineId, ponyCount, direction, cur?.ponyLetter),
      )
    },
    [
      selectedOrdineId,
      draftOverrides,
      ponyCount,
      editSlotKey,
      cleanedRows,
      pizzePerOrdine,
      baulettoCap,
      combineWindowMin,
    ],
  )

  const onCellClick = useCallback((slotKey) => {
    setFocusSlotKey((prev) => (prev === slotKey ? null : slotKey))
    setEditSlotKey(null)
    setDraftOverrides(null)
    setSelectedOrdineId(null)
  }, [])

  const activeServizioBand = useMemo(
    () => getActivePlanningServizioBand(new Date(), orariOggi?.fasce),
    [orariOggi],
  )

  const heatmapSections = useMemo(() => {
    const fasce = orariOggi?.fasce || []
    const { hours, mins, byHm } = heatmap

    const hourInBand = (h, band) => {
      const start = timeToMinutes(band.apertura)
      const end = endMinutesForDay(band.chiusura)
      return mins.some((m) => {
        const total = h * 60 + m
        return total >= start && total <= end && byHm.has(`${h}:${m}`)
      })
    }

    if (fasce.length <= 1) {
      return [{ id: "unico", label: null, range: null, hours, band: null }]
    }

    const sorted = [...fasce].sort((a, b) => timeToMinutes(a.apertura) - timeToMinutes(b.apertura))
    const sections = sorted
      .map((band, idx) => ({
        id: idx === 0 ? "pranzo" : "cena",
        label: idx === 0 ? "Pranzo" : "Cena",
        range: `${band.apertura}–${band.chiusura}`,
        hours: hours.filter((h) => hourInBand(h, band)),
        band: idx === 0 ? "pranzo" : "cena",
      }))
      .filter((s) => s.hours.length > 0)

    if (activeServizioBand) {
      return sections.filter((s) => s.band === activeServizioBand)
    }
    return sections
  }, [heatmap, orariOggi, activeServizioBand])

  const openSlotMap = useCallback(
    async (row, label) => {
      const orders = row.deliveryOrdiniList || []
      const markers = deliveryMapMarkers(orders, label, coordOverrides)
      const missing = ordersMissingCoords(orders, coordOverrides)
      setMapSlot({
        label,
        slotKey: row.slotKey,
        orders,
        markers,
      })
      if (!missing.length) {
        setMapGeocodeStatus(null)
        return
      }

      setMapGeocodeStatus({
        phase: "loading",
        total: missing.length,
        done: 0,
        failed: 0,
      })

      let done = 0
      let failed = 0
      const nextOverrides = { ...coordOverrides }

      for (let i = 0; i < missing.length; i += 1) {
        const o = missing[i]
        const addr = ordineIndirizzoConsegna(o)
        try {
          const coords = await geocodeAddressForDelivery(addr)
          if (coords && Number.isFinite(coords.lat) && Number.isFinite(coords.lng)) {
            nextOverrides[o.id] = { lat: coords.lat, lng: coords.lng }
            setCoordOverrides({ ...nextOverrides })
            setMapSlot((prev) =>
              prev && prev.slotKey === row.slotKey
                ? {
                    ...prev,
                    markers: deliveryMapMarkers(prev.orders || orders, label, nextOverrides),
                  }
                : prev,
            )
            // Persiste sul DB così le mappe successive (delivery, riepilogo) lo ritrovano.
            void updateOrder(o.id, {
              consegna_lat: coords.lat,
              consegna_lng: coords.lng,
            }).catch((err) => console.warn("[planning] salvataggio coordinate:", err))
            done += 1
          } else {
            failed += 1
          }
        } catch (err) {
          console.warn("[planning] geocode ordine", o.id, err)
          failed += 1
        }
        setMapGeocodeStatus({
          phase: "loading",
          total: missing.length,
          done,
          failed,
        })
        // Nominatim: evita burst (max ~1 req/s in uso educato).
        if (i < missing.length - 1) await sleep(1100)
      }

      setMapGeocodeStatus({
        phase: "done",
        total: missing.length,
        done,
        failed,
      })
    },
    [coordOverrides],
  )

  const editing = Boolean(editSlotKey && focusSlotKey === editSlotKey)

  return (
    <div style={styles.wrap}>
      <div style={styles.header}>
        <div>
          <strong style={{ fontSize: 16 }}>Situazione planning</strong>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
            Griglia forno per fascia · capacità <strong>{maxPizzeForno}</strong> pz · bauletto{" "}
            <strong>{baulettoCap}</strong> pz
            {activeServizioBand ? (
              <>
                {" "}
                ·{" "}
                <strong style={{ color: activeServizioBand === "pranzo" ? "#b45309" : "#4338ca" }}>
                  {activeServizioBand === "pranzo" ? "☀️ Pranzo" : "🌙 Cena"}
                </strong>{" "}
                (solo fascia attiva)
              </>
            ) : null}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {ordiniOnlineToggle}
          <button type="button" style={styles.closeBtn} onClick={onClose} aria-label="Chiudi planning">
            ✕
          </button>
        </div>
      </div>

      <div style={styles.ponyStrip} aria-label="Carico pony del giorno">
        {dayLoad.map((p) => (
          <div key={p.letter} style={styles.ponyChip}>
            <span style={styles.ponyChipLetter}>Pony {p.letter}</span>
            <span style={styles.ponyChipCount}>
              {p.consegne} {p.consegne === 1 ? "consegna" : "consegne"}
              {p.pizze > 0 ? ` · ${p.pizze} pz` : ""}
            </span>
          </div>
        ))}
      </div>

      {editing ? (
        <div style={styles.editHint}>
          <span>
            Modifica pony · fascia {focusRow?.label}: seleziona una consegna, ↑↓ la sposta, richiudi ⚙ per
            salvare.
          </span>
          {selectedOrdineId ? (
            <span style={{ display: "inline-flex", gap: 4 }}>
              <button type="button" style={styles.moveBtn} onClick={() => onMoveSelected("up")} title="Pony precedente">
                ↑
              </button>
              <button type="button" style={styles.moveBtn} onClick={() => onMoveSelected("down")} title="Pony successivo">
                ↓
              </button>
            </span>
          ) : null}
        </div>
      ) : null}

      {cleanedRows.length === 0 ? (
        <p style={{ margin: "24px 12px", color: "#64748b", fontSize: 14, textAlign: "center" }}>
          Nessuna fascia oraria disponibile. Controlla gli orari di apertura del locale in Impostazioni.
        </p>
      ) : (
        <div style={styles.main}>
          <div style={styles.heatPane}>
            <div style={styles.paneTitle}>Forno</div>
            <div style={styles.heatScroll}>
              <div
                style={{
                  ...styles.heatGrid,
                  gridTemplateColumns: `repeat(${Math.max(1, heatmap.mins.length)}, minmax(152px, 1fr))`,
                }}
              >
                {heatmap.mins.map((m) => (
                  <div key={`m${m}`} style={styles.heatColHead}>
                    :{String(m).padStart(2, "0")}
                  </div>
                ))}
                {heatmapSections.map((section) => (
                  <Fragment key={section.id}>
                    {section.label ? (
                      <div
                        style={{
                          ...styles.bandHeader,
                          ...(section.band === "pranzo" ? styles.bandHeaderPranzo : styles.bandHeaderCena),
                        }}
                      >
                        <span style={styles.bandHeaderIcon}>{section.band === "pranzo" ? "☀️" : "🌙"}</span>
                        <span style={styles.bandHeaderLabel}>{section.label}</span>
                        <span style={styles.bandHeaderRange}>{section.range}</span>
                      </div>
                    ) : null}
                    {section.hours.map((h) => (
                      <HeatHourRow
                        key={`${section.id}-${h}`}
                        hour={h}
                        mins={heatmap.mins}
                        byHm={heatmap.byHm}
                        orariOggi={orariOggi}
                        maxPizzeForno={maxPizzeForno}
                        pizzePerOrdine={pizzePerOrdine}
                        ponyCount={ponyCount}
                        baulettoCap={baulettoCap}
                        combineWindowMin={combineWindowMin}
                        activeOverrides={activeOverrides}
                        focusSlotKey={focusSlotKey}
                        editSlotKey={editSlotKey}
                        selectedOrdineId={selectedOrdineId}
                        canEditPony={canEditPony}
                        onCellClick={onCellClick}
                        onSelectRow={onSelectRow}
                        onOpenOrdine={onOpenOrdine}
                        onToggleGear={toggleGear}
                        onOpenMap={openSlotMap}
                        coordOverrides={coordOverrides}
                      />
                    ))}
                  </Fragment>
                ))}
              </div>
            </div>
            <p style={styles.heatHint}>
              Orario in casella · 📍 mappa (geocoding automatico se mancano le coordinate) · ⚙ pony.
            </p>
          </div>
        </div>
      )}

      {mapSlot ? (
        <div
          style={styles.mapOverlay}
          onClick={() => {
            setMapSlot(null)
            setMapGeocodeStatus(null)
          }}
          role="dialog"
          aria-modal="true"
        >
          <div style={styles.mapModal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.mapModalHead}>
              <div>
                <strong style={{ fontSize: 16 }}>Consegne · {mapSlot.label}</strong>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                  {mapSlot.markers.length}{" "}
                  {mapSlot.markers.length === 1 ? "punto geolocalizzato" : "punti geolocalizzati"}
                  {mapGeocodeStatus?.phase === "loading"
                    ? ` · ricerca indirizzi ${mapGeocodeStatus.done + mapGeocodeStatus.failed}/${mapGeocodeStatus.total}…`
                    : null}
                </div>
              </div>
              <button
                type="button"
                style={styles.closeBtn}
                onClick={() => {
                  setMapSlot(null)
                  setMapGeocodeStatus(null)
                }}
                aria-label="Chiudi mappa"
              >
                ✕
              </button>
            </div>
            {mapGeocodeStatus?.phase === "loading" ? (
              <p style={styles.mapStatusLine}>
                Geolocalizzazione automatica degli indirizzi senza coordinate salvate…
              </p>
            ) : null}
            {mapGeocodeStatus?.phase === "done" && mapGeocodeStatus.failed > 0 ? (
              <p style={styles.mapStatusWarn}>
                {mapGeocodeStatus.done} trovati · {mapGeocodeStatus.failed} non geocodificabili (indirizzo incompleto o
                non riconosciuto).
              </p>
            ) : null}
            {mapSlot.markers.length > 0 ? (
              <CassaConsegnaMappaSlot
                altreConsegne={mapSlot.markers}
                shopCoords={shopCoords}
                shopLogoUrl={shopLogoUrl}
                height={360}
              />
            ) : mapGeocodeStatus?.phase === "loading" ? (
              <div style={styles.mapPlaceholder}>Caricamento mappa…</div>
            ) : (
              <p style={{ margin: "16px 0 0", color: "#64748b", fontSize: 13, lineHeight: 1.45 }}>
                Nessuna consegna geolocalizzabile in questa fascia. Controlla che gli ordini abbiano un indirizzo
                completo.
              </p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function HeatHourRow({
  hour,
  mins,
  byHm,
  orariOggi,
  maxPizzeForno,
  pizzePerOrdine,
  ponyCount,
  baulettoCap,
  combineWindowMin,
  activeOverrides,
  focusSlotKey,
  editSlotKey,
  selectedOrdineId,
  canEditPony,
  onCellClick,
  onSelectRow,
  onOpenOrdine,
  onToggleGear,
  onOpenMap,
  coordOverrides,
}) {
  return (
    <>
      {mins.map((m) => {
        const row = byHm.get(`${hour}:${m}`)
        if (!row) {
          return <div key={`${hour}-${m}`} style={{ ...styles.heatCell, ...styles.heatCellMissing }} />
        }
        return (
          <PlanningHeatCell
            key={row.slotKey}
            row={row}
            orariOggi={orariOggi}
            maxPizzeForno={maxPizzeForno}
            pizzePerOrdine={pizzePerOrdine}
            ponyCount={ponyCount}
            baulettoCap={baulettoCap}
            combineWindowMin={combineWindowMin}
            activeOverrides={activeOverrides}
            focused={focusSlotKey === row.slotKey}
            editing={editSlotKey === row.slotKey}
            selectedOrdineId={selectedOrdineId}
            canEditPony={canEditPony}
            onCellClick={onCellClick}
            onSelectRow={onSelectRow}
            onOpenOrdine={onOpenOrdine}
            onToggleGear={onToggleGear}
            onOpenMap={onOpenMap}
            coordOverrides={coordOverrides}
          />
        )
      })}
    </>
  )
}

function PlanningHeatCell({
  row,
  orariOggi,
  maxPizzeForno,
  pizzePerOrdine,
  ponyCount,
  baulettoCap,
  combineWindowMin,
  activeOverrides,
  focused,
  editing,
  selectedOrdineId,
  canEditPony,
  onCellClick,
  onSelectRow,
  onOpenOrdine,
  onToggleGear,
  onOpenMap,
  coordOverrides = {},
}) {
  // Riferimento stabile: senza useMemo, "|| []" crea un nuovo array a ogni render quando la lista
  // è assente, invalidando inutilmente i useMemo sotto che la usano come dipendenza.
  const deliveryList = useMemo(() => row.deliveryOrdiniList || [], [row.deliveryOrdiniList])
  const ritiroList = row.ritiroOrdiniList || []
  /** Contatori = ciò che vedi in lista (anche già consegnati). Solo ⚙ usa ancora gli attivi. */
  const delN = deliveryList.length
  const ritN = ritiroList.length
  const totPizze =
    deliveryList.reduce((s, o) => s + pizzeCountForOrdine(o, pizzePerOrdine), 0) +
    ritiroList.reduce((s, o) => s + pizzeCountForOrdine(o, pizzePerOrdine), 0)
  const activeDeliveryCount = deliveryList.filter((o) => !ordineIsConsegnato(o)).length
  const assigned = useMemo(
    () =>
      assignDeliveriesToPonies(deliveryList, ponyCount, activeOverrides, {
        pizzePerOrdine,
        baulettoCap,
        combineWindowMin,
      }),
    [deliveryList, ponyCount, activeOverrides, pizzePerOrdine, baulettoCap, combineWindowMin],
  )
  /** Ordini delivery non presi in auto (es. fuori tempi rispetto al giro) — solo a mano. */
  const unassignedDelivery = useMemo(() => {
    const taken = new Set(assigned.map((a) => a.ordine?.id).filter(Boolean))
    return deliveryList.filter((o) => o?.id != null && !taken.has(o.id))
  }, [deliveryList, assigned])
  const label =
    timePartsFromRow(row)?.t ||
    String(row.label || "").replace(/\./g, ":")
  const timeParts = timePartsFromRow(row)
  const servizioBand = timeParts
    ? getServizioBandForMinutes(timeParts.h * 60 + timeParts.min, orariOggi?.fasce)
    : null
  const tier = capacityTier(totPizze, maxPizzeForno)
  const hasOrders = deliveryList.length + ritiroList.length > 0
  const mapMarkers = deliveryMapMarkers(deliveryList, label, coordOverrides)
  const hasMap = mapMarkers.length > 0 || ordersMissingCoords(deliveryList, coordOverrides).length > 0

  return (
    <div
      style={{
        ...styles.heatCell,
        ...styles[`heatCell_${tier}`],
        ...(focused ? styles.heatCellFocus : {}),
        ...(totPizze === 0 && !hasOrders ? styles.heatCellEmpty : {}),
        ...(hasOrders ? styles.heatCellWithList : {}),
        ...(editing ? styles.heatCellEditing : {}),
        ...(servizioBand === "pranzo" ? styles.heatCellPranzo : {}),
        ...(servizioBand === "cena" ? styles.heatCellCena : {}),
      }}
      title={`${label} · forno ${totPizze}/${maxPizzeForno}`}
    >
      <div style={styles.cellTopRow}>
        <button
          type="button"
          style={styles.cellTopMain}
          onClick={() => onCellClick(row.slotKey)}
        >
          <span style={styles.cellTime}>{label}</span>
          <span style={styles.cellStatsInline}>
            <CellStat compact icon={<PizzaIcon size={11} />} value={totPizze} title="Tot. pizze" />
            <CellStat compact icon={<ShopIcon size={11} />} value={ritN} title="Tot. ordini in negozio" />
            <CellStat compact icon={<ScooterIcon size={11} />} value={delN} title="Tot. consegne" />
          </span>
        </button>
        <button
          type="button"
          style={{
            ...styles.cellMapBtn,
            ...(hasMap ? {} : styles.cellMapBtnMuted),
          }}
          title={
            hasMap
              ? `Mappa · ${mapMarkers.length} consegne geolocalizzate`
              : "Nessuna consegna geolocalizzata in questa fascia"
          }
          onClick={() => onOpenMap(row, label)}
        >
          <MapPinIcon size={13} />
        </button>
        {canEditPony && activeDeliveryCount > 0 ? (
          <button
            type="button"
            style={{
              ...styles.cellGearBtn,
              ...(editing ? styles.gearBtnActive : {}),
            }}
            title={editing ? "Salva assegnazione pony" : "Modifica assegnazione pony"}
            onClick={() => onToggleGear(row.slotKey)}
          >
            ⚙
          </button>
        ) : null}
      </div>

      {hasOrders ? (
        <ul style={styles.cellList}>
          {assigned.map((a, idx) => {
            const o = a.ordine
            const pzTotal = pizzeCountForOrdine(o, pizzePerOrdine)
            const pz =
              a.pzShare != null && Number.isFinite(Number(a.pzShare)) ? Number(a.pzShare) : pzTotal
            const selected = editing && selectedOrdineId === o.id
            const online = isOrdineOnlineCanale(o)
            const consegnato = ordineIsConsegnato(o)
            return (
              <li key={`d-${o.id}-${a.ponyLetter}-${idx}`}>
                <button
                  type="button"
                  data-order-row
                  style={{
                    ...styles.cellRowBtn,
                    ...(online ? styles.rowBtnOnline : {}),
                    ...(selected ? styles.rowBtnSelected : {}),
                    ...(consegnato ? styles.cellRowConsegnato : {}),
                  }}
                  onClick={() => onSelectRow(o.id, row.slotKey)}
                  title={
                    a.split
                      ? `Parte ordine · ${pz}/${pzTotal} pz su questo pony (bauletto)`
                      : undefined
                  }
                >
                  {consegnato ? <span title="Consegnato">🏁</span> : null}
                  <span style={styles.cellPonyTag}>{a.ponyLetter || a.label}</span>
                  <ArrowIcon dir={a.arrowDir} />
                  <span
                    style={{
                      ...styles.onlineDot,
                      ...(online ? styles.onlineDotOn : {}),
                    }}
                  />
                  {a.manual ? (
                    <span style={styles.manualMark} title="Assegnazione modificata">
                      ✎
                    </span>
                  ) : null}
                  {a.split ? (
                    <span style={styles.splitMark} title={`Spezzato · ${pz}/${pzTotal} pz`}>
                      ½
                    </span>
                  ) : null}
                  <span style={styles.cellAddr}>{shortAddress(o)}</span>
                  <span style={styles.cellPz}>{pz}</span>
                </button>
              </li>
            )
          })}
          {unassignedDelivery.map((o) => {
            const pz = pizzeCountForOrdine(o, pizzePerOrdine)
            const online = isOrdineOnlineCanale(o)
            const consegnato = ordineIsConsegnato(o)
            return (
              <li key={`u-${o.id}`}>
                <button
                  type="button"
                  data-order-row
                  style={{
                    ...styles.cellRowBtn,
                    ...styles.cellRowUnassigned,
                    ...(online ? styles.rowBtnOnline : {}),
                    ...(consegnato ? styles.cellRowConsegnato : {}),
                  }}
                  onClick={() => onSelectRow(o.id, row.slotKey)}
                  title="Non assegnato in automatico (tempi): usa ⚙ per assegnare il pony"
                >
                  <span style={{ ...styles.cellPonyTag, ...styles.cellPonyTagWait }}>?</span>
                  <span
                    style={{
                      ...styles.onlineDot,
                      ...(online ? styles.onlineDotOn : {}),
                    }}
                  />
                  <span style={styles.cellAddr}>{shortAddress(o)}</span>
                  <span style={styles.cellPz}>{pz}</span>
                </button>
              </li>
            )
          })}
          {ritiroList.map((o) => {
            const pz = pizzeCountForOrdine(o, pizzePerOrdine)
            const nome = ordineNomeCliente(o) || "Cliente"
            const online = isOrdineOnlineCanale(o)
            const consegnato = ordineIsConsegnato(o)
            return (
              <li key={`r-${o.id}`}>
                <button
                  type="button"
                  data-order-row
                  style={{
                    ...styles.cellRowBtn,
                    ...(online ? styles.rowBtnOnline : {}),
                    ...(consegnato ? styles.cellRowConsegnato : {}),
                  }}
                  onClick={() => onOpenOrdine?.(o.id)}
                >
                  {consegnato ? <span title="Consegnato">🏁</span> : null}
                  <ShopIcon size={12} />
                  <span
                    style={{
                      ...styles.onlineDot,
                      ...(online ? styles.onlineDotOn : {}),
                    }}
                  />
                  <span style={styles.cellAddr}>{nome}</span>
                  <span style={styles.cellPz}>{pz}</span>
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}

const styles = {
  wrap: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    width: "100%",
    minHeight: 0,
    flex: 1,
    background: "#fff",
    border: "1px solid #d6e2ee",
    borderRadius: 10,
    overflow: "hidden",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    padding: "12px 14px",
    borderBottom: "1px solid #e2e8f0",
    flexShrink: 0,
    flexWrap: "wrap",
  },
  closeBtn: {
    border: "none",
    background: "#f1f5f9",
    borderRadius: 8,
    width: 36,
    height: 36,
    cursor: "pointer",
    fontSize: 16,
  },
  editHint: {
    margin: 0,
    padding: "8px 14px",
    fontSize: 12,
    background: "#fff7ed",
    color: "#9a3412",
    borderBottom: "1px solid #fed7aa",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  ponyStrip: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    padding: "8px 14px",
    borderBottom: "1px solid #e2e8f0",
    background: "#f8fafc",
    flexShrink: 0,
  },
  ponyChip: {
    display: "inline-flex",
    alignItems: "baseline",
    gap: 8,
    padding: "4px 10px",
    borderRadius: 8,
    border: "1px solid #cbd5e1",
    background: "#fff",
    fontSize: 12,
  },
  ponyChipLetter: { fontWeight: 800, color: "#0f172a" },
  ponyChipCount: { color: "#64748b", fontWeight: 600 },
  main: {
    flex: 1,
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
  },
  heatPane: {
    flex: 1,
    padding: "10px 12px",
    overflow: "hidden",
    background: "#f8fafc",
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
  },
  heatScroll: {
    flex: 1,
    minHeight: 0,
    overflow: "auto",
  },
  paneTitle: {
    fontSize: 12,
    fontWeight: 800,
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  heatGrid: {
    display: "grid",
    gap: 5,
    alignItems: "stretch",
  },
  heatColHead: {
    textAlign: "center",
    fontSize: 11,
    fontWeight: 700,
    color: "#64748b",
    paddingBottom: 2,
  },
  bandHeader: {
    gridColumn: "1 / -1",
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 10px",
    marginTop: 6,
    marginBottom: 2,
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: "0.02em",
  },
  bandHeaderPranzo: {
    background: "linear-gradient(90deg, #fff7ed 0%, #fffbeb 100%)",
    border: "1px solid #fdba74",
    color: "#9a3412",
  },
  bandHeaderCena: {
    background: "linear-gradient(90deg, #eef2ff 0%, #f8fafc 100%)",
    border: "1px solid #a5b4fc",
    color: "#3730a3",
  },
  bandHeaderIcon: { fontSize: 14, lineHeight: 1 },
  bandHeaderLabel: { textTransform: "uppercase" },
  bandHeaderRange: { fontWeight: 600, opacity: 0.85 },
  heatCell: {
    minHeight: 52,
    borderRadius: 8,
    border: "1px solid #cbd5e1",
    background: "#fff",
    padding: "6px 6px 8px",
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    gap: 4,
    fontFamily: "inherit",
    minWidth: 0,
  },
  heatCellMissing: {
    background: "transparent",
    border: "1px dashed #e2e8f0",
    cursor: "default",
    minHeight: 48,
  },
  heatCellEmpty: {
    background: "#f1f5f9",
    color: "#94a3b8",
  },
  heatCell_ok: {
    background: "#ecfdf5",
    borderColor: "#99f6e4",
  },
  heatCell_warn: {
    background: "#fffbeb",
    borderColor: "#fcd34d",
  },
  heatCell_full: {
    background: "#fef2f2",
    borderColor: "#fca5a5",
  },
  heatCellFocus: {
    outline: "2px solid #0f766e",
    outlineOffset: 1,
  },
  heatCellWithList: {
    minHeight: 88,
  },
  heatCellEditing: {
    boxShadow: "inset 0 0 0 2px #0f766e",
  },
  heatCellPranzo: {
    boxShadow: "inset 3px 0 0 #f59e0b",
  },
  heatCellCena: {
    boxShadow: "inset 3px 0 0 #6366f1",
  },
  cellTopRow: {
    display: "flex",
    alignItems: "center",
    gap: 2,
    minWidth: 0,
  },
  cellTopMain: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    alignItems: "center",
    gap: 6,
    border: "none",
    background: "transparent",
    padding: 0,
    cursor: "pointer",
    fontFamily: "inherit",
    textAlign: "left",
  },
  cellTime: {
    fontSize: 13,
    fontWeight: 800,
    color: "#0f172a",
    fontVariantNumeric: "tabular-nums",
    flexShrink: 0,
    minWidth: 40,
  },
  cellStatsInline: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    minWidth: 0,
    flexWrap: "nowrap",
  },
  cellMapBtn: {
    width: 24,
    height: 24,
    borderRadius: 6,
    border: "1px solid #cbd5e1",
    background: "#fff",
    cursor: "pointer",
    fontSize: 12,
    flexShrink: 0,
    lineHeight: 1,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
  cellMapBtnMuted: {
    opacity: 0.45,
  },
  cellStat: {
    display: "inline-flex",
    alignItems: "center",
    gap: 3,
    fontSize: 11,
    color: "#334155",
    minWidth: 0,
  },
  cellStatCompact: {
    gap: 1,
    fontSize: 10,
  },
  cellStatVal: {
    fontVariantNumeric: "tabular-nums",
    fontWeight: 800,
    color: "#0f172a",
    fontSize: "0.95em",
  },
  cellGearBtn: {
    width: 24,
    height: 24,
    borderRadius: 6,
    border: "1px solid #cbd5e1",
    background: "#fff",
    cursor: "pointer",
    fontSize: 12,
    flexShrink: 0,
    lineHeight: 1,
  },
  cellList: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "flex",
    flexDirection: "column",
    gap: 2,
    maxHeight: 120,
    overflowY: "auto",
  },
  cellRowBtn: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    width: "100%",
    textAlign: "left",
    border: "1px solid transparent",
    background: "rgba(255,255,255,0.72)",
    borderRadius: 5,
    padding: "3px 4px",
    cursor: "pointer",
    fontSize: 11,
    minWidth: 0,
  },
  cellRowConsegnato: {
    opacity: 0.72,
    background: "#f1f5f9",
    borderColor: "#cbd5e1",
  },
  cellRowUnassigned: {
    borderStyle: "dashed",
    borderColor: "#f59e0b",
    background: "#fffbeb",
  },
  cellPonyTag: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 16,
    height: 16,
    borderRadius: 4,
    background: "#0f172a",
    color: "#fff",
    fontWeight: 800,
    fontSize: 9,
    flexShrink: 0,
  },
  cellPonyTagWait: {
    background: "#b45309",
  },
  cellAddr: {
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    color: "#0f172a",
  },
  cellPz: {
    fontWeight: 700,
    color: "#334155",
    flexShrink: 0,
    fontSize: 11,
  },
  mapOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(15, 23, 42, 0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2400,
    padding: 16,
  },
  mapModal: {
    background: "#fff",
    borderRadius: 12,
    padding: 16,
    width: "min(96vw, 720px)",
    maxHeight: "90vh",
    overflowY: "auto",
    boxShadow: "0 12px 40px rgba(15,23,42,0.18)",
  },
  mapModalHead: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },
  mapStatusLine: {
    margin: "0 0 10px",
    fontSize: 12,
    color: "#0f766e",
    fontWeight: 600,
  },
  mapStatusWarn: {
    margin: "0 0 10px",
    fontSize: 12,
    color: "#9a3412",
    lineHeight: 1.4,
  },
  mapPlaceholder: {
    height: 200,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f1f5f9",
    borderRadius: 10,
    border: "1px dashed #cbd5e1",
    color: "#64748b",
    fontSize: 13,
  },
  heatHint: {
    margin: "10px 0 0",
    fontSize: 11,
    color: "#64748b",
    lineHeight: 1.4,
  },
  ponyBlock: {
    marginBottom: 14,
  },
  ponyBlockHead: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  ponyTagBig: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 28,
    height: 28,
    borderRadius: 8,
    background: "#0f172a",
    color: "#fff",
    fontWeight: 800,
    fontSize: 13,
  },
  ponyBlockCount: {
    fontSize: 12,
    fontWeight: 700,
    color: "#64748b",
  },
  emptyPonyLabel: {
    fontSize: 12,
    color: "#94a3b8",
    fontStyle: "italic",
    padding: "4px 8px",
  },
  list: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  gearBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    border: "1px solid #cbd5e1",
    background: "#fff",
    cursor: "pointer",
    fontSize: 16,
  },
  gearBtnActive: {
    background: "#0f766e",
    color: "#fff",
    borderColor: "#0f766e",
  },
  moveBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    border: "1px solid #94a3b8",
    background: "#fff",
    fontWeight: 800,
    cursor: "pointer",
  },
  rowBtn: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    width: "100%",
    textAlign: "left",
    border: "1px solid transparent",
    background: "#fff",
    borderRadius: 6,
    padding: "6px 8px",
    cursor: "pointer",
    fontSize: 13,
  },
  rowBtnSelected: {
    borderColor: "#0f766e",
    background: "#ecfdf5",
  },
  rowBtnOnline: {
    borderColor: "#fdba8c",
    background: "#fff1e8",
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: "#cbd5e1",
    flexShrink: 0,
  },
  onlineDotOn: {
    background: "#ea580c",
    boxShadow: "0 0 0 3px #fff1e8",
  },
  timeTag: {
    fontSize: 11,
    fontWeight: 800,
    color: "#475569",
    minWidth: 36,
    flexShrink: 0,
  },
  manualMark: {
    color: "#c2410c",
    fontWeight: 800,
    fontSize: 12,
  },
  splitMark: {
    color: "#7c3aed",
    fontWeight: 800,
    fontSize: 10,
    flexShrink: 0,
  },
  addr: {
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    color: "#0f172a",
  },
  pz: {
    fontWeight: 700,
    color: "#334155",
    flexShrink: 0,
  },
}
