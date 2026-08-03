import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import PubblicazioneSitoWorkspace from "@/features/pubblicazione/PubblicazioneSitoWorkspace"
import SaListSearchField from "@/features/superadmin/components/SaListSearchField"
import {
  getGoLiveChecklist,
  getTenants,
  upsertGoLiveChecklist,
} from "@/features/superadmin/services/superadminService"
import { pianoDisplayLabel } from "@/features/superadmin/utils/pianoLabels"
import {
  GO_LIVE_CHECK_ITEMS,
  buildAuthRedirectUrlsForHostname,
  emptyGoLiveChecks,
  mergeGoLiveChecks,
} from "@/features/superadmin/utils/goLiveHelpers"
import {
  PUBLIC_DOMAIN_CNAME_TARGET,
  PUBLIC_DOMAIN_FIREBASE_DOCS_URL,
  PUBLIC_SAAS_BASE_URL,
} from "@/config/publicDomain"
import { normalizeListSearchQuery, rowMatchesListSearch } from "@/utils/listSearchFilter"
import DnsHostGuidesPanel from "@/features/pubblicazione/DnsHostGuidesPanel"

function statusLabel(v) {
  const m = {
    none: "Non configurato",
    requested: "Richiesta salvata",
    dns_pending: "DNS / Firebase",
    live: "Live",
  }
  return m[v] || v || "—"
}

const card = {
  marginBottom: 20,
  padding: 20,
  borderRadius: 12,
  border: "1px solid #e2e8f0",
  background: "#fff",
  boxShadow: "0 4px 14px rgba(15, 23, 42, 0.05)",
}

/**
 * Go-live unificato: elenco clienti + dominio + checklist DB + Auth redirects.
 * Sostituisce Deploy siti + Pubblicazione dominio.
 */
