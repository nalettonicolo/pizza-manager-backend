import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import {
  AGENTI_CATALOGO,
  getAgenteById,
  getAreePerAgente,
  listAreeEnriched,
} from "@/features/superadmin/data/agentiModuliSviluppo"

function copyText(text) {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text)
  }
  return Promise.reject(new Error("clipboard non disponibile"))
}

const STATO_LABEL = {
  aperto: "Aperto",
  parziale: "Parziale",
  blocco_esterno: "Blocco esterno",
  in_corso: "In corso",
}

const STATO_COLOR = {
  aperto: { bg: "#fef3c7", fg: "#92400e" },
  parziale: { bg: "#e0e7ff", fg: "#3730a3" },
  blocco_esterno: { bg: "#fee2e2", fg: "#991b1b" },
  in_corso: { bg: "#dcfce7", fg: "#166534" },
}

export default function SuperadminAgentiModuliPage() {
  const [vista, setVista] = useState("aree") // aree | agenti
  const [openId, setOpenId] = useState(null)
  const [agenteFiltro, setAgenteFiltro] = useState(null)
  const [copiedId, setCopiedId] = useState(null)
  const [q, setQ] = useState("")

  const aree = useMemo(() => listAreeEnriched(), [])

  const filteredAree = useMemo(() => {
    let list = aree
    if (agenteFiltro) {
      list = list.filter((a) => a.agenti.some((x) => x.agenteId === agenteFiltro))
    }
    const n = q.trim().toLowerCase()
    if (!n) return list
    return list.filter((a) => {
      const blob = [
        a.titolo,
        a.sintesi,
        a.priorita,
        a.stato,
        a.fattoOggi,
        ...(a.manca || []),
        ...(a.agenti || []).map((x) => x.agenteId),
      ]
        .join(" ")
        .toLowerCase()
      return blob.includes(n)
    })
  }, [aree, q, agenteFiltro])

  return (
    <div className="sa-page" style={{ maxWidth: 980 }}>
      <h1 className="dashboard-page-title sa-page-title">Moduli agenti — aree di sviluppo aperte</h1>
      <p style={{ margin: "0 0 8px", fontSize: 14, color: "#64748b", lineHeight: 1.55 }}>
        Ogni <strong>area mancante</strong> elenca gli agenti coinvolti e cosa devono produrre. Se un pezzo
        tocca più profili, sono tutti nel punto. Priorità allineate a go-live Francy e roadmap servizi.
      </p>
      <p style={{ margin: "0 0 16px", fontSize: 13 }}>
        <Link to="/superadmin/sviluppo" style={linkStyle}>
          Roadmap servizi (%)
        </Link>
        {" · "}
        <Link to="/superadmin/guide/punto-situazione-priorita" style={linkStyle}>
          Priorità P0–P4
        </Link>
        {" · "}
        <Link to="/superadmin/guide/punto-situazione-prodotto" style={linkStyle}>
          Punto situazione Prodotto
        </Link>
        {" · "}
        <Link to="/superadmin/guide/go-live-francy-runbook" style={linkStyle}>
          Runbook Francy
        </Link>
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
        <button type="button" style={vista === "aree" ? tabOn : tabOff} onClick={() => setVista("aree")}>
          Per area mancante
        </button>
        <button
          type="button"
          style={vista === "agenti" ? tabOn : tabOff}
          onClick={() => setVista("agenti")}
        >
          Per agente
        </button>
      </div>

      {vista === "agenti" ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
          <button
            type="button"
            style={!agenteFiltro ? chipOn : chipOff}
            onClick={() => setAgenteFiltro(null)}
          >
            Tutti
          </button>
          {AGENTI_CATALOGO.map((a) => {
            const n = getAreePerAgente(a.id).length
            return (
              <button
                key={a.id}
                type="button"
                style={agenteFiltro === a.id ? chipOn : chipOff}
                onClick={() => {
                  setAgenteFiltro(a.id)
                  setVista("aree")
                }}
                title={a.agenteFile}
              >
                {a.titolo} ({n})
              </button>
            )
          })}
        </div>
      ) : null}

      {agenteFiltro ? (
        <p style={{ fontSize: 13, color: "#475569", marginBottom: 12 }}>
          Filtro agente: <strong>{getAgenteById(agenteFiltro)?.titolo}</strong>{" "}
          <button type="button" style={linkBtn} onClick={() => setAgenteFiltro(null)}>
            togli filtro
          </button>
        </p>
      ) : null}

      <label style={{ display: "block", marginBottom: 16, maxWidth: 440 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Cerca</span>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="es. Stripe, magazzino, kiosk, RBAC…"
          style={{
            display: "block",
            width: "100%",
            marginTop: 6,
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #cbd5e1",
            fontSize: 14,
          }}
        />
      </label>

      {vista === "agenti" && !agenteFiltro ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {AGENTI_CATALOGO.map((ag) => {
            const linked = getAreePerAgente(ag.id)
            return (
              <section key={ag.id} style={card}>
                <div style={{ padding: "14px 16px" }}>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{ag.titolo}</div>
                  <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>{ag.agenteFile}</div>
                  <p style={{ margin: "8px 0 0", fontSize: 13, color: "#64748b" }}>
                    Coinvolto in <strong>{linked.length}</strong> aree aperte.
                  </p>
                  <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 13, color: "#334155" }}>
                    {linked.map((ar) => (
                      <li key={ar.id} style={{ marginBottom: 4 }}>
                        <button
                          type="button"
                          style={linkBtn}
                          onClick={() => {
                            setAgenteFiltro(ag.id)
                            setOpenId(ar.id)
                            setVista("aree")
                          }}
                        >
                          [{ar.priorita}] {ar.titolo}
                        </button>
                      </li>
                    ))}
                  </ul>
                  <Link to={`/superadmin/guide/${ag.guidaSlug}`} style={{ ...linkStyle, fontSize: 13 }}>
                    Punto situazione →
                  </Link>
                </div>
              </section>
            )
          })}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filteredAree.map((area) => {
            const open = openId === area.id
            const st = STATO_COLOR[area.stato] || STATO_COLOR.aperto
            return (
              <section key={area.id} style={card}>
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : area.id)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "14px 16px",
                    border: "none",
                    background: open ? "#f8fafc" : "#fff",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                    <span style={badge(st.bg, st.fg)}>{STATO_LABEL[area.stato] || area.stato}</span>
                    <span style={badge("#0f172a", "#fff")}>{area.priorita}</span>
                    {area.percentuale != null ? (
                      <span style={badge("#e2e8f0", "#334155")}>
                        Roadmap {area.percentuale}%
                        {area.roadmapTitolo ? ` · ${area.roadmapTitolo}` : ""}
                      </span>
                    ) : null}
                  </div>
                  <div style={{ marginTop: 8, fontWeight: 700, fontSize: 16, color: "#0f172a" }}>
                    {area.titolo}
                  </div>
                  <div style={{ marginTop: 4, fontSize: 13, color: "#64748b", lineHeight: 1.45 }}>
                    {area.sintesi}
                  </div>
                  <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {area.agenti.map((x) => (
                      <span key={x.agenteId} style={badge("#f1f5f9", "#475569")}>
                        {getAgenteById(x.agenteId)?.titolo || x.agenteId}
                      </span>
                    ))}
                  </div>
                </button>

                {open ? (
                  <div style={{ padding: "0 16px 16px", borderTop: "1px solid #f1f5f9" }}>
                    <h3 style={h3}>Già fatto</h3>
                    <p style={pBody}>{area.fattoOggi}</p>

                    <h3 style={h3}>Manca</h3>
                    <ul style={ul}>
                      {area.manca.map((m) => (
                        <li key={m}>{m}</li>
                      ))}
                    </ul>

                    {area.bloccoEsterno ? (
                      <>
                        <h3 style={h3}>Blocco esterno</h3>
                        <p style={{ ...pBody, color: "#991b1b" }}>{area.bloccoEsterno}</p>
                      </>
                    ) : null}

                    <h3 style={h3}>DoD sala</h3>
                    <ul style={ul}>
                      {area.dodSala.map((d) => (
                        <li key={d}>{d}</li>
                      ))}
                    </ul>

                    {area.roadmapRestoPreview?.length ? (
                      <>
                        <h3 style={h3}>Gap roadmap servizio (anteprima)</h3>
                        <ul style={ul}>
                          {area.roadmapRestoPreview.map((line) => (
                            <li key={line}>{line}</li>
                          ))}
                        </ul>
                      </>
                    ) : null}

                    <h3 style={h3}>Agenti sul punto (richieste e deliverable)</h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {area.agenti.map((slot) => {
                        const ag = getAgenteById(slot.agenteId)
                        return (
                          <div
                            key={slot.agenteId}
                            style={{
                              border: "1px solid #e2e8f0",
                              borderRadius: 10,
                              padding: 12,
                              background: "#fafafa",
                            }}
                          >
                            <div style={{ fontWeight: 700, fontSize: 14 }}>
                              {ag?.titolo || slot.agenteId}
                              <span style={{ fontWeight: 500, color: "#64748b", fontSize: 12 }}>
                                {" "}
                                · {ag?.agenteFile}
                              </span>
                            </div>
                            <div style={{ fontSize: 13, color: "#334155", marginTop: 4 }}>{slot.ruolo}</div>
                            <div style={{ marginTop: 8, fontSize: 12, fontWeight: 700, color: "#64748b" }}>
                              RICHIESTE
                            </div>
                            <ul style={{ ...ul, fontSize: 12 }}>
                              {slot.richieste.map((r) => (
                                <li key={r}>{r}</li>
                              ))}
                            </ul>
                            <div style={{ marginTop: 6, fontSize: 12, fontWeight: 700, color: "#64748b" }}>
                              DELIVERABLE
                            </div>
                            <ul style={{ ...ul, fontSize: 12 }}>
                              {slot.deliverable.map((d) => (
                                <li key={d}>{d}</li>
                              ))}
                            </ul>
                          </div>
                        )
                      })}
                    </div>

                    <h3 style={h3}>Prompt Cursor (multi-agente)</h3>
                    <pre style={pre}>{area.promptCursor}</pre>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      <button
                        type="button"
                        style={btnPrimary}
                        onClick={async () => {
                          try {
                            await copyText(area.promptCursor)
                            setCopiedId(area.id)
                            window.setTimeout(() => setCopiedId(null), 2000)
                          } catch {
                            window.alert("Copia non riuscita.")
                          }
                        }}
                      >
                        {copiedId === area.id ? "Copiato" : "Copia prompt"}
                      </button>
                      {area.guidaSlug ? (
                        <Link to={`/superadmin/guide/${area.guidaSlug}`} style={btnSecondary}>
                          Guida collegata
                        </Link>
                      ) : null}
                      <Link to="/superadmin/sviluppo" style={btnSecondary}>
                        % Roadmap servizi
                      </Link>
                    </div>
                    {area.runbook ? (
                      <p style={{ margin: "10px 0 0", fontSize: 12, color: "#64748b" }}>
                        Runbook repo: <code style={codeStyle}>{area.runbook}</code>
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </section>
            )
          })}
          {!filteredAree.length ? (
            <p style={{ fontSize: 14, color: "#64748b" }}>Nessuna area corrisponde al filtro.</p>
          ) : null}
        </div>
      )}
    </div>
  )
}

