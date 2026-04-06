import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  IDS_BASE,
  IDS_ENTERPRISE,
  IDS_FULL,
  IDS_PRO,
} from "@/features/superadmin/catalog/defaultCatalog";
import { loadServicesCatalog, saveServicesCatalog } from "@/features/superadmin/catalog/servicesStorage";
import { applyServiziCsvToCatalog, parseServiziCsv } from "@/features/superadmin/utils/parseServiziCsv";
import { exportServiziCatalogCsv } from "@/features/superadmin/utils/exportSuperadminCsv";
import { SERVIZI_ROADMAP_STEPS, servizioRoadmapInCorso, percentualeEffettivaServizio } from "@/config/serviziRoadmapSteps";

const PLAN_TIERS = [
  {
    key: "base",
    label: "Base",
    subtitle: "Cassa, comanda, consegne, magazzino e contabilità locale (come da IDS_BASE nel registro).",
    ids: IDS_BASE,
  },
  {
    key: "pro",
    label: "Pro",
    subtitle: "Base più ordini online (cliente finale).",
    ids: IDS_PRO,
  },
  {
    key: "enterprise",
    label: "Enterprise",
    subtitle: "Pro più schermate tablet per ruoli operativi (cucina, bancone, pizzaioli, ecc.).",
    ids: IDS_ENTERPRISE,
  },
  {
    key: "full",
    label: "Full",
    subtitle: "Tutti i servizi del catalogo.",
    ids: IDS_FULL,
  },
];

function avgAvanzamento(services, ids) {
  const list = (services || []).filter((s) => ids.includes(s.id));
  if (!list.length) return 0;
  const sum = list.reduce((a, s) => a + percentualeEffettivaServizio(s.id, s.avanzamentoPercentuale), 0);
  return Math.round((sum / list.length) * 10) / 10;
}