export default function SuperadminGoLivePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [tenants, setTenants] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [query, setQuery] = useState("")
  const [tenantId, setTenantId] = useState("")
  const [checks, setChecks] = useState(() => emptyGoLiveChecks())
  const [checkBusy, setCheckBusy] = useState(false)
  const [checkMsg, setCheckMsg] = useState(null)

  const loadTenants = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await getTenants()
      setTenants(Array.isArray(data) ? data : [])
    } catch (e) {
      setError(e?.message || "Errore caricamento clienti")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadTenants()
  }, [loadTenants])

  useEffect(() => {
    const q = searchParams.get("tenant")
    if (!q) {
      setTenantId("")
      return
    }
    if (!tenants.length) return
    setTenantId(tenants.some((t) => t.id === q) ? q : "")
  }, [searchParams, tenants])

  const filtered = useMemo(() => {
    const q = normalizeListSearchQuery(query)
    if (!q) return tenants
    return tenants.filter((t) =>
      rowMatchesListSearch(q, [t.nome, t.slug, t.public_domain, t.sito_web_cliente, t.id]),
    )
  }, [tenants, query])

  const selected = tenants.find((t) => t.id === tenantId) || null

  const loadChecks = useCallback(async (id) => {
    if (!id) {
      setChecks(emptyGoLiveChecks())
      return
    }
    try {
      const row = await getGoLiveChecklist(id)
      setChecks(mergeGoLiveChecks(row))
      setCheckMsg(null)
    } catch (e) {
      setChecks(emptyGoLiveChecks())
      setCheckMsg(e?.message || "Checklist non disponibile (modulo SQL 29)")
    }
  }, [])

  useEffect(() => {
    void loadChecks(tenantId)
  }, [tenantId, loadChecks])

  const selectTenant = (id) => {
    setTenantId(id)
    if (id) setSearchParams({ tenant: id })
    else setSearchParams({})
  }

  const toggleCheck = async (itemId) => {
    if (!tenantId) return
    const next = { ...checks, [itemId]: !checks[itemId] }
    setChecks(next)
    setCheckBusy(true)
    try {
      const saved = await upsertGoLiveChecklist(tenantId, next)
      setChecks(mergeGoLiveChecks(saved))
      setCheckMsg("Checklist salvata (condivisa).")
    } catch (e) {
      setCheckMsg(e?.message || "Salvataggio checklist fallito")
      await loadChecks(tenantId)
    } finally {
      setCheckBusy(false)
    }
  }

  const authUrls = useMemo(() => {
    const host = selected?.public_domain || (selected?.slug ? `${selected.slug}.pizzamanager.it` : "")
    return buildAuthRedirectUrlsForHostname(host)
  }, [selected])

  const checkedCount = GO_LIVE_CHECK_ITEMS.filter((i) => checks[i.id]).length
  const pct = Math.round((checkedCount / GO_LIVE_CHECK_ITEMS.length) * 100)

  const copyAllAuth = async () => {
    try {
      await navigator.clipboard.writeText(authUrls.join("\n"))
      setCheckMsg("Redirect Auth copiati negli appunti.")
    } catch {
      setCheckMsg("Copia non riuscita.")
    }
  }

  return (
    <div className="dashboard-settings-page">
      <header className="sa-page-header" style={{ marginBottom: 18 }}>
        <p className="sa-page-kicker">Super Admin · Go Live</p>
        <h1 className="dashboard-page-title sa-page-title">Go-live cliente</h1>
        <p className="sa-page-lede" style={{ maxWidth: 720 }}>
          Un solo flusso: slug → dominio menu (DNS/Firebase) → Redirect Auth. Il codice piattaforma si aggiorna con un
          deploy globale, non per ogni locale.
        </p>
      </header>

      <section style={{ ...card, borderColor: "#fdba74", background: "#fff7ed" }}>
        <h2 style={{ margin: "0 0 10px", fontSize: 16, color: "#9a3412" }}>Modello semplice (3 passi)</h2>
        <ol style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.75, color: "#1e293b" }}>
          <li>
            <strong>A · Slug</strong> — anagrafica attiva → anteprima{" "}
            <code>{selected?.slug ? `https://${selected.slug}.pizzamanager.it` : "https://{slug}.pizzamanager.it"}</code>
          </li>
          <li>
            <strong>B · Dominio menu</strong> — salva hostname sotto, aggiungi host in Firebase, CNAME →{" "}
            <code>{PUBLIC_DOMAIN_CNAME_TARGET}</code>
          </li>
          <li>
            <strong>C · Auth</strong> — incolla i Redirect URL in Supabase (lista copiabile sotto)
          </li>
        </ol>
        <p style={{ margin: "12px 0 0", fontSize: 13, color: "#9a3412", lineHeight: 1.5 }}>
          Non rifare il deploy quando aggiungi un dominio. Deploy codice solo per release prodotto, e solo se richiesto
          esplicitamente (<code>npm run deploy:full:ci</code>).
        </p>
      </section>

      <section style={card} id="guida-dns-host">
        <h2 className="dashboard-settings-section-title" style={{ marginTop: 0 }}>
          Guide DNS per host + go-live Francy
        </h2>
        <p style={{ margin: "0 0 16px", fontSize: 13, color: "#64748b", lineHeight: 1.55 }}>
          Register.it, Aruba, Cloudflare, OVH, GoDaddy, Namecheap e guida generica. Incluse linee guida CTA sul sito
          esterno e checklist Francy Pizza.
        </p>
        <DnsHostGuidesPanel />
      </section>

      <section style={card}>
        <h2 className="dashboard-settings-section-title" style={{ marginTop: 0 }}>
          1. Seleziona cliente
        </h2>
        <div style={{ marginBottom: 12, maxWidth: 480 }}>
          <SaListSearchField
            id="sa-golive-search"
            value={query}
            onChange={setQuery}
            placeholder="Cerca nome, slug, dominio…"
            resultsCount={filtered.length}
            totalCount={tenants.length}
          />
        </div>
        {loading ? (
          <p style={{ color: "#64748b" }}>Caricamento…</p>
        ) : error ? (
          <p style={{ color: "#b91c1c" }}>{error}</p>
        ) : (
          <div className="dashboard-table-wrap" style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", minWidth: 640 }}>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Slug</th>
                  <th>Dominio menu</th>
                  <th>Stato</th>
                  <th>Piano</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr key={t.id} style={{ background: tenantId === t.id ? "#fff7ed" : undefined }}>
                    <td style={{ fontWeight: 600 }}>{t.nome || "—"}</td>
                    <td>{t.slug || "—"}</td>
                    <td style={{ fontSize: 13 }}>{t.public_domain || "—"}</td>
                    <td style={{ fontSize: 13 }}>{statusLabel(t.public_domain_status)}</td>
                    <td>{pianoDisplayLabel(t.piano)}</td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        type="button"
                        onClick={() => selectTenant(t.id)}
                        style={{
                          padding: "6px 12px",
                          borderRadius: 8,
                          border: "1px solid #cbd5e1",
                          background: "#fff",
                          cursor: "pointer",
                          fontWeight: 600,
                          fontSize: 13,
                        }}
                      >
                        Seleziona
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {selected ? (
          <p style={{ margin: "12px 0 0", fontSize: 13, color: "#475569" }}>
            Selezionato: <strong>{selected.nome}</strong>
            {" · "}
            <Link to="/superadmin/tenants" style={{ fontWeight: 600, color: "#c0392b" }}>
              Apri anagrafica
            </Link>
            {selected.slug ? (
              <>
                {" · "}
                <a
                  href={`https://${selected.slug}.pizzamanager.it`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontWeight: 600, color: "#c0392b" }}
                >
                  Anteprima slug
                </a>
              </>
            ) : null}
          </p>
        ) : (
          <p style={{ margin: "12px 0 0", fontSize: 14, color: "#64748b" }}>
            Seleziona un cliente per continuare con i passi B e C.
          </p>
        )}
      </section>

      {tenantId ? (
        <>
          <section style={card}>
            <h2 className="dashboard-settings-section-title" style={{ marginTop: 0 }}>
              2–3. Dominio menu, DNS e Firebase
            </h2>
            <p style={{ margin: "0 0 14px", fontSize: 13, color: "#64748b", lineHeight: 1.55 }}>
              Campo principale: <strong>dominio pubblico</strong> (menu/ordini). «Sito web cliente» solo se esiste un sito
              marketing esterno diverso. Documentazione Firebase:{" "}
              <a href={PUBLIC_DOMAIN_FIREBASE_DOCS_URL} target="_blank" rel="noopener noreferrer">
                custom domain
              </a>
              .
            </p>
            <PubblicazioneSitoWorkspace tenantId={tenantId} embedded basePath="/superadmin/go-live" />
          </section>

          <section style={card}>
            <h2 className="dashboard-settings-section-title" style={{ marginTop: 0 }}>
              C · Redirect Auth Supabase
            </h2>
            <p style={{ margin: "0 0 10px", fontSize: 14, color: "#475569", lineHeight: 1.55 }}>
              Dashboard Supabase → Authentication → URL configuration → Redirect URLs. Site URL tipico:{" "}
              <code>{PUBLIC_SAAS_BASE_URL}</code>
            </p>
            {authUrls.length ? (
              <>
                <pre
                  style={{
                    margin: "0 0 10px",
                    padding: 12,
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                    fontSize: 12,
                    overflow: "auto",
                  }}
                >
                  {authUrls.join("\n")}
                </pre>
                <button
                  type="button"
                  onClick={() => void copyAllAuth()}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    background: "#fff",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Copia elenco Redirect URL
                </button>
              </>
            ) : (
              <p style={{ margin: 0, fontSize: 14, color: "#b45309" }}>
                Salva prima lo slug o il dominio pubblico per generare gli URL.
              </p>
            )}
          </section>

          <section style={card}>
            <h2 className="dashboard-settings-section-title" style={{ marginTop: 0 }}>
              Checklist go-live (condivisa)
            </h2>
            <p style={{ margin: "0 0 8px", fontSize: 13, color: "#64748b" }}>
              Salvata su database — visibile a tutto il team Super Admin. Completamento:{" "}
              <strong>{pct}%</strong>
              {checkBusy ? " · salvataggio…" : null}
            </p>
            {checkMsg ? (
              <p style={{ margin: "0 0 10px", fontSize: 13, color: "#0f766e" }}>{checkMsg}</p>
            ) : null}
            <div style={{ display: "grid", gap: 8 }}>
              {GO_LIVE_CHECK_ITEMS.map((item) => (
                <label
                  key={item.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 10px",
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                    fontSize: 14,
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={!!checks[item.id]}
                    disabled={checkBusy}
                    onChange={() => void toggleCheck(item.id)}
                  />
                  {item.label}
                </label>
              ))}
            </div>
          </section>

          <section style={{ ...card, background: "#f8fafc" }}>
            <h2 className="dashboard-settings-section-title" style={{ marginTop: 0 }}>
              Wildcard e automazione (roadmap attiva)
            </h2>
            <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, lineHeight: 1.65, color: "#475569" }}>
              <li>
                Obiettivo DNS: <code>*.pizzamanager.it</code> → Firebase Hosting (anteprima slug senza record per-tenant).
              </li>
              <li>
                Dominio custom del cliente: ancora CNAME manuale verso <code>{PUBLIC_DOMAIN_CNAME_TARGET}</code> + host in
                Firebase (automazione API Firebase in backlog).
              </li>
              <li>
                Sync Redirect URL da DB:{" "}
                <code>npm run supabase:auth:sync-redirects -- --from-db</code> (Management API).
              </li>
            </ul>
          </section>
        </>
      ) : null}
    </div>
  )
}
