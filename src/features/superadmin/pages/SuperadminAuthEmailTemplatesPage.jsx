import { useMemo, useState } from "react"
import { AUTH_EMAIL_TEMPLATES } from "@/features/superadmin/config/authEmailTemplates"

const PREVIEW_SAMPLE = {
  "{{ .ConfirmationURL }}": "https://francypizza.pizzamanager.it/reimposta-password?token=…",
  "{{ .Email }}": "cliente@esempio.it",
  "{{ .NewEmail }}": "nuovo@esempio.it",
  "{{ .SiteURL }}": "https://pizzamanager.it",
}

function applyPreviewSamples(html) {
  let out = String(html || "")
  for (const [key, val] of Object.entries(PREVIEW_SAMPLE)) {
    out = out.split(key).join(val)
  }
  return out
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

export default function SuperadminAuthEmailTemplatesPage() {
  const [activeId, setActiveId] = useState(AUTH_EMAIL_TEMPLATES[0]?.id || "confirmation")
  const [view, setView] = useState("preview")
  const [copyMsg, setCopyMsg] = useState("")

  const active = useMemo(
    () => AUTH_EMAIL_TEMPLATES.find((t) => t.id === activeId) || AUTH_EMAIL_TEMPLATES[0],
    [activeId],
  )

  const previewHtml = useMemo(() => applyPreviewSamples(active?.html), [active])

  async function handleCopy(kind) {
    const text = kind === "subject" ? active.subject : active.html
    const ok = await copyText(text)
    setCopyMsg(ok ? "Copiato negli appunti." : "Copia non riuscita.")
    setTimeout(() => setCopyMsg(""), 2500)
  }

  return (
    <div className="dashboard-settings-page">
      <header className="sa-page-header" style={{ marginBottom: 20 }}>
        <p className="sa-page-kicker">Super Admin · Supabase Auth</p>
        <h1 className="dashboard-page-title sa-page-title">Template email (Auth)</h1>
        <p className="sa-page-lede" style={{ maxWidth: 820 }}>
          Anteprima dei testi definiti nel repository e applicati al progetto Supabase con{" "}
          <code>npm run supabase:auth:email-templates</code>. Mittente consigliato:{" "}
          <strong>PizzaManager Accounts</strong> · <strong>no-reply@pizzamanager.it</strong>.
        </p>
      </header>

      {copyMsg ? (
        <p
          role="status"
          style={{
            margin: "0 0 16px",
            padding: "10px 12px",
            borderRadius: 8,
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            color: "#166534",
            fontSize: 14,
          }}
        >
          {copyMsg}
        </p>
      ) : null}

      <div
        className="dashboard-box"
        style={{
          marginBottom: 20,
          padding: 16,
          border: "1px solid #bfdbfe",
          background: "#eff6ff",
          fontSize: 14,
          lineHeight: 1.55,
          color: "#1e3a8a",
        }}
      >
        <strong>Go-live:</strong> in Supabase → Authentication → SMTP attiva il mittente custom; in URL
        Configuration verifica <code>site_url</code> e redirect (anche tenant su sottodomini). Dopo
        modifiche ai file HTML qui sotto: <code>npm run supabase:auth:email-templates</code> (non usare{" "}
        <code>supabase config push</code> completo in produzione).
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(200px, 260px) 1fr",
          gap: 20,
          alignItems: "start",
        }}
      >
        <nav className="dashboard-box" style={{ padding: 12, margin: 0 }} aria-label="Tipi email">
          <p style={{ margin: "0 0 10px", fontSize: 12, fontWeight: 700, color: "#64748b" }}>
            TIPO MESSAGGIO
          </p>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
            {AUTH_EMAIL_TEMPLATES.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => setActiveId(t.id)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: activeId === t.id ? "2px solid #334155" : "1px solid #e2e8f0",
                    background: activeId === t.id ? "#f1f5f9" : "#fff",
                    cursor: "pointer",
                    fontSize: 14,
                    fontWeight: activeId === t.id ? 700 : 500,
                  }}
                >
                  {t.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="dashboard-box" style={{ padding: 20, margin: 0 }}>
          <h2 style={{ margin: "0 0 8px", fontSize: 18 }}>{active.label}</h2>
          <p style={{ margin: "0 0 6px", fontSize: 14, color: "#475569" }}>
            <strong>Oggetto:</strong> {active.subject}
          </p>
          <p style={{ margin: "0 0 6px", fontSize: 13, color: "#64748b" }}>
            File: <code>{active.file}</code>
          </p>
          <p style={{ margin: "0 0 14px", fontSize: 12, color: "#64748b" }}>
            Chiavi Supabase: <code>{active.supabaseSubjectKey}</code> · <code>{active.supabaseContentKey}</code>
          </p>
          <p style={{ margin: "0 0 12px", fontSize: 13, color: "#475569" }}>
            Variabili template: {active.variables.join(", ")}
          </p>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
            <button
              type="button"
              className={view === "preview" ? "btn-primary-dashboard" : "sa-table-action"}
              onClick={() => setView("preview")}
            >
              Anteprima
            </button>
            <button
              type="button"
              className={view === "html" ? "btn-primary-dashboard" : "sa-table-action"}
              onClick={() => setView("html")}
            >
              HTML sorgente
            </button>
            <button type="button" className="sa-table-action" onClick={() => void handleCopy("subject")}>
              Copia oggetto
            </button>
            <button type="button" className="sa-table-action" onClick={() => void handleCopy("html")}>
              Copia HTML
            </button>
          </div>

          {view === "preview" ? (
            <div
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: 10,
                overflow: "hidden",
                background: "#f8fafc",
              }}
            >
              <p style={{ margin: 0, padding: "8px 12px", fontSize: 12, color: "#64748b", background: "#fff" }}>
                Anteprima con valori di esempio al posto delle variabili Go template.
              </p>
              <iframe
                title={`Anteprima ${active.label}`}
                srcDoc={previewHtml}
                sandbox=""
                style={{
                  width: "100%",
                  minHeight: 420,
                  border: "none",
                  display: "block",
                  background: "#fff",
                }}
              />
            </div>
          ) : (
            <textarea
              readOnly
              value={active.html}
              spellCheck={false}
              style={{
                width: "100%",
                minHeight: 420,
                fontFamily: "ui-monospace, Consolas, monospace",
                fontSize: 12,
                lineHeight: 1.45,
                padding: 12,
                borderRadius: 8,
                border: "1px solid #e2e8f0",
                boxSizing: "border-box",
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}
