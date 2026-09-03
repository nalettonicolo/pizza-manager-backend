import { useCallback, useEffect, useState } from "react"
import { useTenant } from "@/app/contexts/TenantContext"
import {
  cassaAssegnaConsegnaPony,
  cassaConsegneOdierne,
  cassaElencaPony,
} from "@/features/admin/services/adminService"
import { euro, groupConsegneByPony } from "@/features/operative/cassa/utils/cassaDeliveryIncassi"
import { formatIndirizzoDisplayItaliano } from "@/utils/formatIndirizzoItaliano"

/**
 * Conteggio pony: consegne di oggi (in viaggio e chiuse), raggruppate per ragazzo.
 * Aperta da Cassa, a destra di Live.
 */
export default function CassaDeliveryIncassiPanel({ onClose }) {
  const { tenantId } = useTenant()
  const [rows, setRows] = useState([])
  const [ponies, setPonies] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [assigningId, setAssigningId] = useState(null)

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    setError(null)
    try {
      const [data, elenco] = await Promise.all([
        cassaConsegneOdierne(tenantId),
        cassaElencaPony(tenantId).catch(() => []),
      ])
      setRows(Array.isArray(data) ? data : [])
      setPonies(Array.isArray(elenco) ? elenco : [])
    } catch (e) {
      setError(e?.message || "Impossibile caricare le consegne di oggi.")
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  const assegna = async (ordineId, riderId) => {
    if (!ordineId || !riderId) return
    setAssigningId(ordineId)
    setError(null)
    try {
      await cassaAssegnaConsegnaPony(ordineId, riderId)
      await load()
    } catch (e) {
      const msg = String(e?.message || "")
      if (/consegna_gia_assegnata/i.test(msg)) {
        setError("Questa consegna è già stata assegnata. Aggiorna l'elenco.")
      } else {
        setError(e?.message || "Impossibile assegnare la consegna.")
      }
      await load()
    } finally {
      setAssigningId(null)
    }
  }

  useEffect(() => {
    void load()
  }, [load])

  const groups = groupConsegneByPony(rows)
  const ponyOptions = mergePonyOptions(ponies, groups)

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        overflow: "auto",
        padding: 16,
        background: "#f8fafc",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: 18, color: "#0f172a" }}>Conteggio pony</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={() => void load()}
            style={btnGhost}
          >
            Aggiorna
          </button>
          {onClose ? (
            <button type="button" onClick={onClose} style={btnGhost}>
              Chiudi
            </button>
          ) : null}
        </div>
      </div>

      {error ? (
        <p style={{ color: "#b91c1c", fontWeight: 600 }} role="alert">
          {error}
        </p>
      ) : null}
      {loading && groups.length === 0 ? (
        <p style={{ color: "#64748b" }}>Caricamento…</p>
      ) : null}
      {!loading && groups.length === 0 && !error ? (
        <p style={{ color: "#64748b" }}>Nessuna consegna oggi.</p>
      ) : null}

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {groups.map((g) => (
          <section
            key={g.riderId || "none"}
            style={{
              background: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: 12,
              padding: 14,
            }}
          >
            <h3 style={{ margin: "0 0 10px", fontSize: 16, color: "#0f172a" }}>
              {g.riderId ? (g.nome || g.label) : g.label}
            </h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
                gap: 8,
                marginBottom: 12,
              }}
            >
              <TotaleCard label="Contanti" value={euro(g.totals.contanti)} />
              <TotaleCard label="Bancomat" value={euro(g.totals.bancomat)} />
              <TotaleCard label="Già pagato" value={euro(g.totals.gia_pagato)} />
              {g.totals.altro > 0 ? <TotaleCard label="Altro" value={euro(g.totals.altro)} /> : null}
            </div>
            {!g.riderId && !g.nome && ponyOptions.length === 0 ? (
              <p style={{ margin: "0 0 10px", fontSize: 13, color: "#64748b", lineHeight: 1.45 }}>
                Per assegnare, un pony deve aver già inserito il proprio nome a inizio turno.
              </p>
            ) : null}
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {g.ordini.map((o) => (
                <li
                  key={o.ordine_id || o.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 10,
                    padding: "8px 0",
                    borderTop: "1px solid #f1f5f9",
                    fontSize: 13,
                  }}
                >
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <strong>#{o.numero}</strong>{" "}
                    {o.nome_cliente || "Cliente"}
                    {o.stato_consegna ? (
                      <span style={{ marginLeft: 6, color: "#64748b", fontWeight: 600, fontSize: 11 }}>
                        {String(o.stato_consegna).replace("_", " ")}
                      </span>
                    ) : null}
                    {o.indirizzo_consegna ? (
                      <span style={{ display: "block", color: "#64748b", fontSize: 12 }}>
                        {formatIndirizzoDisplayItaliano(o.indirizzo_consegna)}
                      </span>
                    ) : null}
                    {!g.riderId && !g.nome && ponyOptions.length > 0 ? (
                      <AssegnaPonyControls
                        ordineId={o.ordine_id || o.id}
                        ponies={ponyOptions}
                        busy={assigningId === (o.ordine_id || o.id)}
                        onAssegna={assegna}
                      />
                    ) : null}
                  </span>
                  <span style={{ flexShrink: 0, fontWeight: 700 }}>{euro(o.totale)}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}

function mergePonyOptions(elenco, groups) {
  const map = new Map()
  for (const p of elenco || []) {
    const id = p.rider_id || p.id
    const nome = String(p.nome_display || p.nome || "").trim()
    if (id && nome) map.set(String(id), { rider_id: id, nome_display: nome })
  }
  for (const g of groups || []) {
    if (!g.riderId) continue
    const nome = String(g.nome || g.label || "").trim()
    if (!nome) continue
    if (!map.has(String(g.riderId))) {
      map.set(String(g.riderId), { rider_id: g.riderId, nome_display: nome })
    }
  }
  return [...map.values()]
}

function AssegnaPonyControls({ ordineId, ponies, busy, onAssegna }) {
  const [riderId, setRiderId] = useState(ponies[0]?.rider_id || ponies[0]?.id || "")

  useEffect(() => {
    const first = ponies[0]?.rider_id || ponies[0]?.id || ""
    setRiderId((prev) => (ponies.some((p) => String(p.rider_id || p.id) === String(prev)) ? prev : first))
  }, [ponies])

  return (
    <span
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 8,
        marginTop: 8,
      }}
    >
      <label style={{ fontSize: 12, color: "#334155", fontWeight: 600 }}>
        Assegna a
        <select
          value={riderId}
          onChange={(e) => setRiderId(e.target.value)}
          disabled={busy}
          style={{
            marginLeft: 8,
            padding: "6px 8px",
            borderRadius: 8,
            border: "1px solid #cbd5e1",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {ponies.map((p) => {
            const id = p.rider_id || p.id
            const nome = p.nome_display || p.nome || "Pony"
            return (
              <option key={id} value={id}>
                {nome}
              </option>
            )
          })}
        </select>
      </label>
      <button
        type="button"
        disabled={busy || !riderId}
        onClick={() => void onAssegna(ordineId, riderId)}
        style={{
          ...btnGhost,
          padding: "6px 10px",
          fontSize: 12,
          background: busy || !riderId ? "#f1f5f9" : "#eff6ff",
          borderColor: "#93c5fd",
          color: "#1d4ed8",
        }}
      >
        {busy ? "Assegno…" : "Assegna"}
      </button>
    </span>
  )
}

function TotaleCard({ label, value }) {
  return (
    <div
      style={{
        background: "#f8fafc",
        border: "1px solid #e2e8f0",
        borderRadius: 10,
        padding: "10px 12px",
      }}
    >
      <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 800, color: "#0f172a" }}>{value}</div>
    </div>
  )
}

const btnGhost = {
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  background: "#fff",
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
}
