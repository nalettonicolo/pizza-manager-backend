import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { getTenants } from "@/features/superadmin/services/superadminService"
import { supabase } from "@/lib/supabaseClient"
import {
  clearSupportTenantOverride,
  setSupportTenantOverride,
  withSupportTenantQuery,
} from "@/utils/supportTenantOverride"

/** Preset griglia pagine da verificare in contemporanea. */
export const QA_PRESETS = {
  operativo: {
    label: "Operativo (sala)",
    panels: [
      { path: "/operative/cassa", label: "Cassa" },
      { path: "/operative/cucina", label: "Cucina" },
      { path: "/operative/bancone", label: "Bancone" },
      { path: "/operative/pizzaioli", label: "Pizzaioli" },
      { path: "/operative/delivery", label: "Delivery" },
      { path: "/operative/delivery/mappa", label: "Mappa consegne" },
      { path: "/operative/rider", label: "Rider PWA" },
      { path: "/operative/turni", label: "Turni" },
    ],
  },
  cliente: {
    label: "Cliente / vetrina",
    panels: [
      { path: "/preview", label: "Vetrina" },
      { path: "/negozio", label: "Negozio" },
      { path: "/login", label: "Login" },
      { path: "/cliente", label: "Area cliente" },
      { path: "/cliente/ordini", label: "Ordini cliente" },
      { path: "/cliente/profilo", label: "Profilo" },
      { path: "/ordina", label: "Checkout consegna" },
      { path: "/ordine", label: "Checkout legacy" },
    ],
  },
  admin: {
    label: "Admin tenant",
    panels: [
      { path: "/admin/home", label: "Home admin" },
      { path: "/admin/ordini", label: "Ordini" },
      { path: "/admin/menu/categorie", label: "Menu" },
      { path: "/admin/settings/parametri", label: "Parametri" },
      { path: "/admin/report", label: "Report" },
      { path: "/admin/notifiche-outbox", label: "Coda notifiche" },
      { path: "/admin/documenti", label: "Documenti (firma contratto)" },
    ],
  },
  mix: {
    label: "Mix supporto",
    panels: [
      { path: "/operative/cassa", label: "Cassa" },
      { path: "/operative/cucina", label: "Cucina" },
      { path: "/operative/delivery", label: "Delivery" },
      { path: "/preview", label: "Vetrina" },
      { path: "/operative/pizzaioli", label: "Pizzaioli" },
    ],
  },
}

/** Larghezza “desktop” renderizzata nell’anteprima singola (poi scalata). */
const PREVIEW_INNER_W = 1280
const PREVIEW_INNER_H = 800