function badge(bg, fg) {
  return {
    fontSize: 11,
    fontWeight: 700,
    padding: "3px 8px",
    borderRadius: 999,
    background: bg,
    color: fg,
  }
}

const card = {
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  background: "#fff",
  overflow: "hidden",
}

const linkStyle = { color: "#1565c0", fontWeight: 600, fontSize: 13 }
const linkBtn = {
  background: "none",
  border: "none",
  color: "#1565c0",
  fontWeight: 600,
  cursor: "pointer",
  padding: 0,
  fontSize: 13,
  textAlign: "left",
}

const h3 = {
  margin: "14px 0 6px",
  fontSize: 12,
  fontWeight: 700,
  color: "#0f172a",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
}

const pBody = { margin: 0, fontSize: 13, color: "#334155", lineHeight: 1.5 }
const ul = { margin: "0 0 0", paddingLeft: 18, fontSize: 13, color: "#334155", lineHeight: 1.5 }

const pre = {
  margin: "0 0 10px",
  padding: 12,
  background: "#0f172a",
  color: "#e2e8f0",
  borderRadius: 8,
  fontSize: 12,
  lineHeight: 1.45,
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
}

const codeStyle = {
  fontSize: 11,
  background: "#f1f5f9",
  padding: "1px 6px",
  borderRadius: 4,
}

const btnPrimary = {
  padding: "8px 14px",
  borderRadius: 8,
  border: "none",
  background: "#1565c0",
  color: "#fff",
  fontWeight: 600,
  fontSize: 13,
  cursor: "pointer",
}

const btnSecondary = {
  padding: "8px 14px",
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#334155",
  fontWeight: 600,
  fontSize: 13,
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
}

const tabOn = { ...btnPrimary, borderRadius: 999 }
const tabOff = { ...btnSecondary, borderRadius: 999, cursor: "pointer" }
const chipOn = { ...tabOn, padding: "6px 12px", fontSize: 12 }
const chipOff = { ...tabOff, padding: "6px 12px", fontSize: 12 }
