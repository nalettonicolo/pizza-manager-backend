import { useMemo, useState, useCallback, useEffect, useRef } from "react"
import { Link } from "react-router-dom"
import { useSuperadminChecklistDbProgress } from "@/features/superadmin/hooks/useSuperadminChecklistDbProgress"
import {
  CHECKLIST_MODIFICHE_MESE,
  CHECKLIST_EPIC_LABELS,
  CHECKLIST_BATCH_TEST_PRIORITA,
  groupChecklistByEpicAndArea,
} from "@/features/superadmin/data/checklistModificheMese"

const URGENZA_STYLE = {
  alta: { bg: "#fef2f2", fg: "#991b1b", label: "Da verificare subito" },
  media: { bg: "#fff7ed", fg: "#9a3412", label: "Importante" },
  bassa: { bg: "#f8fafc", fg: "#64748b", label: "Può attendere" },
}

/**
 * Checklist mensile: epic → area → voci (ogni voce ha flag e nota propri).
 */
export default function SuperadminChecklistMesePage() {
  const { data: progress, setData: setProgress, ready, migratedCount } = useSuperadminChecklistDbProgress()
  const [q, setQ] = useState("")
  const [soloAperti, setSoloAperti] = useState(false)
  const [soloUrgenti, setSoloUrgenti] = useState(false)
  const [soloDaFare, setSoloDaFare] = useState(false)
  const [openCodice, setOpenCodice] = useState(null)
  const [completateOpen, setCompletateOpen] = useState(false)
  const migrateInfo =
    migratedCount > 0
      ? `Importati ${migratedCount} progressi/note salvati in questo browser nel database condiviso (ora visibili anche dagli altri ambienti).`
      : null
  const noteTimers = useRef({})

  const isDone = useCallback((codice) => Boolean(progress?.[codice]?.done), [progress])

  const toggle = useCallback(
    (codice) => {
      setProgress((prev) => {
        const cur = prev?.[codice] || {}
        return {
          ...(prev || {}),
          [codice]: {
            ...cur,
            done: !cur.done,
            updatedAt: new Date().toISOString(),
          },
        }
      })
    },
    [setProgress],
  )

  const setNoteImmediate = useCallback(
    (codice, note) => {
      setProgress((prev) => ({
        ...(prev || {}),
        [codice]: {
          ...(prev?.[codice] || {}),
          note: String(note || ""),
          updatedAt: new Date().toISOString(),
        },
      }))
    },
    [setProgress],
  )

  /** Debounce note: evita di perdere battute se si naviga via durante digitazione rapida. */
  const setNote = useCallback(
    (codice, note) => {
      if (noteTimers.current[codice]) clearTimeout(noteTimers.current[codice])
      noteTimers.current[codice] = setTimeout(() => {
        setNoteImmediate(codice, note)
        delete noteTimers.current[codice]
      }, 280)
    },
    [setNoteImmediate],
  )

  const flushNote = useCallback(
    (codice, note) => {
      if (noteTimers.current[codice]) {
        clearTimeout(noteTimers.current[codice])
        delete noteTimers.current[codice]
      }
      setNoteImmediate(codice, note)
    },
    [setNoteImmediate],
  )

  useEffect(
    () => () => {
      for (const t of Object.values(noteTimers.current)) clearTimeout(t)
    },
    [],
  )

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase()
    return CHECKLIST_MODIFICHE_MESE.filter((item) => {
      if (soloUrgenti && item.urgenza !== "alta") return false
      if (soloDaFare && item.prontoDaProvare) return false
      if (!n) return true
      const blob = [
        item.codice,
        item.titolo,
        item.contesto,
        item.richiesta,
        item.noteTraccia || "",
        item.area,
        ...(item.comeVerificare || []),
      ]
        .join(" ")
        .toLowerCase()
      return blob.includes(n)
    })
  }, [q, soloUrgenti, soloDaFare])

  const activeItems = useMemo(
    () => filtered.filter((item) => !isDone(item.codice)),
    [filtered, isDone],
  )

  const completedItems = useMemo(
    () => filtered.filter((item) => isDone(item.codice)),
    [filtered, isDone],
  )

  /** Elenco principale: solo voci ancora da verificare. */
  const groups = useMemo(() => groupChecklistByEpicAndArea(activeItems), [activeItems])

  const completedGroups = useMemo(
    () => groupChecklistByEpicAndArea(completedItems),
    [completedItems],
  )

  const markTargets = useMemo(() => {
    if (soloAperti || !completateOpen) return activeItems
    return filtered
  }, [soloAperti, completateOpen, activeItems, filtered])

  const stats = useMemo(() => {
    const total = CHECKLIST_MODIFICHE_MESE.length
    const done = CHECKLIST_MODIFICHE_MESE.filter((i) => isDone(i.codice)).length
    const urgentiAperti = CHECKLIST_MODIFICHE_MESE.filter((i) => i.urgenza === "alta" && !isDone(i.codice)).length
    const daSviluppare = CHECKLIST_MODIFICHE_MESE.filter((i) => !i.prontoDaProvare && !isDone(i.codice)).length
    return {
      total,
      done,
      pct: total ? Math.round((done / total) * 100) : 0,
      urgentiAperti,
      daSviluppare,
    }
  }, [isDone])

  const markAllVisible = (done) => {
    setProgress((prev) => {
      const next = { ...(prev || {}) }
      for (const item of markTargets) {
        next[item.codice] = {
          ...(next[item.codice] || {}),
          done,
          updatedAt: new Date().toISOString(),
        }
      }
      return next
    })
  }

  const exportJson = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      periodo: "luglio–agosto 2026",
      note: "Per far lavorare l’assistente, cita il codice (es. DM-02).",
      voci: CHECKLIST_MODIFICHE_MESE.map((i) => ({
        codice: i.codice,
        area: i.area,
        titolo: i.titolo,
        completato: isDone(i.codice),
        nota: progress?.[i.codice]?.note || "",
        prontoDaProvare: i.prontoDaProvare,
        urgenza: i.urgenza,
      })),
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `checklist-mese-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const copyCodice = async (codice) => {
    try {
      await navigator.clipboard.writeText(codice)
    } catch {
      /* ignore */
    }
  }

  if (!ready) {
    return (
      <div className="sa-page">
        <p style={{ color: "#64748b" }}>Caricamento checklist…</p>
      </div>
    )
  }

  return (
    <div className="sa-page" style={{ maxWidth: 960 }}>
      <h1 className="dashboard-page-title sa-page-title">Chek-Sviluppi</h1>
      <p style={{ margin: "0 0 10px", fontSize: 15, color: "#334155", lineHeight: 1.55 }}>
        Checklist modifiche da verificare: raggruppate per <strong>capitolo</strong> e <strong>area</strong>. Le voci
        già collaudate (Prova ok) restano in <strong>Completate</strong>, chiuse finché non le apri. Ogni riga ha il
        suo flag e la sua nota.
      </p>
      <p
        style={{
          margin: "0 0 16px",
          padding: "12px 14px",
          borderRadius: 10,
          background: "#eff6ff",
          border: "1px solid #bfdbfe",
          fontSize: 14,
          color: "#1e3a8a",
          lineHeight: 1.5,
        }}
      >
        Cita il <strong>codice</strong> in chat (es. <code>CL-05</code>) per adattare quel pezzo. Flag e note sono
        salvati nel database (condivisi tra ambienti: locale e produzione vedono lo stesso stato).
      </p>
      <a
        href="https://claude.ai/code/artifact/9973cbc8-0356-4a2a-a188-5483cbc17a25"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          margin: "0 0 16px",
          padding: "12px 14px",
          borderRadius: 10,
          background: "#fdf4ec",
          border: "1px solid #f3d5b5",
          fontSize: 14,
          color: "#7c3a0e",
          lineHeight: 1.5,
          textDecoration: "none",
        }}
      >
        <span style={{ fontSize: 20 }} aria-hidden>
          🚀
        </span>
        <span>
          <strong>Checklist go-live</strong> — questa (Chek-Sviluppi) traccia i bug; quella è la checklist di test
          manuale da percorrere prima di aprire ai clienti veri (pagamenti, ordine dal sito, cassa dal vivo,
          reparti, ruoli...). Apre in una scheda a parte.
        </span>
      </a>
      <p
        style={{
          margin: "0 0 16px",
          padding: "12px 14px",
          borderRadius: 10,
          background: "#fff7ed",
          border: "1px solid #fdba74",
          fontSize: 14,
          color: "#9a3412",
          lineHeight: 1.5,
        }}
      >
        <strong>Test 7 agosto — priorità:</strong>{" "}
        {CHECKLIST_BATCH_TEST_PRIORITA.map((c, i) => (
          <span key={c}>
            {i > 0 ? " · " : null}
            <code
              style={{ cursor: "pointer", textDecoration: openCodice === c ? "underline" : "none" }}
              onClick={() => {
                setQ(c)
                setOpenCodice(c)
                setSoloUrgenti(false)
                setSoloAperti(true)
              }}
              title={`Filtra ${c}`}
            >
              {c}
            </code>
          </span>
        ))}
        <span style={{ display: "block", marginTop: 6, fontSize: 13 }}>
          Pay-by-link, prezzi modifica pizza, cucina aggregata, tablet opzionale, Bancone senza crash.
        </span>
      </p>
      {migrateInfo ? (
        <p
          style={{
            margin: "0 0 16px",
            padding: "10px 12px",
            borderRadius: 8,
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            fontSize: 13,
            color: "#166534",
          }}
        >
          {migrateInfo}
        </p>
      ) : null}
      <p style={{ margin: "0 0 16px", fontSize: 13 }}>
        <Link to="/superadmin/ingresso" style={linkStyle}>
          ← Pagina dopo il login
        </Link>
        {" · "}
        <Link to="/superadmin/dashboard" style={linkStyle}>
          Amministrazione
        </Link>
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 10,
          marginBottom: 12,
        }}
      >
        <StatCard label="Avanzamento" value={`${stats.pct}%`} sub={`${stats.done} di ${stats.total}`} />
        <StatCard
          label="Urgenti da provare"
          value={String(stats.urgentiAperti)}
          sub="priorità alta ancora aperte"
          danger={stats.urgentiAperti > 0}
        />
        <StatCard
          label="Ancora da sviluppare"
          value={String(stats.daSviluppare)}
          sub="non ancora pronti da smoke"
          danger={stats.daSviluppare > 0}
        />
      </div>

      <div
        style={{
          height: 10,
          borderRadius: 999,
          background: "#e2e8f0",
          overflow: "hidden",
          marginBottom: 16,
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${stats.pct}%`,
            background: stats.pct === 100 ? "#16a34a" : "#c0392b",
          }}
        />
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16, alignItems: "center" }}>
        <input
          type="search"
          placeholder="Cerca codice o parole (es. CL-05, profilo, planning)…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{
            flex: "1 1 240px",
            minWidth: 200,
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid #cbd5e1",
            fontSize: 14,
          }}
        />
        <label style={chipLabel}>
          <input type="checkbox" checked={soloAperti} onChange={(e) => setSoloAperti(e.target.checked)} />
          Solo da verificare
        </label>
        <label style={chipLabel}>
          <input type="checkbox" checked={soloUrgenti} onChange={(e) => setSoloUrgenti(e.target.checked)} />
          Solo urgenti
        </label>
        <label style={chipLabel}>
          <input type="checkbox" checked={soloDaFare} onChange={(e) => setSoloDaFare(e.target.checked)} />
          Solo da sviluppare
        </label>
        <button type="button" style={btnOutline} onClick={() => markAllVisible(true)}>
          Segna visibili ok
        </button>
        <button type="button" style={btnOutline} onClick={() => markAllVisible(false)}>
          Reset visibili
        </button>
        <button type="button" style={btnPrimary} onClick={exportJson}>
          Esporta
        </button>
      </div>

      <p style={{ fontSize: 12, color: "#94a3b8", marginBottom: 14 }}>
        Capitoli: {CHECKLIST_EPIC_LABELS.map((e) => e.titolo).join(" · ")}. Da verificare: {activeItems.length}
        {completedItems.length > 0 ? ` · Completate: ${completedItems.length}` : ""}.
      </p>

      {groups.map(({ epic, areas }) => {
        const epicItems = areas.flatMap((a) => a.items)
        return (
          <section key={epic.id} style={{ marginBottom: 28 }}>
            <h2
              style={{
                margin: "0 0 12px",
                fontSize: 18,
                fontWeight: 800,
                color: "#0f172a",
                borderBottom: "2px solid #e2e8f0",
                paddingBottom: 8,
              }}
            >
              {epic.titolo}
              <span style={{ marginLeft: 8, fontWeight: 600, color: "#64748b", fontSize: 13 }}>
                {epicItems.length} da verificare
              </span>
            </h2>

            {areas.map(({ area, items }) => {
              if (!items.length) return null
              return (
                <div
                  key={area.id}
                  style={{
                    marginBottom: 16,
                    padding: "12px 14px 14px",
                    borderRadius: 12,
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                  }}
                >
                  <h3
                    style={{
                      margin: "0 0 12px",
                      fontSize: 14,
                      fontWeight: 800,
                      color: "#334155",
                      letterSpacing: "0.01em",
                    }}
                  >
                    {area.titolo}
                    <span style={{ marginLeft: 8, fontWeight: 600, color: "#94a3b8", fontSize: 12 }}>
                      {items.length}
                    </span>
                  </h3>
                  <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                    {items.map((item) => {
                      const done = isDone(item.codice)
                      const open = openCodice === item.codice
                      const u = URGENZA_STYLE[item.urgenza] || URGENZA_STYLE.media
                      const note = progress?.[item.codice]?.note || ""
                      return (
                        <ChecklistItemCard
                          key={item.codice}
                          item={item}
                          done={done}
                          open={open}
                          urgenza={u}
                          note={note}
                          onToggle={() => toggle(item.codice)}
                          onToggleOpen={() => setOpenCodice(open ? null : item.codice)}
                          onNoteChange={(v) => setNote(item.codice, v)}
                          onNoteBlur={(v) => flushNote(item.codice, v)}
                          onCopyCodice={() => void copyCodice(item.codice)}
                        />
                      )
                    })}
                  </ul>
                </div>
              )
            })}
          </section>
        )
      })}

      {activeItems.length === 0 && (soloAperti || completedItems.length === 0) ? (
        <p style={{ color: "#64748b", fontSize: 14 }}>
          {filtered.length === 0 ? "Nessuna voce con questi filtri." : "Tutte le voci filtrate sono in Completate."}
        </p>
      ) : null}

      {!soloAperti && completedItems.length > 0 ? (
        <section style={{ marginTop: 8, marginBottom: 24 }}>
          <button
            type="button"
            onClick={() => setCompletateOpen((v) => !v)}
            aria-expanded={completateOpen}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              padding: "14px 16px",
              borderRadius: 12,
              border: "1px solid #bbf7d0",
              background: completateOpen ? "#ecfdf5" : "#f0fdf4",
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <span style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: "#166534" }}>Completate</span>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#166534",
                  background: "#bbf7d0",
                  borderRadius: 999,
                  padding: "2px 10px",
                }}
              >
                {completedItems.length}
              </span>
              <span style={{ fontSize: 13, color: "#15803d", fontWeight: 500 }}>
                {completateOpen ? "Clicca per nascondere" : "Clicca per mostrare le voci già collaudate"}
              </span>
            </span>
            <span style={{ fontSize: 18, color: "#166534", lineHeight: 1 }} aria-hidden>
              {completateOpen ? "▾" : "▸"}
            </span>
          </button>

          {completateOpen ? (
            <div style={{ marginTop: 14 }}>
              {completedGroups.map(({ epic, areas }) => {
                const epicItems = areas.flatMap((a) => a.items)
                return (
                  <section key={`done-${epic.id}`} style={{ marginBottom: 20 }}>
                    <h2
                      style={{
                        margin: "0 0 10px",
                        fontSize: 16,
                        fontWeight: 800,
                        color: "#14532d",
                        borderBottom: "1px solid #dcfce7",
                        paddingBottom: 6,
                      }}
                    >
                      {epic.titolo}
                      <span style={{ marginLeft: 8, fontWeight: 600, color: "#86efac", fontSize: 12 }}>
                        {epicItems.length}
                      </span>
                    </h2>
                    {areas.map(({ area, items }) => {
                      if (!items.length) return null
                      return (
                        <div
                          key={`done-${area.id}`}
                          style={{
                            marginBottom: 12,
                            padding: "12px 14px 14px",
                            borderRadius: 12,
                            background: "#f0fdf4",
                            border: "1px solid #bbf7d0",
                          }}
                        >
                          <h3
                            style={{
                              margin: "0 0 10px",
                              fontSize: 13,
                              fontWeight: 800,
                              color: "#166534",
                            }}
                          >
                            {area.titolo}
                          </h3>
                          <ul
                            style={{
                              listStyle: "none",
                              margin: 0,
                              padding: 0,
                              display: "flex",
                              flexDirection: "column",
                              gap: 10,
                            }}
                          >
                            {items.map((item) => {
                              const open = openCodice === item.codice
                              const u = URGENZA_STYLE[item.urgenza] || URGENZA_STYLE.media
                              const note = progress?.[item.codice]?.note || ""
                              return (
                                <ChecklistItemCard
                                  key={item.codice}
                                  item={item}
                                  done
                                  open={open}
                                  urgenza={u}
                                  note={note}
                                  onToggle={() => toggle(item.codice)}
                                  onToggleOpen={() => setOpenCodice(open ? null : item.codice)}
                                  onNoteChange={(v) => setNote(item.codice, v)}
                                  onNoteBlur={(v) => flushNote(item.codice, v)}
                                  onCopyCodice={() => void copyCodice(item.codice)}
                                />
                              )
                            })}
                          </ul>
                        </div>
                      )
                    })}
                  </section>
                )
              })}
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}

function ChecklistItemCard({
  item,
  done,
  open,
  urgenza: u,
  note,
  onToggle,
  onToggleOpen,
  onNoteChange,
  onNoteBlur,
  onCopyCodice,
}) {
  const [localNote, setLocalNote] = useState(note)
  useEffect(() => {
    setLocalNote(note)
  }, [note, item.codice])

  return (
    <li
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: 12,
        background: done ? "#f0fdf4" : "#fff",
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", gap: 12, padding: "14px 16px", alignItems: "flex-start" }}>
        <label
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          <input
            type="checkbox"
            checked={done}
            onChange={onToggle}
            style={{ width: 20, height: 20 }}
            aria-label={`Va bene: ${item.codice}`}
          />
          <span style={{ fontSize: 10, fontWeight: 700, color: done ? "#16a34a" : "#94a3b8" }}>
            {done ? "Ok" : "Prova"}
          </span>
        </label>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 6 }}>
            <button
              type="button"
              onClick={onCopyCodice}
              title="Copia codice per citarlo in chat"
              style={{
                fontFamily: "ui-monospace, monospace",
                fontSize: 13,
                fontWeight: 800,
                padding: "4px 10px",
                borderRadius: 8,
                border: "1px solid #cbd5e1",
                background: "#0f172a",
                color: "#fff",
                cursor: "pointer",
              }}
            >
              {item.codice}
            </button>
            <strong style={{ fontSize: 15, color: "#0f172a" }}>{item.titolo}</strong>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: 999,
                background: u.bg,
                color: u.fg,
              }}
            >
              {u.label}
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: 999,
                background: item.prontoDaProvare ? "#ecfdf5" : "#fef3c7",
                color: item.prontoDaProvare ? "#166534" : "#92400e",
              }}
            >
              {item.prontoDaProvare ? "Pronto da provare" : "Ancora da sviluppare"}
            </span>
          </div>
          <p style={{ margin: "0 0 8px", fontSize: 14, color: "#475569", lineHeight: 1.5 }}>
            <strong style={{ color: "#334155" }}>Contesto.</strong> {item.contesto}
          </p>
          <p style={{ margin: 0, fontSize: 14, color: "#0f172a", lineHeight: 1.5 }}>
            <strong>Cosa deve succedere.</strong> {item.richiesta}
          </p>
          {item.noteTraccia ? (
            <div
              style={{
                marginTop: 10,
                padding: "10px 12px",
                borderRadius: 8,
                background: "#fff7ed",
                border: "1px solid #fdba74",
                fontSize: 13,
                color: "#9a3412",
                lineHeight: 1.5,
                whiteSpace: "pre-wrap",
              }}
            >
              <strong style={{ display: "block", marginBottom: 4 }}>Traccia / feedback</strong>
              {item.noteTraccia}
            </div>
          ) : null}
          <label style={{ display: "block", marginTop: 10, fontSize: 12, fontWeight: 600, color: "#64748b" }}>
            Nota (salvata subito)
            <textarea
              value={localNote}
              onChange={(e) => {
                const v = e.target.value
                setLocalNote(v)
                onNoteChange(v)
              }}
              onBlur={(e) => onNoteBlur(e.target.value)}
              rows={2}
              placeholder="Es. provato in demo, ok — oppure manca X…"
              style={{
                display: "block",
                width: "100%",
                marginTop: 6,
                padding: 10,
                borderRadius: 8,
                border: "1px solid #cbd5e1",
                fontSize: 14,
                boxSizing: "border-box",
                background: "#fff",
              }}
            />
          </label>
          <button
            type="button"
            style={{
              marginTop: 10,
              border: "none",
              background: "transparent",
              color: "#c0392b",
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
              padding: 0,
            }}
            onClick={onToggleOpen}
          >
            {open ? "Nascondi come verificare ▲" : "Come verificare se va bene ▼"}
          </button>
        </div>
      </div>
      {open ? (
        <div style={{ padding: "0 16px 16px 52px", borderTop: "1px dashed #e2e8f0", paddingTop: 12 }}>
          <ol style={{ margin: 0, paddingLeft: 18, fontSize: 14, lineHeight: 1.55, color: "#334155" }}>
            {(item.comeVerificare || []).map((step) => (
              <li key={step} style={{ marginBottom: 6 }}>
                {step}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </li>
  )
}

function StatCard({ label, value, sub, danger }) {
  return (
    <div
      style={{
        padding: "12px 14px",
        borderRadius: 10,
        border: `1px solid ${danger ? "#fecaca" : "#e2e8f0"}`,
        background: danger ? "#fef2f2" : "#f8fafc",
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: danger ? "#991b1b" : "#0f172a", marginTop: 2 }}>{value}</div>
      {sub ? <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{sub}</div> : null}
    </div>
  )
}

const linkStyle = { color: "#c0392b", fontWeight: 600, textDecoration: "none" }
const chipLabel = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  fontSize: 13,
  color: "#334155",
  padding: "6px 10px",
  borderRadius: 8,
  border: "1px solid #e2e8f0",
  background: "#fff",
  cursor: "pointer",
}
const btnOutline = {
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  background: "#fff",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
}
const btnPrimary = {
  ...btnOutline,
  background: "#c0392b",
  borderColor: "#c0392b",
  color: "#fff",
}