function formatAge(iso) {
  if (!iso) return "—"
  const ms = Date.now() - new Date(iso).getTime()
  if (!Number.isFinite(ms) || ms < 0) return "—"
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s fa`
  return `${Math.round(s / 60)} min fa`
}

function openSupportWindow(url, label, cascadeIndex = 0, { navigate = true, focus = true } = {}) {
  const w = Math.min(1400, window.screen.availWidth - 40)
  const h = Math.min(900, window.screen.availHeight - 80)
  const offset = (Number(cascadeIndex) || 0) * 32
  const left = Math.max(0, Math.round((window.screen.availWidth - w) / 2) + offset)
  const top = Math.max(0, Math.round((window.screen.availHeight - h) / 2) + offset)
  // Nome sempre univoco: altrimenti il browser riusa la stessa finestra invece di aprirne una nuova.
  const stamp = `${Date.now()}_${cascadeIndex}_${Math.random().toString(36).slice(2, 7)}`
  const name = `pm_qa_${String(label || "view").replace(/\W+/g, "_").slice(0, 16)}_${stamp}`
  const features = `popup=yes,width=${w},height=${h},left=${left},top=${top},noopener=no,noreferrer=no`
  const win = window.open(navigate ? url : "about:blank", name, features)
  if (win && focus) {
    try {
      win.focus()
    } catch {
      /* ignore */
    }
  }
  return win
}

function ScaledLivePreview({ title, src, onOpenWindow }) {
  const shellRef = useRef(null)
  const [scale, setScale] = useState(0.4)
  const [status, setStatus] = useState("loading")
  const [frameKey, setFrameKey] = useState(0)

  useEffect(() => {
    setStatus("loading")
    const t = window.setTimeout(() => {
      setStatus((s) => (s === "loading" ? "error" : s))
    }, 22000)
    return () => window.clearTimeout(t)
  }, [src, frameKey])

  useEffect(() => {
    const el = shellRef.current
    if (!el || typeof ResizeObserver === "undefined") return undefined
    const sync = () => {
      const { width, height } = el.getBoundingClientRect()
      if (width < 40 || height < 40) return
      const next = Math.min(width / PREVIEW_INNER_W, height / PREVIEW_INNER_H) * 0.98
      setScale(Number.isFinite(next) && next > 0 ? next : 0.35)
    }
    sync()
    const ro = new ResizeObserver(sync)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const retry = (e) => {
    e?.stopPropagation?.()
    setFrameKey((k) => k + 1)
    setStatus("loading")
  }

  return (
    <div
      ref={shellRef}
      style={{
        flex: 1,
        minHeight: 280,
        position: "relative",
        overflow: "hidden",
        background: "#94a3b8",
      }}
    >
      <iframe
        key={`${src}-${frameKey}`}
        title={title}
        src={src}
        onLoad={() => setStatus("ready")}
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: PREVIEW_INNER_W,
          height: PREVIEW_INNER_H,
          border: "none",
          background: "#fff",
          transform: `translate(-50%, -50%) scale(${scale})`,
          transformOrigin: "center center",
        }}
      />
      {status === "loading" ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(15,23,42,0.45)",
            color: "#fff",
            fontSize: 14,
            fontWeight: 700,
            pointerEvents: "none",
            zIndex: 2,
          }}
        >
          Caricamento {title}…
        </div>
      ) : null}
      {status === "error" ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            background: "rgba(127,29,29,0.92)",
            color: "#fff",
            fontSize: 13,
            padding: 16,
            textAlign: "center",
            zIndex: 2,
          }}
        >
          <p style={{ margin: 0, maxWidth: 320, lineHeight: 1.45 }}>
            Anteprima non disponibile in questa scheda. Usa <strong>Apri finestra</strong> (schermo reale).
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
            <button
              type="button"
              onClick={retry}
              style={{
                border: "1px solid #fff",
                background: "transparent",
                color: "#fff",
                fontWeight: 700,
                fontSize: 12,
                padding: "8px 12px",
                borderRadius: 8,
                cursor: "pointer",
              }}
            >
              Riprova
            </button>
            <button
              type="button"
              onClick={onOpenWindow}
              style={{
                border: "none",
                background: "#fff",
                color: "#7f1d1d",
                fontWeight: 700,
                fontSize: 12,
                padding: "8px 12px",
                borderRadius: 8,
                cursor: "pointer",
              }}
            >
              Apri finestra
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default function SuperadminQaConsolePage() {
  const [tenants, setTenants] = useState([])
  const [tenantId, setTenantId] = useState("")
  const [presetKey, setPresetKey] = useState("mix")
  const [reloadKey, setReloadKey] = useState(0)
  const [presence, setPresence] = useState([])
  const [presenceErr, setPresenceErr] = useState(null)
  const [focusPath, setFocusPath] = useState(null)
  const [loadingTenants, setLoadingTenants] = useState(true)
  const [popupHint, setPopupHint] = useState(null)
  /** Schermate ancora da aprire se il browser ne ha bloccate alcune. */
  const [pendingPanels, setPendingPanels] = useState([])
  const [openedCount, setOpenedCount] = useState(0)
  /** Una sola anteprima iframe alla volta (più iframe = tutte vuote). */
  const [inlinePreviewPath, setInlinePreviewPath] = useState(null)
  const openedWindowsRef = useRef([])
  const cascadeRef = useRef(0)

  useEffect(() => {
    setInlinePreviewPath(null)
  }, [presetKey, tenantId])

  useEffect(() => {
    let c = false
    ;(async () => {
      try {
        const rows = await getTenants()
        if (!c) setTenants(Array.isArray(rows) ? rows : [])
      } catch {
        if (!c) setTenants([])
      } finally {
        if (!c) setLoadingTenants(false)
      }
    })()
    return () => {
      c = true
    }
  }, [])

  const applyTenant = useCallback((id) => {
    setTenantId(id)
    setFocusPath(null)
    setPendingPanels([])
    setOpenedCount(0)
    setPopupHint(null)
    setInlinePreviewPath(null)
    setSupportTenantOverride(id)
    window.dispatchEvent(new Event("pm-support-tenant"))
    setReloadKey((k) => k + 1)
  }, [])

  const clearTenant = useCallback(() => {
    setTenantId("")
    clearSupportTenantOverride()
    window.dispatchEvent(new Event("pm-support-tenant"))
    setReloadKey((k) => k + 1)
    setPresence([])
    setPendingPanels([])
    setOpenedCount(0)
    setPopupHint(null)
    setInlinePreviewPath(null)
  }, [])

  const loadPresence = useCallback(async () => {
    if (!tenantId) {
      setPresence([])
      return
    }
    try {
      setPresenceErr(null)
      const { data, error } = await supabase.rpc("sa_list_support_presence", {
        p_tenant_id: tenantId,
        p_max_age_seconds: 180,
      })
      if (error) throw error
      setPresence(Array.isArray(data) ? data : [])
    } catch (e) {
      setPresenceErr(e?.message || "Presence non disponibile (applica SQL modulo 26)")
      setPresence([])
    }
  }, [tenantId])

  useEffect(() => {
    loadPresence()
    if (!tenantId) return undefined
    const t = setInterval(loadPresence, 12_000)
    return () => clearInterval(t)
  }, [tenantId, loadPresence])

  const panels = useMemo(() => {
    const preset = QA_PRESETS[presetKey] || QA_PRESETS.mix
    let list = preset.panels
    const focusOk =
      focusPath &&
      !focusPath.startsWith("/login") &&
      !focusPath.startsWith("/superadmin")
    if (focusOk) {
      const hit = list.find((p) => p.path === focusPath)
      list = hit
        ? [hit, ...list.filter((p) => p.path !== focusPath)]
        : [{ path: focusPath, label: focusPath }, ...list]
    }
    return list
  }, [presetKey, focusPath])

  const presenceUseful = useMemo(
    () =>
      presence.filter((row) => {
        const p = String(row.path || "").split("?")[0]
        if (!p || p === "/" || p.startsWith("/login") || p.startsWith("/superadmin")) return false
        if (String(row.ruolo || "").toLowerCase().includes("superadmin")) return false
        return true
      }),
    [presence],
  )

  const origin = typeof window !== "undefined" ? window.location.origin : ""
  const selectedTenant = tenants.find((t) => String(t.id) === String(tenantId))
  const inlinePreviewItem = panels.find((p) => p.path === inlinePreviewPath) || null

  const panelUrl = useCallback(
    (path) => {
      const pathWithTenant = withSupportTenantQuery(path, tenantId)
      return `${origin}${pathWithTenant}&_r=${reloadKey}`
    },
    [origin, tenantId, reloadKey],
  )

  const openPanelWindow = useCallback(
    (item) => {
      if (!tenantId) {
        setPopupHint("Seleziona prima un tenant: senza tenant le finestre non hanno i dati della pizzeria.")
        return false
      }
      setSupportTenantOverride(tenantId)
      window.dispatchEvent(new Event("pm-support-tenant"))
      const url = panelUrl(item.path)
      const idx = cascadeRef.current++
      const win = openSupportWindow(url, item.label, idx)
      if (!win) {
        setPopupHint(
          "Popup bloccato. Nella barra indirizzi apri l’icona popup e scegli «Consenti sempre» per questo sito, poi riprova.",
        )
        return false
      }
      openedWindowsRef.current = [...openedWindowsRef.current.filter((w) => w && !w.closed), win]
      return true
    },
    [panelUrl, tenantId],
  )

  /** N finestre = N schede del preset, tutte nello stesso click (loop sincrono). */
  const openAllWindows = useCallback(() => {
    if (!panels.length) return
    if (!tenantId) {
      setPopupHint("Seleziona prima un tenant: senza tenant le finestre non hanno i dati della pizzeria.")
      return
    }
    setSupportTenantOverride(tenantId)
    window.dispatchEvent(new Event("pm-support-tenant"))

    const total = panels.length
    // Fase 1: apri N about:blank nello stesso gesto (senza focus).
    const slots = panels.map((item) => {
      const url = panelUrl(item.path)
      const idx = cascadeRef.current++
      const win = openSupportWindow(url, item.label, idx, { navigate: false, focus: false })
      return { item, url, win }
    })

    // Fase 2: naviga tutte le finestre aperte (sempre sincrono).
    const opened = []
    const blocked = []
    const liveWins = []
    for (const slot of slots) {
      if (!slot.win) {
        blocked.push(slot.item)
        continue
      }
      try {
        slot.win.location.href = slot.url
      } catch {
        /* ignore */
      }
      opened.push(slot.item)
      liveWins.push(slot.win)
    }
    // Focus solo sull’ultima, così non disturba le altre aperture.
    if (liveWins.length) {
      try {
        liveWins[liveWins.length - 1].focus()
      } catch {
        /* ignore */
      }
    }

    openedWindowsRef.current = [
      ...openedWindowsRef.current.filter((w) => w && !w.closed),
      ...liveWins,
    ]
    setPendingPanels(blocked)
    setOpenedCount(opened.length)

    if (opened.length === 0) {
      setPopupHint(
        `Nessuna delle ${total} finestre è partita. Consenti i popup per questo sito (icona nella barra indirizzi), poi riprova «Apri tutte».`,
      )
      return
    }
    if (blocked.length === 0) {
      setPopupHint(`Aperte tutte le ${opened.length} finestre.`)
      return
    }
    setPopupHint(
      `Aperte ${opened.length}/${total}. Mancano ${blocked.length}: consenti i popup e clicca di nuovo «Apri tutte», oppure «Apri prossima».`,
    )
  }, [panels, panelUrl, tenantId])

  const openNextPendingWindow = useCallback(() => {
    if (!pendingPanels.length) return
    const [next, ...rest] = pendingPanels
    const ok = openPanelWindow(next)
    if (!ok) return
    const done = openedCount + 1
    setPendingPanels(rest)
    setOpenedCount(done)
    if (rest.length) {
      setPopupHint(`Aperte ${done}/${done + rest.length}. Prossima: ${rest[0].label}.`)
    } else {
      setPopupHint(`Aperte tutte le ${done} finestre.`)
    }
  }, [pendingPanels, openPanelWindow, openedCount])

  const reloadAll = useCallback(() => {
    setReloadKey((k) => k + 1)
    for (const win of openedWindowsRef.current) {
      try {
        if (win && !win.closed) win.location.reload()
      } catch {
        /* cross-check ignore */
      }
    }
  }, [])

  const btnStyle = {
    marginTop: 18,
    padding: "8px 14px",
    borderRadius: 8,
    border: "1px solid #cbd5e1",
    background: "#fff",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 13,
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "calc(100vh - 56px - 32px)",
        minHeight: 560,
        gap: 12,
      }}
    >
      <header
        style={{
          flexShrink: 0,
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "flex-start",
          paddingBottom: 12,
          borderBottom: "1px solid #e2e8f0",
        }}
      >
        <div style={{ flex: "1 1 280px" }}>
          <h1 style={{ margin: "0 0 4px", fontSize: 20, color: "#0f172a" }}>Sala QA e supporto live</h1>
          <p style={{ margin: 0, fontSize: 13, color: "#64748b", lineHeight: 1.45, maxWidth: 720 }}>
            Per vedere le schermate reali: seleziona il tenant e usa <strong>Apri tutte in finestre</strong> (apre
            tutte in un click) oppure <strong>Apri finestra</strong> su ogni scheda. L’anteprima in pagina è
            opzionale e ne carica <strong>una sola</strong> alla volta.
          </p>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>
            Tenant
            <select
              value={tenantId}
              disabled={loadingTenants}
              onChange={(e) => (e.target.value ? applyTenant(e.target.value) : clearTenant())}
              style={{
                display: "block",
                marginTop: 4,
                minWidth: 220,
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid #cbd5e1",
              }}
            >
              <option value="">— Nessuno (solo layout) —</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome || t.id}
                </option>
              ))}
            </select>
          </label>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>
            Preset
            <select
              value={presetKey}
              onChange={(e) => {
                setPresetKey(e.target.value)
                setFocusPath(null)
                setPendingPanels([])
                setOpenedCount(0)
                setPopupHint(null)
                setInlinePreviewPath(null)
              }}
              style={{
                display: "block",
                marginTop: 4,
                minWidth: 160,
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid #cbd5e1",
              }}
            >
              {Object.entries(QA_PRESETS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={reloadAll} style={btnStyle}>
            Ricarica finestre aperte
          </button>
          <button
            type="button"
            onClick={openAllWindows}
            style={{ ...btnStyle, borderColor: "#93c5fd", background: "#eff6ff", color: "#1d4ed8" }}
          >
            Apri tutte in finestre ({panels.length})
          </button>
          {pendingPanels.length > 0 ? (
            <button
              type="button"
              onClick={openNextPendingWindow}
              style={{
                ...btnStyle,
                borderColor: "#86efac",
                background: "#dcfce7",
                color: "#166534",
                fontWeight: 700,
              }}
            >
              Apri prossima: {pendingPanels[0].label} ({openedCount + 1}/{openedCount + pendingPanels.length})
            </button>
          ) : null}
          {tenantId ? (
            <>
              <button
                type="button"
                onClick={() => openPanelWindow({ path: "/admin/home", label: "Admin tenant" })}
                style={{ ...btnStyle, borderColor: "#93c5fd", background: "#eff6ff", color: "#1d4ed8" }}
              >
                Apri area Admin tenant
              </button>
              <Link
                to={`/superadmin/tenants/${encodeURIComponent(tenantId)}/archivio-password`}
                style={{
                  ...btnStyle,
                  display: "inline-flex",
                  alignItems: "center",
                  textDecoration: "none",
                  color: "#0f172a",
                }}
              >
                Archivio password
              </Link>
              <button
                type="button"
                onClick={clearTenant}
                style={{
                  ...btnStyle,
                  borderColor: "#fecaca",
                  background: "#fef2f2",
                  color: "#b91c1c",
                }}
              >
                Esci da tenant
              </button>
            </>
          ) : null}
        </div>
      </header>

      {popupHint ? (
        <div
          style={{
            flexShrink: 0,
            padding: "8px 12px",
            background: pendingPanels.length ? "#ecfdf5" : "#eff6ff",
            border: pendingPanels.length ? "1px solid #86efac" : "1px solid #bfdbfe",
            borderRadius: 8,
            fontSize: 13,
            color: pendingPanels.length ? "#14532d" : "#1e3a8a",
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            alignItems: "center",
          }}
        >
          <span style={{ flex: "1 1 220px" }}>{popupHint}</span>
          {pendingPanels.length > 0 ? (
            <button
              type="button"
              onClick={openNextPendingWindow}
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                border: "1px solid #16a34a",
                background: "#16a34a",
                color: "#fff",
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Apri prossima ({pendingPanels[0].label})
            </button>
          ) : null}
        </div>
      ) : null}

      {selectedTenant ? (
        <div
          style={{
            flexShrink: 0,
            padding: "10px 12px",
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            borderRadius: 8,
            fontSize: 13,
          }}
        >
          <strong>Supporto attivo:</strong> {selectedTenant.nome}{" "}
          <code style={{ fontSize: 11 }}>{selectedTenant.id}</code>
          <span style={{ color: "#166534", marginLeft: 12 }}>
            Sei già loggato come Super Admin: le finestre aprono Cassa/Cucina… con i dati di questo tenant (lo staff
            cliente non deve essere online).
          </span>
          {presenceErr ? (
            <span style={{ color: "#b45309", marginLeft: 12 }}>{presenceErr}</span>
          ) : (
            <span style={{ color: "#166534", marginLeft: 12 }}>
              Utenti attivi ultimi 3 min: {presenceUseful.length}
            </span>
          )}
        </div>
      ) : (
        <div
          style={{
            flexShrink: 0,
            padding: "10px 12px",
            background: "#fffbeb",
            border: "1px solid #fde68a",
            borderRadius: 8,
            fontSize: 13,
            color: "#92400e",
          }}
        >
          Seleziona un tenant per vedere cassa/cucina/admin con i suoi dati (senza rilogarti come staff).
        </div>
      )}

      {tenantId && presenceUseful.length > 0 ? (
        <div style={{ flexShrink: 0 }}>
          <h2 style={{ margin: "0 0 8px", fontSize: 14, color: "#0f172a" }}>Presence live</h2>
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            {presenceUseful.map((row) => (
              <li key={row.user_id}>
                <button
                  type="button"
                  onClick={() => {
                    const pathOnly = String(row.path || "/").split("?")[0]
                    setFocusPath(pathOnly)
                    openPanelWindow({ path: pathOnly, label: row.page_label || pathOnly })
                    setReloadKey((k) => k + 1)
                  }}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid #c7d2fe",
                    background: "#eef2ff",
                    cursor: "pointer",
                    textAlign: "left",
                    fontSize: 12,
                  }}
                  title="Apri in finestra la pagina dove si trova l’utente"
                >
                  <strong>{row.page_label || row.path}</strong>
                  <br />
                  <span style={{ color: "#64748b" }}>
                    {row.ruolo || "utente"} · {formatAge(row.updated_at)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div
        style={{
          flexShrink: 0,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: 10,
        }}
      >
        {panels.map((item) => {
          const active = inlinePreviewPath === item.path
          return (
            <div
              key={item.path}
              style={{
                border: active ? "2px solid #4f46e5" : "1px solid #cbd5e1",
                borderRadius: 10,
                background: active ? "#eef2ff" : "#fff",
                padding: 12,
                display: "flex",
                flexDirection: "column",
                gap: 10,
                minHeight: 120,
              }}
            >
              <div>
                <div style={{ fontWeight: 800, fontSize: 14, color: "#0f172a" }}>{item.label}</div>
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{item.path}</div>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: "auto" }}>
                <button
                  type="button"
                  onClick={() => openPanelWindow(item)}
                  style={{
                    border: "none",
                    background: "#c0392b",
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: 12,
                    padding: "8px 10px",
                    borderRadius: 8,
                    cursor: "pointer",
                  }}
                >
                  Apri finestra
                </button>
                <button
                  type="button"
                  onClick={() => setInlinePreviewPath(item.path)}
                  style={{
                    border: "1px solid #64748b",
                    background: "#fff",
                    color: "#0f172a",
                    fontWeight: 700,
                    fontSize: 12,
                    padding: "8px 10px",
                    borderRadius: 8,
                    cursor: "pointer",
                  }}
                >
                  Anteprima qui
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {inlinePreviewItem ? (
        <div
          style={{
            flex: 1,
            minHeight: 360,
            display: "flex",
            flexDirection: "column",
            border: "1px solid #cbd5e1",
            borderRadius: 10,
            overflow: "hidden",
            background: "#f8fafc",
          }}
        >
          <div
            style={{
              flexShrink: 0,
              padding: "8px 12px",
              background: "#e2e8f0",
              borderBottom: "1px solid #cbd5e1",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 8,
            }}
          >
            <strong style={{ fontSize: 13 }}>Anteprima: {inlinePreviewItem.label}</strong>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                type="button"
                onClick={() => openPanelWindow(inlinePreviewItem)}
                style={{
                  border: "none",
                  background: "#1d4ed8",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 12,
                  padding: "6px 10px",
                  borderRadius: 6,
                  cursor: "pointer",
                }}
              >
                Apri finestra
              </button>
              <button
                type="button"
                onClick={() => setInlinePreviewPath(null)}
                style={{
                  border: "1px solid #94a3b8",
                  background: "#fff",
                  color: "#334155",
                  fontWeight: 600,
                  fontSize: 12,
                  padding: "6px 10px",
                  borderRadius: 6,
                  cursor: "pointer",
                }}
              >
                Chiudi anteprima
              </button>
            </div>
          </div>
          <ScaledLivePreview
            title={inlinePreviewItem.label}
            src={panelUrl(inlinePreviewItem.path)}
            onOpenWindow={() => openPanelWindow(inlinePreviewItem)}
          />
        </div>
      ) : (
        <div
          style={{
            flex: 1,
            minHeight: 160,
            border: "1px dashed #cbd5e1",
            borderRadius: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            color: "#64748b",
            fontSize: 14,
            textAlign: "center",
            background: "#f8fafc",
          }}
        >
          Nessuna anteprima aperta. Clicca <strong style={{ margin: "0 4px" }}>Apri finestra</strong> sulle schede
          sopra (consigliato) oppure <strong style={{ margin: "0 4px" }}>Anteprima qui</strong> per una sola vista
          incorporata.
        </div>
      )}

      <p style={{ margin: 0, fontSize: 11, color: "#94a3b8" }}>
        Non è screen-share del PC del cliente: vedi le stesse pagine con i dati del tenant e la presence (path) dello
        staff online.{" "}
        <Link to="/superadmin/test-layout" style={{ color: "#64748b" }}>
          Test viewport singolo
        </Link>
      </p>
    </div>
  )
}
