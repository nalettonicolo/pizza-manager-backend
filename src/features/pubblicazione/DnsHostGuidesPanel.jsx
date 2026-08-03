import { useMemo, useState } from "react"
import {
  DNS_GENERIC_GUIDELINES,
  DNS_HOST_GUIDES,
  EXTERNAL_SITE_CTA_GUIDELINES,
  FRANCY_GO_LIVE_GUIDELINES,
  getDnsHostGuide,
} from "@/content/dnsHostGuides"
import { PUBLIC_DOMAIN_CNAME_TARGET } from "@/config/publicDomain"

const sectionTitle = {
  margin: "0 0 8px",
  fontSize: 15,
  fontWeight: 700,
  color: "#0f172a",
}

const muted = { margin: "0 0 12px", fontSize: 13, lineHeight: 1.6, color: "#64748b" }

const listStyle = { margin: "0 0 14px", paddingLeft: 20, fontSize: 14, lineHeight: 1.7, color: "#334155" }

const codeBlock = {
  display: "block",
  margin: "8px 0 14px",
  padding: "12px 14px",
  background: "#0f172a",
  color: "#e2e8f0",
  borderRadius: 8,
  fontSize: 12,
  fontFamily: "ui-monospace, monospace",
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
}

const tabBtn = (active) => ({
  padding: "8px 12px",
  borderRadius: 8,
  border: active ? "1px solid #fb923c" : "1px solid #e2e8f0",
  background: active ? "#fff7ed" : "#fff",
  color: active ? "#9a3412" : "#334155",
  fontWeight: active ? 700 : 600,
  fontSize: 13,
  cursor: "pointer",
})

/**
 * Guide DNS per host + linee guida generiche / Francy / CTA sito esterno.
 * Usata in Go-live e nella modale guida deploy.
 */
export default function DnsHostGuidesPanel({ compact = false }) {
  const [hostId, setHostId] = useState("register")
  const guide = useMemo(() => getDnsHostGuide(hostId), [hostId])

  return (
    <div>
      <h3 style={sectionTitle}>{DNS_GENERIC_GUIDELINES.title}</h3>
      <p style={muted}>{DNS_GENERIC_GUIDELINES.intro}</p>
      <ul style={listStyle}>
        {DNS_GENERIC_GUIDELINES.bullets.map((b) => (
          <li key={b}>{b}</li>
        ))}
      </ul>

      <p style={{ ...muted, marginBottom: 8 }}>
        Target CNAME di riferimento piattaforma: <code>{PUBLIC_DOMAIN_CNAME_TARGET}</code> — se Firebase mostra un
        valore diverso, usa quello di Firebase.
      </p>

      {!compact ? (
        <>
          <h3 style={{ ...sectionTitle, marginTop: 18 }}>Checklist rapida</h3>
          <ol style={listStyle}>
            {DNS_GENERIC_GUIDELINES.checklist.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ol>
        </>
      ) : null}

      <h3 style={{ ...sectionTitle, marginTop: 20 }}>Guida per provider DNS</h3>
      <p style={muted}>Scegli il registrar del cliente e segui i passi. Una guida dedicata per ciascun host.</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
        {DNS_HOST_GUIDES.map((h) => (
          <button key={h.id} type="button" style={tabBtn(hostId === h.id)} onClick={() => setHostId(h.id)}>
            {h.label}
          </button>
        ))}
      </div>

      <div
        style={{
          padding: 16,
          borderRadius: 12,
          border: "1px solid #fed7aa",
          background: "#fffbeb",
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "baseline", marginBottom: 8 }}>
          <h4 style={{ margin: 0, fontSize: 16, color: "#9a3412" }}>{guide.label}</h4>
          {guide.panelUrl ? (
            <a href={guide.panelUrl} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: "#c2410c" }}>
              Apri pannello →
            </a>
          ) : null}
        </div>
        <ol style={{ ...listStyle, marginBottom: 10 }}>
          {guide.steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
        {guide.recordsExample ? (
          <>
            <p style={{ margin: "0 0 4px", fontSize: 12, fontWeight: 700, color: "#9a3412" }}>Esempio record</p>
            <code style={codeBlock}>{guide.recordsExample}</code>
          </>
        ) : null}
        {guide.notes?.length ? (
          <ul style={{ ...listStyle, marginBottom: 0, color: "#78716c" }}>
            {guide.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        ) : null}
      </div>

      <h3 style={{ ...sectionTitle, marginTop: 22 }}>{FRANCY_GO_LIVE_GUIDELINES.title}</h3>
      <p style={muted}>{FRANCY_GO_LIVE_GUIDELINES.intro}</p>
      <ol style={listStyle}>
        {FRANCY_GO_LIVE_GUIDELINES.steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>

      <h3 style={{ ...sectionTitle, marginTop: 18 }}>{EXTERNAL_SITE_CTA_GUIDELINES.title}</h3>
      <p style={muted}>{EXTERNAL_SITE_CTA_GUIDELINES.intro}</p>
      <ul style={listStyle}>
        {EXTERNAL_SITE_CTA_GUIDELINES.bullets.map((b) => (
          <li key={b}>{b}</li>
        ))}
      </ul>
    </div>
  )
}
