import { useMemo, useState, useEffect } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import {
  defaultInclusioni,
  inclusioniIncluded,
  loadPlansResolved,
} from "@/features/superadmin/catalog/plansStorage";
import "../../../styles/landing.css";

const DEFAULT_EMAIL = "info@pizzamanager.it";
const CUSTOM_VALUE = "__custom__";

function buildPianoEmailBlock(modelloId, plans, services, customInclusioni, moduliAggiuntivi) {
  if (!modelloId) {
    return "Piano richiesto: (non indicato — da definire insieme)";
  }
  if (modelloId === CUSTOM_VALUE) {
    const names = (services || []).filter((s) => customInclusioni?.[s.id]).map((s) => s.nome);
    return [
      "Piano richiesto: composizione personalizzata (moduli dal catalogo)",
      "Moduli selezionati:",
      names.length ? names.map((n) => `- ${n}`).join("\n") : "- (nessun modulo selezionato)",
    ].join("\n");
  }
  const p = plans.find((x) => x.id === modelloId);
  if (!p) {
    return `Piano richiesto: listino (id riferimento ${modelloId})`;
  }
  const incl = inclusioniIncluded(p.inclusioni, services);
  const includedIds = new Set(incl.map((s) => s.id));
  const extra = (services || []).filter((s) => moduliAggiuntivi?.[s.id] && !includedIds.has(s.id));
  const lines = [
    `Piano richiesto: listino "${p.nome}"`,
    "Moduli di riferimento (come da configurazione listino):",
    incl.length ? incl.map((s) => `- ${s.nome}`).join("\n") : "- (piano senza voci catalogo)",
  ];
  if (extra.length) {
    lines.push("", "Moduli aggiuntivi richiesti (oltre al piano):", extra.map((s) => `- ${s.nome}`).join("\n"));
  }
  return lines.join("\n");
}