function ProgressBar({ label, percent, subtitle }) {
  const p = Math.min(100, Math.max(0, Number(percent) || 0));
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, marginBottom: 8 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 17, color: "#0f172a" }}>{label}</h3>
          {subtitle ? (
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#64748b", lineHeight: 1.45 }}>{subtitle}</p>
          ) : null}
        </div>
        <span style={{ fontSize: 20, fontWeight: 800, color: "#d35400", whiteSpace: "nowrap" }}>{p}%</span>
      </div>
      <div
        style={{
          height: 14,
          borderRadius: 999,
          background: "#e2e8f0",
          overflow: "hidden",
          border: "1px solid #cbd5e1",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${p}%`,
            borderRadius: 999,
            background: "linear-gradient(90deg, #ea580c, #f97316)",
            transition: "width 0.35s ease",
          }}
        />
      </div>
    </div>
  );
}

const btnSecondary = {
  padding: "8px 16px",
  border: "1px solid #cbd5e1",
  borderRadius: 6,
  background: "#fff",
  color: "#334155",
  fontSize: 14,
  cursor: "pointer",
};

const statoRoadmapStyle = {
  ok: { bg: "#dcfce7", color: "#166534", label: "Ok" },
  wip: { bg: "#ffedd5", color: "#9a3412", label: "In corso" },
  todo: { bg: "#f1f5f9", color: "#475569", label: "Da fare" },
};

export default function SviluppoPage() {
  const [services, setServices] = useState(() => loadServicesCatalog());
  const [expandedRoadmapId, setExpandedRoadmapId] = useState(null);
  const fileRef = useRef(null);
  const focusServizio = servizioRoadmapInCorso();

  const toggleRoadmapRow = (id) => {
    setExpandedRoadmapId((prev) => (prev === id ? null : id));
  };

  const overall = useMemo(() => avgAvanzamento(services, (services || []).map((s) => s.id)), [services]);

  const tierStats = useMemo(
    () =>
      PLAN_TIERS.map((t) => ({
        ...t,
        percent: avgAvanzamento(services, t.ids),
      })),
    [services],
  );

  const onImportCsv = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const rows = parseServiziCsv(String(reader.result || ""));
      const next = applyServiziCsvToCatalog(loadServicesCatalog(), rows);
      setServices(next);
      saveServicesCatalog(next);
      e.target.value = "";
    };
    reader.readAsText(f, "UTF-8");
  };

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <Link
          to="/superadmin/dashboard"
          style={{
            display: "inline-block",
            padding: "10px 20px",
            background: "#d35400",
            color: "#fff",
            borderRadius: 6,
            textDecoration: "none",
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          ← Riepilogo
        </Link>
      </div>

      <h1 className="dashboard-page-title">Statistiche di sviluppo</h1>
      <p style={{ margin: "0 0 20px", fontSize: 14, color: "#64748b", maxWidth: 800, lineHeight: 1.6 }}>
        Le percentuali e i testi «cosa manca» sono definiti in <code>serviziRoadmapSteps.js</code> (aggiorna quel file per riflettere
        l&apos;avanzamento reale). Il CSV/catalogo serve per altri flussi; per le % qui conta la roadmap. Modifica anche dal{" "}
        <Link to="/superadmin/servizi">Catalogo servizi</Link>. Le barre per piano usano la media sui servizi inclusi nel bundle.
      </p>

      <div
        className="dashboard-box"
        style={{
          marginBottom: 28,
          border: "1px solid #c4b5fd",
          background: "linear-gradient(135deg, #f5f3ff 0%, #fff 55%)",
        }}
      >
        <h2 style={{ marginTop: 0, fontSize: 17, color: "#5b21b6" }}>Roadmap: un servizio alla volta</h2>
        <p style={{ margin: "0 0 14px", fontSize: 14, color: "#475569", lineHeight: 1.55 }}>
          Ordine di lavoro in <code style={{ fontSize: 12 }}>src/config/serviziRoadmapSteps.js</code>. Ogni voce ha{" "}
          <strong>percentuale</strong> (stima 0–100) e <strong>resto</strong> (cosa manca; una riga per punto). Un solo stato{" "}
          <strong>In corso</strong> (<code>wip</code>): quando chiudi uno step, imposta <code>ok</code> e sposta <code>wip</code> sul
          successivo. Per <strong>provare l&apos;app come tenant</strong> (licenza di prova) usa{" "}
          <Link to="/contatti#prova-gratuita">Contatti — Prova 14 giorni</Link>; da ogni scheda servizio apri i link in{" "}
          <strong>Prova in app</strong> (serve utente con ruolo adeguato).
        </p>
        {focusServizio ? (
          <p style={{ margin: "0 0 16px", fontSize: 14, color: "#0f172a", lineHeight: 1.55 }}>
            <strong>Focus corrente:</strong>{" "}
            <Link to={`/superadmin/servizi/${encodeURIComponent(focusServizio.id)}`} style={{ fontWeight: 700 }}>
              {focusServizio.titolo}
            </Link>{" "}
            <span style={{ color: "#64748b", fontSize: 13 }}>({focusServizio.id})</span>
            <br />
            <span style={{ color: "#64748b" }}>{focusServizio.nota}</span>
            <br />
            <span style={{ display: "inline-block", marginTop: 10, fontWeight: 800, fontSize: 18, color: "#d35400" }}>
              {(focusServizio.percentuale ?? 0)}% completamento stimato (roadmap)
            </span>
            <div
              style={{
                marginTop: 10,
                fontSize: 14,
                color: "#0f172a",
                lineHeight: 1.55,
                whiteSpace: "pre-wrap",
              }}
            >
              {focusServizio.resto ?? "—"}
            </div>
          </p>
        ) : (
          <p style={{ margin: "0 0 16px", fontSize: 14, color: "#64748b" }}>Nessun servizio in <code>wip</code>: impostane uno nel file roadmap.</p>
        )}
      </div>

      <div className="dashboard-box" style={{ marginBottom: 28, border: "1px solid #bae6fd", background: "linear-gradient(135deg, #f0f9ff 0%, #fff 50%)" }}>
        <h2 style={{ marginTop: 0, fontSize: 17, color: "#0369a1" }}>Checklist sviluppo / go-live (Super Admin)</h2>
        <p style={{ margin: "0 0 12px", fontSize: 14, color: "#475569", lineHeight: 1.55 }}>
          Attività operative non coperte dal solo codice; da spuntare a mano quando si pubblica un nuovo dominio vetrina.
        </p>
        <ul style={{ margin: 0, paddingLeft: 22, fontSize: 14, color: "#334155", lineHeight: 1.65 }}>
          <li style={{ marginBottom: 10 }}>
            <strong>Supabase → Authentication → URL configuration:</strong> in <em>Redirect URLs</em> aggiungi{" "}
            <code style={{ fontSize: 12 }}>https://&lt;dominio-tenant&gt;/reimposta-password</code> per ogni sito pizzeria online (il reset
            password <strong>clienti</strong> usa l&apos;origine del browser). Opzionale: wildcard tipo{" "}
            <code style={{ fontSize: 12 }}>https://*.tuodominio.it/reimposta-password</code> se supportato.
          </li>
          <li style={{ marginBottom: 0 }}>
            Dettaglio e contesto: guida <strong>Super Admin</strong> in-app (<Link to="/superadmin/guide/superadmin">Documentazione</Link>) —
            sezione <strong>§4.7c</strong> nel file <code>docs/GUIDA_SUPERADMIN.md</code>; smoke test in{" "}
            <code>docs/QA_CHECKLIST_SMOKE.md</code> (blocco Supabase Auth).
          </li>
        </ul>
      </div>

      <div
        className="dashboard-box"
        style={{
          marginBottom: 28,
          background: "linear-gradient(135deg, #fff7ed 0%, #fff 55%)",
          border: "1px solid #fed7aa",
        }}
      >
        <h2 style={{ marginTop: 0, fontSize: 15, color: "#9a3412", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Avanzamento complessivo
        </h2>
        <ProgressBar label="Sviluppo prodotto (media su tutti i servizi del catalogo)" percent={overall} />
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 24, alignItems: "center" }}>
        <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: "none" }} onChange={onImportCsv} />
        <button type="button" className="btn-primary-dashboard" onClick={() => fileRef.current?.click()}>
          Importa CSV avanzamento
        </button>
        <button type="button" onClick={() => exportServiziCatalogCsv(services)} style={btnSecondary}>
          Esporta CSV (con avanzamento)
        </button>
        <button
          type="button"
          onClick={() => {
            const next = loadServicesCatalog();
            setServices(next);
          }}
          style={btnSecondary}
        >
          Ricarica da browser
        </button>
      </div>

      <div className="dashboard-box" style={{ marginBottom: 28 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Avanzamento per piano commerciale</h2>
        {tierStats.map((t) => (
          <ProgressBar key={t.key} label={t.label} subtitle={t.subtitle} percent={t.percent} />
        ))}
        <ProgressBar
          label="Su misura"
          subtitle="Non ha un insieme fisso di servizi: la media qui coincide con l’intero catalogo (come riferimento)."
          percent={overall}
        />
      </div>

      <div className="dashboard-box" style={{ border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Dettaglio per servizio</h2>
        <p style={{ margin: "0 0 16px", fontSize: 14, color: "#64748b", lineHeight: 1.55 }}>
          Clicca una riga per aprire cosa resta da sviluppare. Stato roadmap:{" "}
          <span style={{ background: statoRoadmapStyle.ok.bg, color: statoRoadmapStyle.ok.color, padding: "2px 8px", borderRadius: 6, fontSize: 12, fontWeight: 700 }}>Ok</span>{" "}
          <span style={{ background: statoRoadmapStyle.wip.bg, color: statoRoadmapStyle.wip.color, padding: "2px 8px", borderRadius: 6, fontSize: 12, fontWeight: 700 }}>In corso</span>{" "}
          <span style={{ background: statoRoadmapStyle.todo.bg, color: statoRoadmapStyle.todo.color, padding: "2px 8px", borderRadius: 6, fontSize: 12, fontWeight: 700 }}>Da fare</span>.
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto",
            alignItems: "center",
            gap: 12,
            padding: "10px 14px",
            background: "#f8fafc",
            borderBottom: "1px solid #e2e8f0",
            fontSize: 12,
            fontWeight: 700,
            color: "#64748b",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          <span>Servizio</span>
          <span style={{ textAlign: "right", minWidth: 72 }}>Avanzamento</span>
        </div>
        <div role="list">
          {SERVIZI_ROADMAP_STEPS.map((row) => {
            const st = statoRoadmapStyle[row.stato] ?? statoRoadmapStyle.todo;
            const open = expandedRoadmapId === row.id;
            const puntiMancanti = String(row.resto || "")
              .split("\n")
              .map((l) => l.trim())
              .filter(Boolean);
            return (
              <div key={row.id} role="listitem" style={{ borderBottom: "1px solid #e2e8f0" }}>
                <button
                  type="button"
                  onClick={() => toggleRoadmapRow(row.id)}
                  aria-expanded={open}
                  style={{
                    width: "100%",
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    gap: 12,
                    alignItems: "center",
                    padding: "14px 14px",
                    border: "none",
                    background: open ? "#f1f5f9" : "#fff",
                    cursor: "pointer",
                    textAlign: "left",
                    font: "inherit",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                      <span style={{ fontWeight: 700, color: "#0f172a" }}>{row.titolo}</span>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "2px 8px",
                          borderRadius: 999,
                          fontSize: 11,
                          fontWeight: 700,
                          background: st.bg,
                          color: st.color,
                        }}
                      >
                        {st.label}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>{row.id}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontWeight: 800, fontSize: 18, color: "#d35400", whiteSpace: "nowrap" }}>{row.percentuale ?? 0}%</span>
                    <span style={{ color: "#94a3b8", fontSize: 14 }} aria-hidden>{open ? "▾" : "▸"}</span>
                  </div>
                </button>
                {open ? (
                  <div
                    style={{
                      padding: "0 14px 16px 14px",
                      background: "#fafafa",
                      borderTop: "1px solid #f1f5f9",
                    }}
                  >
                    <p style={{ margin: "12px 0 8px", fontSize: 12, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      Cosa resta da sviluppare
                    </p>
                    {puntiMancanti.length ? (
                      <ul style={{ margin: 0, paddingLeft: 22, fontSize: 14, color: "#334155", lineHeight: 1.65 }}>
                        {puntiMancanti.map((line, i) => (
                          <li key={i} style={{ marginBottom: 6 }}>
                            {line}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>—</p>
                    )}
                    {row.nota ? (
                      <>
                        <p style={{ margin: "14px 0 6px", fontSize: 12, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                          Contesto / stato in app
                        </p>
                        <p style={{ margin: 0, fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>{row.nota}</p>
                      </>
                    ) : null}
                    <div style={{ marginTop: 14 }}>
                      <Link
                        to={`/superadmin/servizi/${encodeURIComponent(row.id)}`}
                        style={{ fontSize: 14, fontWeight: 600, color: "#c2410c" }}
                      >
                        Apri scheda servizio →
                      </Link>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
