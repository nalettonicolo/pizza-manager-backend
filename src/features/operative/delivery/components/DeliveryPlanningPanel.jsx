import { useEffect, useMemo, useState } from "react"
import { useTenant } from "@/app/contexts/TenantContext"
import CassaPlanningBoard from "@/features/operative/cassa/components/CassaPlanningBoard"
import {
  getOrders,
  getRigheAggregateByOrdineIds,
} from "@/features/admin/services/adminService"
import {
  PLANNING_GRID_SLOT_MINUTES,
  buildSlotsFullDay,
  getTodayOrariConsegna,
  groupOrdersBySlotOrarioRitiro,
  groupOrdiniBySlotOrarioRitiro,
  groupPizzeBySlotOrarioRitiro,
  slotColor,
} from "@/features/operative/cassa/utils/planningUtils"
import { maxPizzePerSlot } from "@/features/operative/cassa/utils/slotCapacityUtils"
import { ordineIsDelivery } from "@/features/operative/cassa/utils/ordineFieldHelpers"
import { ordineIsAnnullato } from "@/utils/incassiFromOrdini"

/**
 * Stesso layout di Cassa → «Situazione planning» (griglia forno, pony, mappa).
 * Aperto dalla schermata Delivery / Pony.
 */
export default function DeliveryPlanningPanel({ open, onClose, tenantId, orariSettimana }) {
  const { tenantData } = useTenant()
  const [orders, setOrders] = useState([])
  const [pizzePerOrdine, setPizzePerOrdine] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const parametri = tenantData?.parametri_operativi || {}
  const orariOggi = useMemo(
    () => getTodayOrariConsegna(orariSettimana ?? tenantData?.orari_settimana),
    [orariSettimana, tenantData?.orari_settimana],
  )
  const maxPizzeForno = maxPizzePerSlot(parametri)
  const sogliaGiallo = Number(parametri.soglia_giallo_pizze) || 10

  useEffect(() => {
    if (!open) return undefined
    let cancelled = false
    ;(async () => {
      if (!tenantId) {
        setOrders([])
        setError("Locale non disponibile.")
        return
      }
      setLoading(true)
      setError(null)
      try {
        const data = await getOrders(tenantId, { todayOnly: true, limit: 200 })
        if (cancelled) return
        const rows = (data || []).filter((o) => !ordineIsAnnullato(o))
        setOrders(rows)
        const ids = rows.map((o) => o.id).filter(Boolean)
        const pizze = ids.length ? await getRigheAggregateByOrdineIds(ids, tenantId) : {}
        if (!cancelled) setPizzePerOrdine(pizze || {})
      } catch (err) {
        if (!cancelled) {
          setOrders([])
          setPizzePerOrdine({})
          setError(err?.message || "Impossibile caricare il planning.")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, tenantId])

  const planningSlotsGrid = useMemo(() => buildSlotsFullDay(orariOggi), [orariOggi])

  const rows = useMemo(() => {
    const delivery = orders.filter((o) => ordineIsDelivery(o))
    const negozio = orders.filter((o) => !ordineIsDelivery(o))
    const ordiniPerSlotDelivery = groupOrdersBySlotOrarioRitiro(delivery, PLANNING_GRID_SLOT_MINUTES)
    const ordiniPerSlotNegozio = groupOrdersBySlotOrarioRitiro(negozio, PLANNING_GRID_SLOT_MINUTES)
    const ordiniBySlotDelivery = groupOrdiniBySlotOrarioRitiro(delivery, PLANNING_GRID_SLOT_MINUTES)
    const ordiniBySlotNegozio = groupOrdiniBySlotOrarioRitiro(negozio, PLANNING_GRID_SLOT_MINUTES)
    const pizzePerSlotDelivery = groupPizzeBySlotOrarioRitiro(
      delivery,
      pizzePerOrdine,
      PLANNING_GRID_SLOT_MINUTES,
    )
    const pizzePerSlotNegozio = groupPizzeBySlotOrarioRitiro(
      negozio,
      pizzePerOrdine,
      PLANNING_GRID_SLOT_MINUTES,
    )
    return planningSlotsGrid.map((slot) => {
      const deliveryPizze = pizzePerSlotDelivery[slot.key] ?? 0
      const ritiroPizze = pizzePerSlotNegozio[slot.key] ?? 0
      const totPizzeForno = deliveryPizze + ritiroPizze
      const fornoColor = slotColor(totPizzeForno, maxPizzeForno, sogliaGiallo)
      return {
        slotKey: slot.key,
        label: slot.label,
        deliveryOrdini: ordiniPerSlotDelivery[slot.key] ?? 0,
        deliveryPizze,
        deliveryOrdiniList: ordiniBySlotDelivery[slot.key] || [],
        ritiroOrdini: ordiniPerSlotNegozio[slot.key] ?? 0,
        ritiroPizze,
        ritiroOrdiniList: ordiniBySlotNegozio[slot.key] || [],
        totPizzeForno,
        fornoColor,
        deliveryColor: fornoColor,
        ritiroColor: fornoColor,
      }
    })
  }, [orders, pizzePerOrdine, planningSlotsGrid, maxPizzeForno, sogliaGiallo])

  if (!open) return null

  const shopCoords =
    tenantData?.lat != null && tenantData?.lng != null
      ? { lat: Number(tenantData.lat), lng: Number(tenantData.lng) }
      : null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Situazione planning"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1200,
        background: "rgba(15, 23, 42, 0.45)",
        display: "flex",
        alignItems: "stretch",
        justifyContent: "center",
        padding: "min(16px, 2vw)",
        boxSizing: "border-box",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(1100px, 100%)",
          height: "100%",
          maxHeight: "100%",
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          borderRadius: 12,
          boxShadow: "0 12px 40px rgba(0,0,0,0.22)",
        }}
      >
        {error ? (
          <p style={{ margin: 16, color: "#b91c1c", fontWeight: 600 }} role="alert">
            {error}
          </p>
        ) : null}
        {loading && rows.length === 0 ? (
          <p style={{ margin: 16, color: "#64748b" }}>Caricamento planning…</p>
        ) : (
          <CassaPlanningBoard
            rows={rows}
            pizzePerOrdine={pizzePerOrdine}
            parametri={parametri}
            tenantId={tenantId}
            canEditPony={false}
            maxPizzeForno={maxPizzeForno}
            orariOggi={orariOggi}
            shopCoords={shopCoords}
            shopLogoUrl={tenantData?.logo_url ?? tenantData?.logoUrl ?? null}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  )
}
