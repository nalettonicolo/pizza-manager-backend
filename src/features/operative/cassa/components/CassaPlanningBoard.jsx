import { useMemo, useState, useCallback, useEffect } from "react"
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
  ponyBucketsWithEmpty,
  ponyDayLoadSummary,
  moveOrdinePony,
  assignDeliveriesToPonies,
} from "@/features/operative/cassa/utils/planningPonyAssign"
import { getLocalYYYYMMDD } from "@/utils/localDate"

function shortAddress(o) {
  const raw = ordineIndirizzoConsegna(o)
  if (raw) {
    const formatted = formatIndirizzoDisplayItaliano(raw)
    return formatted.length > 42 ? `${formatted.slice(0, 40)}…` : formatted
  }
  return ordineNomeCliente(o) || "Consegna"
}

function ShopIcon() {
  return (
    <span aria-hidden style={{ fontSize: 14, lineHeight: 1 }} title="Ritiro in negozio">
      🏪
    </span>
  )
}

function capacityTier(value, max) {
  if (!max || max <= 0) return "ok"
  const pct = (Number(value) || 0) / max
  if (pct >= 1) return "full"
  if (pct >= 0.7) return "warn"
  return "ok"
}

/** Numero + barra colorata (teal → ambra → rosso avvicinandosi al limite forno): il sovraccarico
 * si vede a colpo d'occhio senza dover leggere/confrontare i numeri fascia per fascia. */
