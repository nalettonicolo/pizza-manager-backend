import { useCallback, useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { useTenant } from "@/app/contexts/TenantContext"
import { updateTenantSettings } from "@/features/admin/services/adminService"
import {
  CUCINA_PREP_CATEGORY_COLOR_KEYS,
  DEFAULT_CUCINA_PREP_CATEGORY_COLORS,
  mergeCucinaPrepColorsFromParametri,
} from "@/utils/cucinaPrepCategoryTheme"
import { readStampaModalita } from "@/utils/stampaOperativaConfig"

const LABELS = {
  congelato: { title: "Congelato / surgelati", hint: 'Tipo «congelato» (o testo con «congel» / «surgel»).' },
  affettato: { title: "Affettato", hint: 'Tipo «affettato».' },
  bibite: { title: "Bibita", hint: 'Tipo «bibita» (anche «bibite»).' },
  fritto: { title: "Fritto", hint: 'Tipo «fritto».' },
  dolce: { title: "Dolce", hint: 'Tipo «dolce».' },
  comune: { title: "Comune (default)", hint: "Prep. cucina senza tipo riconosciuto e senza colore personalizzato." },
}

function isHexColor(s) {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(s ?? "").trim())
}

export default function PrepCucinaColoriPage() {
  const { tenantId, tenantData, refreshTenant } = useTenant()
  const tabletAttivo = readStampaModalita(tenantData?.parametri_operativi) === "con_tablet"
  const merged = useMemo(
    () => mergeCucinaPrepColorsFromParametri(tenantData?.parametri_operativi),
    [tenantData?.parametri_operativi],
  )

  const [draft, setDraft] = useState(() => ({ ...merged }))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setDraft({ ...merged })
  }, [merged])

  const dirty = useMemo(() => {
    return CUCINA_PREP_CATEGORY_COLOR_KEYS.some((k) => (draft[k] || "").trim() !== (merged[k] || ""))
  }, [draft, merged])

  const handleSave = useCallback(async () => {
    if (!tenantId || !tenantData) return
    for (const k of CUCINA_PREP_CATEGORY_COLOR_KEYS) {
      const v = String(draft[k] ?? "").trim()
      if (!isHexColor(v)) {
        alert(`Colore non valido per «${k}»: usa formato #abc o #aabbcc.`)
        return
      }
    }
    setSaving(true)
    try {
      const prevPo =
        tenantData.parametri_operativi && typeof tenantData.parametri_operativi === "object"
          ? tenantData.parametri_operativi
          : {}
      const cucina_prep_colori_categoria = {}
      for (const k of CUCINA_PREP_CATEGORY_COLOR_KEYS) {
        cucina_prep_colori_categoria[k] = String(draft[k] ?? "").trim().toLowerCase()
      }
      await updateTenantSettings(tenantId, {
        parametri_operativi: {
          ...prevPo,
          cucina_prep_colori_categoria,
        },
      })
      await refreshTenant()
      alert("Colori salvati. Si applicano subito alla vista Cucina (preparazioni).")
    } catch (err) {
      console.error(err)
      alert(err?.message || "Salvataggio non riuscito.")
    } finally {
      setSaving(false)
    }
  }, [tenantId, tenantData, draft, refreshTenant])

  const handleResetDefaults = useCallback(() => {
    setDraft({ ...DEFAULT_CUCINA_PREP_CATEGORY_COLORS })
  }, [])

  if (!tabletAttivo) {
    return (
      <div className="dashboard-menu-area">
        <div className="dashboard-title-row">
          <h1 className="dashboard-page-title">Colori preparazione Cucina</h1>
        </div>
        <div className="dashboard-box" style={{ padding: 20, maxWidth: 560 }}>
          <p style={{ margin: 0, color: "#475569", fontSize: 14, lineHeight: 1.55 }}>
            Questa impostazione si applica solo ai locali che lavorano <strong>«Con tablet nei reparti»</strong>: con
            «Solo cassa» le comande escono su carta termica, dove i colori non compaiono mai — quindi qui non c&apos;è
            nulla da configurare.
          </p>
          <p style={{ margin: "12px 0 0", fontSize: 14 }}>
            Per attivare i tablet nei reparti vai in{" "}
            <Link
              to="/admin/settings/stampa-operativa"
              style={{ fontWeight: 600, color: "#0f172a", textDecoration: "underline" }}
            >
              Impostazioni → Stampa operativa
            </Link>
            .
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard-menu-area">
      <div className="dashboard-title-row">
        <h1 className="dashboard-page-title">Colori preparazione Cucina</h1>
      </div>
      <p className="dashboard-menu-intro">
        Sfondo dei pulsanti <strong>preparazione</strong> in <strong>Area operativa → Cucina</strong> (task cliccabili, non le tab
        orarie) o nel <strong>Bancone</strong> se il tablet dedicato Cucina non è attivo. Priorità: 1) colore sull&apos;ingrediente in{" "}
        <Link to="/admin/menu/ingredienti" style={{ fontWeight: 600, color: "#0f172a", textDecoration: "underline" }}>
          Ingredienti
        </Link>
        ; 2) questi colori in base al <strong>tipo</strong> dell&apos;ingrediente (affettato, fritto, dolce, bibita, congelato); 3) «Comune».
      </p>

      <div className="dashboard-box" style={{ padding: 20, maxWidth: 560 }}>
        <ul style={{ margin: "0 0 20px", paddingLeft: 18, color: "#475569", fontSize: 14, lineHeight: 1.5 }}>
          {CUCINA_PREP_CATEGORY_COLOR_KEYS.map((key) => {
            const { title, hint } = LABELS[key]
            return (
              <li key={key} style={{ marginBottom: 8 }}>
                <strong>{title}</strong> — {hint}
              </li>
            )
          })}
        </ul>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {CUCINA_PREP_CATEGORY_COLOR_KEYS.map((key) => {
            const { title } = LABELS[key]
            const val = draft[key] ?? ""
            return (
              <label key={key} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
                <span style={{ minWidth: 140, fontWeight: 600, fontSize: 14, color: "#334155" }}>{title}</span>
                <input
                  type="color"
                  value={isHexColor(val) ? val : "#ffffff"}
                  onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                  aria-label={`Colore ${key}`}
                  style={{ width: 48, height: 36, padding: 0, border: "1px solid #cbd5e1", borderRadius: 6, cursor: "pointer" }}
                />
                <input
                  type="text"
                  className="dashboard-search-input"
                  value={val}
                  onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                  placeholder="#rrggbb"
                  style={{ width: 120, fontFamily: "monospace", fontSize: 13 }}
                  spellCheck={false}
                />
                <span
                  style={{
                    width: 36,
                    height: 28,
                    borderRadius: 6,
                    border: "1px solid #e2e8f0",
                    background: isHexColor(val) ? val : "#f1f5f9",
                  }}
                  title="Anteprima"
                />
              </label>
            )
          })}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 22, paddingTop: 16, borderTop: "1px solid #e2e8f0" }}>
          <button type="button" className="dashboard-settings-btn-secondary" onClick={handleResetDefaults} disabled={saving}>
            Ripristina default
          </button>
          <button type="button" className="btn-primary-dashboard" onClick={() => void handleSave()} disabled={saving || !dirty}>
            {saving ? "Salvataggio…" : "Salva colori"}
          </button>
        </div>
      </div>
    </div>
  )
}
