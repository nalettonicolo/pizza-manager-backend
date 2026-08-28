import { useMemo, useState } from "react"
import {
  DNS_GENERIC_GUIDELINES,
  DNS_HOST_GUIDES,
  DOMINIO_GO_LIVE_CHECKLIST,
  EXTERNAL_SITE_CTA_GUIDELINES,
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
 * Guide DNS per host + checklist go-live / CTA sito esterno.
 * Usata in Go-live e nella modale guida deploy.
 *
 * Ordine deliberato (prima confusionario: 3 liste diverse — bullets generici, "checklist rapida"
 * e una terza checklist quasi identica legata a un tenant di esempio — coprivano quasi lo stesso
 * terreno senza un ordine chiaro): prima la procedura da seguire passo passo, poi la guida per il
 * provider DNS del cliente (richiamata dal passo 5), poi i concetti generali come riferimento, poi
 * il caso particolare del sito marketing esterno.
 */
export default function DnsHostGuidesPanel({ compact = false }) {
  const [hostId, setHostId] = useState("register")
  const guide = useMemo(() => getDnsHostGuide(hostId), [hostId])

  return (
    <div>
      <p style={{ ...muted, marginBottom: 18 }}>
        Per portare un tenant sul proprio dominio: segui i passi qui sotto in ordine, usando la guida del provider DNS
        al passo 5. Più giù trovi anche i concetti generali come riferimento.
      </p>

      <h3 style={sectionTitle}>{DOMINIO_GO_LIVE_CHECKLIST.title}</h3>
      <p style={muted}>{DOMINIO_GO_LIVE_CHECKLIST.intro}</p>
      <ol style={listStyle}>
        {DOMINIO_GO_LIVE_CHECKLIST.steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>

      <h3 style={{ ...sectionTitle, marginTop: 20 }}>Guida per provider DNS (passo 5)</h3>
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
          border: "1px solid #fecaca",
          background: "#fef2f2",
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "baseline", marginBottom: 8 }}>
          <h4 style={{ margin: 0, fontSize: 16, color: "#962d22" }}>{guide.label}</h4>
          {guide.panelUrl ? (
            <a href={guide.panelUrl} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: "#c0392b" }}>
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
            <p style={{ margin: "0 0 4px", fontSize: 12, fontWeight: 700, color: "#962d22" }}>Esempio record</p>
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

      <p style={{ ...muted, marginTop: 20, marginBottom: 4 }}>
        Target CNAME di riferimento piattaforma: <code>{PUBLIC_DOMAIN_CNAME_TARGET}</code> — se Firebase mostra un
        valore diverso, usa quello di Firebase.
      </p>

      <h3 style={{ ...sectionTitle, marginTop: 18 }}>{DNS_GENERIC_GUIDELINES.title}</h3>
      <p style={muted}>{DNS_GENERIC_GUIDELINES.intro}</p>
      {!compact ? (
        <ul style={listStyle}>
          {DNS_GENERIC_GUIDELINES.bullets.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      ) : null}

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