function CapacityBar({ value, max }) {
  const v = Number(value) || 0
  const m = Number(max) || 0
  const pct = m > 0 ? Math.min(100, Math.round((v / m) * 100)) : 0
  const tier = capacityTier(v, m)
  return (
    <div style={styles.capWrap}>
      <span style={styles.capNum}>
        {v}/{m}
      </span>
      <span style={styles.capTrack}>
        <span style={{ ...styles.capFill, ...styles[`capFill_${tier}`], width: `${pct}%` }} />
      </span>
    </div>
  )
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
 * Planning a schermo pieno: fasce con righe consegna (pony A/B) e ritiro.
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
}) {
  const dayKey = getLocalYYYYMMDD()
  const ponyCount = useMemo(() => ponyCountForToday(parametri), [parametri])
  const [overrides, setOverrides] = useState(() => loadPonyOverrides(tenantId, dayKey))
  const [editSlotKey, setEditSlotKey] = useState(null)
  const [selectedOrdineId, setSelectedOrdineId] = useState(null)
  const [draftOverrides, setDraftOverrides] = useState(null)

  useEffect(() => {
    setOverrides(loadPonyOverrides(tenantId, dayKey))
  }, [tenantId, dayKey])

  const activeOverrides = draftOverrides || overrides

  const dayLoad = useMemo(() => {
    const cleaned = (rows || []).map((row) => ({
      ...row,
      deliveryOrdiniList: (row.deliveryOrdiniList || []).filter((o) => !ordineIsAnnullato(o)),
    }))
    return ponyDayLoadSummary(cleaned, ponyCount, activeOverrides)
  }, [rows, ponyCount, activeOverrides])

  /** Fasce senza consegne/ritiri raggruppate in un'unica riga (invece di una riga vuota per
   * fascia): più a colpo d'occhio, meno scroll per arrivare alle fasce che contano davvero. */
  const displayItems = useMemo(() => {
    const items = []
    let emptyRun = []
    const flushEmpty = () => {
      if (emptyRun.length === 0) return
      items.push({ type: "emptyGroup", rows: emptyRun })
      emptyRun = []
    }
    for (const row of rows || []) {
      const deliveryList = (row.deliveryOrdiniList || []).filter((o) => !ordineIsAnnullato(o))
      const ritiroList = (row.ritiroOrdiniList || []).filter((o) => !ordineIsAnnullato(o))
      if (deliveryList.length > 0 || ritiroList.length > 0) {
        flushEmpty()
        items.push({ type: "slot", row, deliveryList, ritiroList })
      } else {
        emptyRun.push(row)
      }
    }
    flushEmpty()
    return items
  }, [rows])

  const toggleGear = useCallback(
    (slotKey) => {
      if (!canEditPony) return
      if (editSlotKey === slotKey) {
        // Salva
        const next = draftOverrides || overrides
        savePonyOverrides(tenantId, dayKey, next)
        setOverrides(next)
        setDraftOverrides(null)
        setEditSlotKey(null)
        setSelectedOrdineId(null)
        return
      }
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
      const row = (rows || []).find((r) => r.slotKey === editSlotKey)
      const deliveryList = (row?.deliveryOrdiniList || []).filter((o) => !ordineIsAnnullato(o))
      const assigned = assignDeliveriesToPonies(deliveryList, ponyCount, draftOverrides)
      const cur = assigned.find((a) => a.ordine.id === selectedOrdineId)
      setDraftOverrides((prev) =>
        moveOrdinePony(prev || {}, selectedOrdineId, ponyCount, direction, cur?.ponyLetter),
      )
    },
    [selectedOrdineId, draftOverrides, ponyCount, editSlotKey, rows],
  )

  return (
    <div style={styles.wrap}>
      <div style={styles.header}>
        <div>
          <strong style={{ fontSize: 16 }}>Situazione planning</strong>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
            Tabella fasce · capacità forno <strong>{maxPizzeForno}</strong> pz · ↑↓ sposta tra pony
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
            </span>
          </div>
        ))}
      </div>

      {editSlotKey ? (
        <p style={styles.editHint}>
          Modifica pony: seleziona una consegna, ↑↓ la sposta sull&apos;altro pony presente, richiudi ⚙ per salvare.
        </p>
      ) : null}

      <div style={styles.scroll}>
        {(rows || []).length === 0 ? (
          <p style={{ margin: "24px 12px", color: "#64748b", fontSize: 14, textAlign: "center" }}>
            Nessuna fascia oraria disponibile. Controlla gli orari di apertura del locale in Impostazioni.
          </p>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.thTime}>Orario</th>
                <th style={styles.th}>Consegne / ritiri</th>
                <th style={styles.thPz}>Forno</th>
                {canEditPony ? <th style={styles.thGear} /> : null}
              </tr>
            </thead>
            <tbody>
              {displayItems.map((item) => {
                if (item.type === "emptyGroup") {
                  const first = item.rows[0]
                  const last = item.rows[item.rows.length - 1]
                  const label = item.rows.length > 1 ? `${first.label} – ${last.label}` : first.label
                  const text =
                    item.rows.length > 1 ? `— ${item.rows.length} fasce libere —` : "— fascia libera —"
                  return (
                    <tr key={`empty-${first.slotKey}`} style={styles.tr}>
                      <td style={styles.tdTime}>
                        <strong style={{ color: "#94a3b8", fontSize: 12.5 }}>{label}</strong>
                      </td>
                      <td style={styles.tdBody}>
                        <span style={styles.emptySlot}>{text}</span>
                      </td>
                      <td style={styles.tdPz}>
                        <CapacityBar value={0} max={maxPizzeForno} />
                      </td>
                      {canEditPony ? <td style={styles.tdGear} /> : null}
                    </tr>
                  )
                }

                const { row, deliveryList, ritiroList } = item
                const buckets = ponyBucketsWithEmpty(deliveryList, ponyCount, activeOverrides)
                const editing = editSlotKey === row.slotKey
                return (
                  <tr key={row.slotKey} style={styles.tr}>
                    <td style={styles.tdTime}>
                      <strong>{row.label}</strong>
                    </td>
                    <td style={styles.tdBody}>
                      <ul style={styles.list}>
                        {buckets.map((bucket) => {
                          if (bucket.items.length === 0) {
                            return (
                              <li key={`empty-${bucket.letter}`}>
                                <div style={styles.emptyPonyRow}>
                                  <span style={styles.ponyTag}>{bucket.letter}</span>
                                  <span style={styles.emptyPonyLabel}>— 0 consegne —</span>
                                </div>
                              </li>
                            )
                          }
                          return bucket.items.map((a) => {
                            const o = a.ordine
                            const pz = pizzePerOrdine?.[o.id] ?? pizzePerOrdine?.[String(o.id)] ?? 0
                            const selected = editing && selectedOrdineId === o.id
                            const online = isOrdineOnlineCanale(o)
                            return (
                              <li key={o.id}>
                                <button
                                  type="button"
                                  style={{
                                    ...styles.rowBtn,
                                    ...(online ? styles.rowBtnOnline : {}),
                                    ...(selected ? styles.rowBtnSelected : {}),
                                  }}
                                  onClick={() => onSelectRow(o.id, row.slotKey)}
                                >
                                  <ArrowIcon dir={a.arrowDir} />
                                  <span style={{ ...styles.onlineDot, ...(online ? styles.onlineDotOn : {}) }} />
                                  <span style={styles.ponyTag}>{a.label}</span>
                                  {a.manual ? (
                                    <span style={styles.manualMark} title="Assegnazione modificata in cassa">
                                      ✎
                                    </span>
                                  ) : null}
                                  <span style={styles.addr}>{shortAddress(o)}</span>
                                  <span style={styles.pz}>{pz}</span>
                                </button>
                              </li>
                            )
                          })
                        })}
                        {ritiroList.map((o) => {
                          const pz = pizzePerOrdine?.[o.id] ?? pizzePerOrdine?.[String(o.id)] ?? 0
                          const nome = ordineNomeCliente(o) || "Cliente"
                          const online = isOrdineOnlineCanale(o)
                          return (
                            <li key={o.id}>
                              <button
                                type="button"
                                style={{ ...styles.rowBtn, ...(online ? styles.rowBtnOnline : {}) }}
                                onClick={() => onOpenOrdine?.(o.id)}
                              >
                                <ShopIcon />
                                <span style={{ ...styles.onlineDot, ...(online ? styles.onlineDotOn : {}) }} />
                                <span style={styles.addr}>{nome}</span>
                                <span style={styles.pz}>{pz}</span>
                              </button>
                            </li>
                          )
                        })}
                      </ul>
                      {editing && selectedOrdineId ? (
                        <span style={{ display: "inline-flex", gap: 4, marginTop: 4 }}>
                          <button type="button" style={styles.moveBtn} onClick={() => onMoveSelected("up")} title="Pony precedente">
                            ↑
                          </button>
                          <button type="button" style={styles.moveBtn} onClick={() => onMoveSelected("down")} title="Pony successivo">
                            ↓
                          </button>
                        </span>
                      ) : null}
                    </td>
                    <td style={styles.tdPz}>
                      <CapacityBar value={row.totPizzeForno} max={maxPizzeForno} />
                    </td>
                    {canEditPony ? (
                      <td style={styles.tdGear}>
                        <button
                          type="button"
                          style={{
                            ...styles.gearBtn,
                            ...(editing ? styles.gearBtnActive : {}),
                          }}
                          title={editing ? "Salva assegnazione pony" : "Modifica assegnazione pony"}
                          onClick={() => toggleGear(row.slotKey)}
                        >
                          ⚙
                        </button>
                      </td>
                    ) : null}
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
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
  emptyPonyRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "4px 8px",
    fontSize: 12,
    color: "#94a3b8",
  },
  emptyPonyLabel: { fontStyle: "italic" },
  scroll: {
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    padding: "0 0 16px",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    tableLayout: "fixed",
  },
  thTime: {
    textAlign: "left",
    padding: "10px 12px",
    fontSize: 12,
    fontWeight: 800,
    color: "#475569",
    background: "#e2e8f0",
    borderBottom: "2px solid #cbd5e1",
    width: 72,
    position: "sticky",
    top: 0,
    zIndex: 1,
  },
  th: {
    textAlign: "left",
    padding: "10px 12px",
    fontSize: 12,
    fontWeight: 800,
    color: "#475569",
    background: "#e2e8f0",
    borderBottom: "2px solid #cbd5e1",
    position: "sticky",
    top: 0,
    zIndex: 1,
  },
  thPz: {
    textAlign: "right",
    padding: "10px 12px",
    fontSize: 12,
    fontWeight: 800,
    color: "#475569",
    background: "#e2e8f0",
    borderBottom: "2px solid #cbd5e1",
    width: 72,
    position: "sticky",
    top: 0,
    zIndex: 1,
  },
  thGear: {
    width: 44,
    background: "#e2e8f0",
    borderBottom: "2px solid #cbd5e1",
    position: "sticky",
    top: 0,
    zIndex: 1,
  },
  tr: {
    borderBottom: "1px solid #e2e8f0",
  },
  tdTime: {
    padding: "8px 12px",
    verticalAlign: "top",
    fontSize: 14,
    color: "#0f172a",
    background: "#f8fafc",
    borderRight: "1px solid #e2e8f0",
  },
  tdBody: {
    padding: "6px 8px",
    verticalAlign: "top",
  },
  tdPz: {
    padding: "8px 12px",
    verticalAlign: "top",
    textAlign: "right",
    whiteSpace: "nowrap",
  },
  capWrap: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 4,
  },
  capNum: {
    fontSize: 12,
    fontWeight: 700,
    color: "#334155",
    fontVariantNumeric: "tabular-nums",
  },
  capTrack: {
    display: "block",
    width: 56,
    height: 5,
    borderRadius: 999,
    background: "#e2e8f0",
    overflow: "hidden",
  },
  capFill: {
    display: "block",
    height: "100%",
    borderRadius: 999,
  },
  capFill_ok: { background: "#0f766e" },
  capFill_warn: { background: "#d97706" },
  capFill_full: { background: "#c62828" },
  tdGear: {
    padding: "6px 4px",
    verticalAlign: "top",
    textAlign: "center",
  },
  emptySlot: {
    display: "block",
    padding: "6px 8px",
    fontSize: 12,
    color: "#94a3b8",
    fontStyle: "italic",
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
  ponyTag: {
    fontSize: 11,
    fontWeight: 800,
    color: "#334155",
    minWidth: 28,
  },
  manualMark: {
    color: "#c2410c",
    fontWeight: 800,
    fontSize: 12,
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
