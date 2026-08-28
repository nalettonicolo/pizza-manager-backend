import { useCallback, useEffect, useMemo, useState } from "react";
import Loader from "@/components/feedback/Loader";
import ErrorState from "@/components/feedback/ErrorState";
import { supabase } from "@/lib/supabaseClient";
import { appConfirm } from "@/utils/appDialog";
import {
  deleteRegistroRichiestaSviluppo,
  getRegistroRichiesteSviluppo,
  insertRegistroRichiestaSviluppo,
} from "@/features/superadmin/services/superadminService";
import {
  REGISTRO_AREA_LABEL,
  REGISTRO_FONTE_LABEL,
  REGISTRO_STATO_LABEL,
  computeRegistroMonitor,
  filterRegistroRighe,
  formatRegistroDayLabel,
  groupRegistroByDay,
} from "@/features/superadmin/utils/registroAttivita";

function formatData(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatOreSilenzio(ore) {
  if (ore == null) return "nessuna voce";
  if (ore < 1) return "meno di un’ora fa";
  if (ore < 24) return `${Math.floor(ore)} h fa`;
  const giorni = Math.floor(ore / 24);
  return `${giorni} g fa`;
}

const STATO_STYLE = {
  completato: { bg: "#ecfdf5", fg: "#047857" },
  parziale: { bg: "#fff7ed", fg: "#c2410c" },
  bloccato: { bg: "#fef2f2", fg: "#b91c1c" },
};

const EMPTY_FORM = {
  richiesta: "",
  azioni: "",
  area: "",
  stato: "completato",
};

export default function RegistroAttivitaPage() {
  const [righe, setRighe] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filtroArea, setFiltroArea] = useState("");
  const [filtroFonte, setFiltroFonte] = useState("");
  const [filtroStato, setFiltroStato] = useState("");
  const [period, setPeriod] = useState("all");
  const [query, setQuery] = useState("");
  const [live, setLive] = useState("polling");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [nowTick, setNowTick] = useState(() => Date.now());

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const data = await getRegistroRichiesteSviluppo({ limit: 800 });
      setRighe(data);
      setError(null);
    } catch (err) {
      if (!silent) setError(err?.message || "Impossibile caricare il registro.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 30000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const poll = window.setInterval(() => {
      void load({ silent: true });
    }, 8000);

    const channel = supabase
      .channel("registro-attivita-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "log_richieste_sviluppo" },
        () => {
          void load({ silent: true });
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setLive("live");
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") setLive("polling");
      });

    return () => {
      window.clearInterval(poll);
      void supabase.removeChannel(channel);
    };
  }, [load]);

  const aree = useMemo(() => {
    const set = new Set(righe.map((r) => r.area).filter(Boolean));
    Object.keys(REGISTRO_AREA_LABEL).forEach((k) => set.add(k));
    return Array.from(set).sort();
  }, [righe]);

  const fonti = useMemo(() => {
    const set = new Set(righe.map((r) => r.fonte).filter(Boolean));
    Object.keys(REGISTRO_FONTE_LABEL).forEach((k) => set.add(k));
    return Array.from(set);
  }, [righe]);

  const monitor = useMemo(() => computeRegistroMonitor(righe, nowTick), [righe, nowTick]);

  const righeFiltrate = useMemo(
    () =>
      filterRegistroRighe(
        righe,
        { query, area: filtroArea, fonte: filtroFonte, stato: filtroStato, period },
        nowTick,
      ),
    [righe, query, filtroArea, filtroFonte, filtroStato, period, nowTick],
  );

  const gruppi = useMemo(() => groupRegistroByDay(righeFiltrate), [righeFiltrate]);

  const onSubmitNota = useCallback(
    async (e) => {
      e.preventDefault();
      setSaving(true);
      setFormError(null);
      try {
        const created = await insertRegistroRichiestaSviluppo({
          richiesta: form.richiesta,
          azioni: form.azioni,
          area: form.area || null,
          fonte: "umano",
          stato: form.stato,
        });
        setRighe((prev) => [created, ...prev.filter((r) => r.id !== created.id)]);
        setForm(EMPTY_FORM);
        setFormOpen(false);
      } catch (err) {
        setFormError(err?.message || "Impossibile salvare la nota.");
      } finally {
        setSaving(false);
      }
    },
    [form],
  );

  const onDelete = useCallback(async (r) => {
    const ok = await appConfirm("Eliminare questa voce dal registro? L’operazione non si può annullare.", {
      title: "Elimina voce",
      okLabel: "Elimina",
      cancelLabel: "Annulla",
      variant: "danger",
    });
    if (!ok) return;
    try {
      await deleteRegistroRichiestaSviluppo(r.id);
      setRighe((prev) => prev.filter((x) => x.id !== r.id));
    } catch (err) {
      setError(err?.message || "Eliminazione non riuscita.");
    }
  }, []);

  return (
    <div className="dashboard-settings-page">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div>
          <h1 className="dashboard-page-title" style={{ marginBottom: 6 }}>
            Registro attività
          </h1>
          <p className="dashboard-settings-section-desc" style={{ margin: 0, maxWidth: 720 }}>
            Quadro unico di quanto hai chiesto e di cosa è stato fatto — Cursor, Claude o una nota
            tua. Si aggiorna da solo: non serve riaprire le chat.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            title={live === "live" ? "Collegato in diretta" : "Aggiornamento automatico ogni 8 secondi"}
            style={{
              fontSize: 12,
              fontWeight: 700,
              padding: "4px 10px",
              borderRadius: 999,
              background: live === "live" ? "#ecfdf5" : "#f1f5f9",
              color: live === "live" ? "#047857" : "#475569",
            }}
          >
            {live === "live" ? "● In diretta" : "○ Aggiornamento automatico"}
          </span>
          <button type="button" className="btn-primary-dashboard" onClick={() => setFormOpen((v) => !v)}>
            {formOpen ? "Chiudi" : "Aggiungi nota"}
          </button>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 10,
          margin: "18px 0 16px",
        }}
      >
        <Kpi label="Ultime 24 ore" value={monitor.ultime24h} />
        <Kpi
          label="Ultima voce"
          value={formatOreSilenzio(monitor.oreSilenzio)}
          warn={monitor.silenzioLungo}
        />
        <Kpi label="Bloccati" value={monitor.bloccati} warn={monitor.bloccati > 0} />
        <Kpi label="Parziali" value={monitor.parziali} />
      </div>

      {monitor.silenzioLungo ? (
        <p
          style={{
            margin: "0 0 16px",
            padding: "10px 12px",
            borderRadius: 8,
            background: "#fff7ed",
            color: "#9a3412",
            fontSize: 13.5,
          }}
        >
          Nessuna nuova voce da più di 24 ore. Se hai chiesto qualcosa in chat e qui non compare,
          l’assistente non è riuscito a registrarla (di solito manca l’accesso a Supabase).
        </p>
      ) : null}

      {formOpen ? (
        <form
          onSubmit={onSubmitNota}
          className="dashboard-box"
          style={{ padding: 16, marginBottom: 16, display: "grid", gap: 10 }}
        >
          <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>Nota tua nel registro</p>
          <label style={{ fontSize: 13 }}>
            Cosa hai chiesto
            <textarea
              required
              value={form.richiesta}
              onChange={(e) => setForm((f) => ({ ...f, richiesta: e.target.value }))}
              rows={2}
              className="dashboard-search-input"
              style={{ width: "100%", marginTop: 4, minHeight: 64 }}
            />
          </label>
          <label style={{ fontSize: 13 }}>
            Cosa è stato fatto (o cosa resta da fare)
            <textarea
              required
              value={form.azioni}
              onChange={(e) => setForm((f) => ({ ...f, azioni: e.target.value }))}
              rows={3}
              className="dashboard-search-input"
              style={{ width: "100%", marginTop: 4, minHeight: 80 }}
            />
          </label>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <select
              value={form.area}
              onChange={(e) => setForm((f) => ({ ...f, area: e.target.value }))}
              className="dipendenti-role-select"
            >
              <option value="">Area (facoltativa)</option>
              {Object.entries(REGISTRO_AREA_LABEL).map(([k, lab]) => (
                <option key={k} value={k}>
                  {lab}
                </option>
              ))}
            </select>
            <select
              value={form.stato}
              onChange={(e) => setForm((f) => ({ ...f, stato: e.target.value }))}
              className="dipendenti-role-select"
            >
              {Object.entries(REGISTRO_STATO_LABEL).map(([k, lab]) => (
                <option key={k} value={k}>
                  {lab}
                </option>
              ))}
            </select>
            <button type="submit" className="btn-primary-dashboard" disabled={saving}>
              {saving ? "Salvataggio…" : "Salva nel registro"}
            </button>
          </div>
          {formError ? <p style={{ margin: 0, color: "#b91c1c", fontSize: 13 }}>{formError}</p> : null}
        </form>
      ) : null}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18, alignItems: "center" }}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cerca nel testo…"
          className="dashboard-search-input"
          style={{ minWidth: 220 }}
        />
        <select value={period} onChange={(e) => setPeriod(e.target.value)} className="dipendenti-role-select">
          <option value="all">Tutto lo storico</option>
          <option value="24h">Ultime 24 ore</option>
          <option value="7d">Ultimi 7 giorni</option>
        </select>
        <select value={filtroArea} onChange={(e) => setFiltroArea(e.target.value)} className="dipendenti-role-select">
          <option value="">Tutte le aree</option>
          {aree.map((a) => (
            <option key={a} value={a}>
              {REGISTRO_AREA_LABEL[a] || a}
            </option>
          ))}
        </select>
        <select value={filtroFonte} onChange={(e) => setFiltroFonte(e.target.value)} className="dipendenti-role-select">
          <option value="">Tutte le fonti</option>
          {fonti.map((f) => (
            <option key={f} value={f}>
              {REGISTRO_FONTE_LABEL[f] || f}
            </option>
          ))}
        </select>
        <select value={filtroStato} onChange={(e) => setFiltroStato(e.target.value)} className="dipendenti-role-select">
          <option value="">Tutti gli esiti</option>
          {Object.entries(REGISTRO_STATO_LABEL).map(([k, lab]) => (
            <option key={k} value={k}>
              {lab}
            </option>
          ))}
        </select>
        <span style={{ fontSize: 13, color: "#64748b" }}>
          {righeFiltrate.length} di {righe.length}
        </span>
      </div>

      {loading ? (
        <Loader />
      ) : error ? (
        <ErrorState message={error} />
      ) : righeFiltrate.length === 0 ? (
        <p style={{ fontSize: 14, color: "#64748b" }}>Nessuna voce in questo filtro. Aggiungi una nota o allarga i filtri.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {gruppi.map((g) => (
            <div key={g.day}>
              <h2 style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700, color: "#64748b", textTransform: "capitalize" }}>
                {formatRegistroDayLabel(g.day)}
              </h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {g.items.map((r) => (
                  <RegistroCard key={r.id} riga={r} onDelete={() => onDelete(r)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, warn }) {
  return (
    <div
      className="dashboard-box"
      style={{
        padding: "12px 14px",
        border: warn ? "1px solid #fdba74" : undefined,
      }}
    >
      <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: warn ? "#c2410c" : "#0f172a" }}>{value}</div>
    </div>
  );
}

function RegistroCard({ riga, onDelete }) {
  const stato = riga.stato || "completato";
  const stile = STATO_STYLE[stato] || STATO_STYLE.completato;
  return (
    <section className="dashboard-box" style={{ padding: "14px 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: "#94a3b8" }}>{formatData(riga.creato_il)}</span>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          {riga.fonte ? (
            <Badge bg="#eff6ff" fg="#1d4ed8">{REGISTRO_FONTE_LABEL[riga.fonte] || riga.fonte}</Badge>
          ) : null}
          {riga.area ? (
            <Badge bg="#fef2f2" fg="#962d22">{REGISTRO_AREA_LABEL[riga.area] || riga.area}</Badge>
          ) : null}
          <Badge bg={stile.bg} fg={stile.fg}>{REGISTRO_STATO_LABEL[stato] || stato}</Badge>
          <button
            type="button"
            onClick={onDelete}
            style={{
              border: "none",
              background: "transparent",
              color: "#94a3b8",
              cursor: "pointer",
              fontSize: 12,
              padding: 0,
            }}
          >
            Elimina
          </button>
        </div>
      </div>
      <p style={{ margin: "0 0 6px", fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{riga.richiesta}</p>
      <p style={{ margin: 0, fontSize: 13.5, color: "#334155", lineHeight: 1.55 }}>{riga.azioni}</p>
      {riga.branch || riga.pr_url ? (
        <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "#64748b" }}>
          {riga.branch ? <span>Branch {riga.branch}</span> : null}
          {riga.branch && riga.pr_url ? " · " : null}
          {riga.pr_url ? (
            <a href={riga.pr_url} target="_blank" rel="noreferrer">
              Apri la pull request
            </a>
          ) : null}
        </p>
      ) : null}
    </section>
  );
}

function Badge({ bg, fg, children }) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 700,
        padding: "2px 10px",
        borderRadius: 999,
        background: bg,
        color: fg,
      }}
    >
      {children}
    </span>
  );
}