export default function Contatti() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const catalog = useMemo(() => loadPlansResolved(), []);

  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);
  const [modelloId, setModelloId] = useState("");
  const [customInclusioni, setCustomInclusioni] = useState(() => defaultInclusioni(catalog.services));
  const [moduliAggiuntivi, setModuliAggiuntivi] = useState({});

  const selectOptions = useMemo(() => {
    const attivi = (catalog.plans || []).filter((p) => p.attivo !== false);
    const mid = modelloId;
    if (!mid || mid === CUSTOM_VALUE) return attivi;
    if (attivi.some((p) => p.id === mid)) return attivi;
    const extra = (catalog.plans || []).find((p) => p.id === mid);
    return extra ? [...attivi, extra] : attivi;
  }, [catalog.plans, modelloId]);

  const servizioIdsNelPianoSelezionato = useMemo(() => {
    if (!modelloId || modelloId === CUSTOM_VALUE) return null;
    const inc = inclusioniIncluded(
      catalog.plans.find((p) => p.id === modelloId)?.inclusioni,
      catalog.services,
    );
    return new Set(inc.map((x) => x.id));
  }, [modelloId, catalog.plans, catalog.services]);

  const [form, setForm] = useState({
    nome: "",
    email: "",
    azienda: "",
    telefono: "",
    messaggio: "",
  });

  useEffect(() => {
    const q = searchParams.get("piano");
    if (!q || !catalog.plans?.length) return;
    const exists = catalog.plans.some((p) => p.id === q);
    if (exists) setModelloId(q);
  }, [searchParams, catalog.plans]);

  useEffect(() => {
    if (location.hash !== "#prova-gratuita") return;
    const el = document.getElementById("prova-gratuita");
    if (el) {
      requestAnimationFrame(() => {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }, [location.pathname, location.hash]);

  const selectPlan = (value) => {
    setError(null);
    setModelloId(value);
    if (value === CUSTOM_VALUE) {
      setCustomInclusioni(defaultInclusioni(catalog.services));
      setModuliAggiuntivi({});
    } else {
      setModuliAggiuntivi({});
    }
  };

  const toggleServizio = (id) => {
    setCustomInclusioni((prev) => {
      const base = { ...defaultInclusioni(catalog.services), ...prev };
      base[id] = !base[id];
      return base;
    });
    setModelloId(CUSTOM_VALUE);
    setModuliAggiuntivi({});
    setError(null);
  };

  const toggleAddonServizio = (id) => {
    if (servizioIdsNelPianoSelezionato?.has(id)) return;
    setModuliAggiuntivi((prev) => ({ ...prev, [id]: !prev[id] }));
    setError(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(null);

    const nome = form.nome.trim();
    const email = form.email.trim();
    const azienda = form.azienda.trim();
    const telefono = form.telefono.trim();
    const messaggio = form.messaggio.trim();
    if (!nome || !email || !azienda || !telefono || !messaggio) {
      setError("Compila tutti i campi: nome, email, azienda o pizzeria, telefono e messaggio.");
      return;
    }

    if (!modelloId) {
      setError("Seleziona un piano dal listino oppure «Personalizzato» e i moduli desiderati.");
      return;
    }
    if (modelloId === CUSTOM_VALUE) {
      const any = Object.values(customInclusioni || {}).some(Boolean);
      if (!any) {
        setError("Con «Personalizzato», seleziona almeno un modulo oppure scegli un piano dal listino.");
        return;
      }
    }

    const pianoBlock = buildPianoEmailBlock(
      modelloId,
      catalog.plans,
      catalog.services,
      customInclusioni,
      moduliAggiuntivi,
    );
    const subject = encodeURIComponent(`Richiesta informazioni PizzaManager - ${azienda}`);
    const body = encodeURIComponent(
      `Nome: ${nome}\nEmail: ${email}\nAzienda / Pizzeria: ${azienda}\nTelefono: ${telefono}\n\n---\n${pianoBlock}\n---\n\nMessaggio:\n${messaggio}`,
    );
    window.location.href = `mailto:${DEFAULT_EMAIL}?subject=${subject}&body=${body}`;
    setSent(true);
  };

  const inputStyle = { padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 14 };

  return (
    <div className="landing-wrapper">
      <section className="hero" style={{ paddingTop: 40, paddingBottom: 60 }}>
        <div className="hero-text" style={{ maxWidth: 560, margin: "0 auto" }}>
          <h1 style={{ fontSize: "1.75rem", marginBottom: 8 }}>Contattaci</h1>
          <p className="hero-desc" style={{ marginBottom: 24 }}>
            Richiedi informazioni sul servizio, una demo o la licenza di prova. Compila il modulo e apri il messaggio in
            posta per inviarci una email.
          </p>

          <div
            id="prova-gratuita"
            className="dashboard-box"
            style={{
              marginBottom: 28,
              padding: 20,
              textAlign: "left",
              borderColor: "rgba(192, 57, 43, 0.25)",
              background: "linear-gradient(145deg, #fff8f6 0%, #fff 100%)",
            }}
          >
            <h2 style={{ fontSize: "1.125rem", margin: "0 0 10px", color: "#0f172a" }}>
              Prova 14 giorni (licenza di prova)
            </h2>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "#475569" }}>
              Non esiste un piano free permanente: l’ingresso è una <strong>prova di 14 giorni</strong> sul{" "}
              <strong>piano che scegli qui sotto</strong>, poi si attiva un <strong>piano a pagamento</strong>.
            </p>
            <p style={{ margin: "12px 0 0", fontSize: 14, lineHeight: 1.6, color: "#475569" }}>
              Per entrare in prova <strong>non basta registrarsi da soli</strong>: l’amministratore della piattaforma
              abilita il tenant e ti invia <strong>email e password</strong> (o invito).
            </p>
            <p style={{ margin: "12px 0 0", fontSize: 14, lineHeight: 1.6, color: "#475569" }}>
              Nel messaggio puoi aggiungere note: il riepilogo del <strong>piano o dei moduli richiesti</strong> viene
              allegato automaticamente all’email.
            </p>
          </div>

          {sent ? (
            <div className="dashboard-box" style={{ padding: 24, background: "#f0fdf4", borderColor: "#86efac" }}>
              <p style={{ margin: 0, color: "#166534" }}>
                Aprendo il client email con i dati inseriti. Invia il messaggio per contattarci.
              </p>
              <button
                type="button"
                className="btn-outline"
                style={{ marginTop: 16 }}
                onClick={() => setSent(false)}
              >
                Invia un altro messaggio
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <fieldset
                style={{
                  margin: 0,
                  padding: 16,
                  border: "1px solid #e2e8f0",
                  borderRadius: 12,
                  background: "#f8fafc",
                }}
              >
                <legend style={{ fontWeight: 700, fontSize: 14, padding: "0 8px", color: "#0f172a" }}>
                  Piano o moduli richiesti
                </legend>
                <label style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>Modello</span>
                  <select
                    value={modelloId}
                    onChange={(e) => selectPlan(e.target.value)}
                    style={inputStyle}
                    aria-invalid={!!error}
                  >
                    <option value="">Seleziona…</option>
                    {selectOptions.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome}
                        {p.attivo === false ? " (disattivato in listino)" : ""}
                      </option>
                    ))}
                    <option value={CUSTOM_VALUE}>Personalizzato — scelgo i moduli sotto</option>
                  </select>
                </label>

                {modelloId && modelloId !== CUSTOM_VALUE ? (
                  <p style={{ margin: "0 0 12px", fontSize: 13, color: "#475569", lineHeight: 1.5 }}>
                    Inclusi nel piano (riferimento):{" "}
                    {inclusioniIncluded(
                      catalog.plans.find((p) => p.id === modelloId)?.inclusioni,
                      catalog.services,
                    )
                      .map((s) => s.nome)
                      .join(", ") || "—"}
                  </p>
                ) : null}

                {modelloId === CUSTOM_VALUE ? (
                  <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 600, color: "#64748b" }}>
                    Scegli i moduli per una composizione su misura (almeno uno):
                  </p>
                ) : modelloId ? (
                  <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 600, color: "#64748b" }}>
                    Moduli già nel piano sono mostrati come inclusi (non modificabili). Spunta solo eventuali moduli{" "}
                    <strong>aggiuntivi</strong> oltre al listino.
                  </p>
                ) : null}

                {modelloId ? (
                  <div
                    style={{
                      maxHeight: 280,
                      overflowY: "auto",
                      border: "1px solid #e2e8f0",
                      borderRadius: 8,
                      padding: 10,
                      background: "#fff",
                    }}
                  >
                    <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                      {(catalog.services || []).map((s) => {
                        const giaNelPiano = servizioIdsNelPianoSelezionato?.has(s.id);
                        const bloccatoNelPiano = modelloId !== CUSTOM_VALUE && giaNelPiano;
                        const checked =
                          modelloId === CUSTOM_VALUE
                            ? !!customInclusioni[s.id]
                            : bloccatoNelPiano || !!moduliAggiuntivi[s.id];
                        return (
                          <li key={s.id} style={{ padding: "6px 0", borderBottom: "1px solid #f1f5f9", fontSize: 14 }}>
                            <label
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 10,
                                cursor: bloccatoNelPiano ? "default" : "pointer",
                                opacity: bloccatoNelPiano ? 0.85 : 1,
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={bloccatoNelPiano}
                                onChange={() =>
                                  modelloId === CUSTOM_VALUE ? toggleServizio(s.id) : toggleAddonServizio(s.id)
                                }
                              />
                              <span>
                                {s.nome}
                                <span style={{ color: "#94a3b8", fontSize: 12 }}> · {s.categoria}</span>
                                {giaNelPiano ? (
                                  <span style={{ color: "#64748b", fontSize: 11, marginLeft: 6 }}>
                                    (incluso nel piano — fisso)
                                  </span>
                                ) : null}
                              </span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null}

                {error ? (
                  <p style={{ margin: "10px 0 0", fontSize: 13, color: "#b91c1c" }} role="alert">
                    {error}
                  </p>
                ) : null}
              </fieldset>

              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>Nome *</span>
                <input
                  type="text"
                  required
                  value={form.nome}
                  onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                  placeholder="Il tuo nome"
                  style={inputStyle}
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>Email *</span>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="tua@email.it"
                  style={inputStyle}
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>Azienda / Pizzeria *</span>
                <input
                  type="text"
                  required
                  value={form.azienda}
                  onChange={(e) => setForm((f) => ({ ...f, azienda: e.target.value }))}
                  placeholder="Nome del locale o ragione sociale"
                  style={inputStyle}
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>Telefono *</span>
                <input
                  type="tel"
                  required
                  value={form.telefono}
                  onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))}
                  placeholder="Es. +39 333 1234567"
                  style={inputStyle}
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>Messaggio *</span>
                <textarea
                  required
                  rows={4}
                  value={form.messaggio}
                  onChange={(e) => setForm((f) => ({ ...f, messaggio: e.target.value }))}
                  placeholder="Es. Richiesta licenza di prova, orari preferiti per una chiamata…"
                  style={{ ...inputStyle, resize: "vertical" }}
                />
              </label>
              <button type="submit" className="btn-primary big">
                Invia richiesta via email
              </button>
            </form>
          )}
        </div>
      </section>

      <footer className="landing-footer">
        <Link to="/" style={{ marginRight: 16 }}>Torna alla home</Link>
      </footer>
    </div>
  );
}
