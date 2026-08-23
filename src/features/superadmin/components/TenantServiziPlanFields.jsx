import {
  defaultInclusioni,
  displayPrezzoForPlan,
  formatValiditaMesiLabel,
} from "@/features/superadmin/catalog/plansStorage";
import { formatEuroMonth, sumMonthlyFromInclusioni } from "@/features/superadmin/catalog/servicesStorage";
import { inferPianoSaasFromServiziIds } from "@/utils/tenantServiziPolicy";

const boxStyle = {
  padding: 14,
  background: "#f8fafc",
  borderRadius: 10,
  border: "1px solid #e2e8f0",
};

function mapDbPianoSuggestionToUi(suggested) {
  if (suggested === "FREE") return "FREE";
  if (suggested === "PRO") return "PRO";
  return "ENTERPRISE";
}

/**
 * Sezione modale cliente: modello da listino Super Admin, personalizzazione servizi, stima canone.
 */
export default function TenantServiziPlanFields({
  modal,
  catalogServices,
  commercialPlans,
  labelStyle,
  inputStyle,
  setModal,
  reloadInclusioniFromPiano,
}) {
  const applyTemplate = (planId) => {
    if (!planId) {
      setModal((m) => ({
        ...m,
        pianoTemplateId: "",
        pianoCommercialeNome: "",
        serviziPersonalizzati: false,
        inclusioni: reloadInclusioniFromPiano(m.piano, catalogServices),
      }));
      return;
    }
    const p = commercialPlans.find((x) => x.id === planId);
    if (!p) return;
    const base = defaultInclusioni(catalogServices);
    setModal((m) => ({
      ...m,
      pianoTemplateId: planId,
      pianoCommercialeNome: p.nome ?? "",
      serviziPersonalizzati: false,
      inclusioni: { ...base, ...(p.inclusioni || {}) },
    }));
  };

  const toggleServizio = (serviceId) => {
    setModal((m) => {
      const inc = { ...defaultInclusioni(catalogServices), ...(m.inclusioni || {}) };
      inc[serviceId] = !inc[serviceId];
      return {
        ...m,
        inclusioni: inc,
        serviziPersonalizzati: true,
        pianoTemplateId: "",
        // Mantieni l’etichetta listino (es. nome del modello scelto); l’utente può aggiungere/togliere servizi senza perdere il nome.
        pianoCommercialeNome: m.pianoCommercialeNome ?? "",
      };
    });
  };

  const setPersonalized = (checked) => {
    setModal((m) => {
      if (!checked) {
        return {
          ...m,
          serviziPersonalizzati: false,
          pianoTemplateId: "",
          pianoCommercialeNome: "",
          inclusioni: reloadInclusioniFromPiano(m.piano, catalogServices),
        };
      }
      return {
        ...m,
        serviziPersonalizzati: true,
        pianoTemplateId: "",
        pianoCommercialeNome: m.pianoCommercialeNome ?? "",
      };
    });
  };

  const alignPianoToServizi = () => {
    const ids = Object.entries(modal.inclusioni || {})
      .filter(([, on]) => on)
      .map(([id]) => id);
    const suggested = inferPianoSaasFromServiziIds(ids);
    setModal((m) => ({ ...m, piano: mapDbPianoSuggestionToUi(suggested) }));
  };

  const draftPlan = { inclusioni: modal.inclusioni, nome: modal.nome || "Cliente" };
  const canoneStimato = displayPrezzoForPlan(draftPlan, catalogServices);
  const sumRaw = sumMonthlyFromInclusioni(modal.inclusioni, catalogServices);
  const canAlign = (modal.serviziPersonalizzati || !!modal.pianoTemplateId) && Number.isFinite(sumRaw) && sumRaw > 0;

  // Scadenza (opzionale, condivisa da entrambi gli sconti): oltre quella data lo sconto non si
  // applica più al canone stimato, senza azzerare i valori impostati (basta togliere la data per
  // riattivare la stessa promozione).
  const scontoScaduto = (() => {
    const scadenza = modal.sconto_scadenza
    if (!scadenza) return false
    const oggi = new Date()
    const oggiYmd = `${oggi.getFullYear()}-${String(oggi.getMonth() + 1).padStart(2, "0")}-${String(oggi.getDate()).padStart(2, "0")}`
    return String(scadenza) < oggiYmd
  })()
  const pctScontoRaw = Math.min(100, Math.max(0, Number(modal.sconto_percentuale) || 0))
  const euroFissoRaw = Math.max(
    0,
    Math.round((Number(String(modal.sconto_importo_euro ?? "").replace(",", ".")) || 0) * 100) / 100,
  )
  const pctSconto = scontoScaduto ? 0 : pctScontoRaw
  const euroFisso = scontoScaduto ? 0 : euroFissoRaw
  const dopoPercentuale =
    Number.isFinite(sumRaw) && sumRaw > 0 ? Math.round(sumRaw * (1 - pctSconto / 100) * 100) / 100 : 0;
  const nettoCanone =
    Number.isFinite(dopoPercentuale) ? Math.max(0, Math.round((dopoPercentuale - euroFisso) * 100) / 100) : 0;
  const mostraNetto = Number.isFinite(sumRaw) && sumRaw > 0 && (pctSconto > 0 || euroFisso > 0);
  const promoScadutaConValori = scontoScaduto && (pctScontoRaw > 0 || euroFissoRaw > 0);

  return (
    <section className="sa-form-section">
      <h3 className="sa-form-section-title">Piano commerciale e servizi</h3>
      <p className="sa-form-section-lede">
        Scegli un <strong>modello del listino</strong>: il nome resta l’etichetta di riferimento anche se poi aggiungi o
        togli servizi dal catalogo. Con <code>VITE_ENFORCE_SERVIZI_PLAN</code> attivo, i moduli seguono l’elenco
        personalizzato oppure il bundle del livello contratto.
      </p>

      <div style={{ ...boxStyle, marginBottom: 14 }}>
        <label style={labelStyle}>Modello da listino</label>
        <select
          value={modal.pianoTemplateId || ""}
          onChange={(e) => applyTemplate(e.target.value)}
          style={inputStyle}
          disabled={modal.serviziPersonalizzati}
        >
          <option value="">Nessuno — bundle in base al livello contratto sotto</option>
          {commercialPlans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
              {p.validitaMesi != null ? ` · ${formatValiditaMesiLabel(p.validitaMesi)}` : ""}
            </option>
          ))}
        </select>
        {modal.serviziPersonalizzati ? (
          <p style={{ margin: "8px 0 0", fontSize: 12, color: "#64748b" }}>
            Disattiva &quot;Personalizza servizi&quot; per cambiare modello dal listino. L’etichetta listino sotto resta
            modificabile.
          </p>
        ) : null}
        <label style={{ ...labelStyle, marginTop: 12 }}>Etichetta listino (tabella clienti / offerta)</label>
        <input
          type="text"
          value={modal.pianoCommercialeNome ?? ""}
          onChange={(e) =>
            setModal((m) => ({
              ...m,
              pianoCommercialeNome: e.target.value,
            }))
          }
          style={inputStyle}
          placeholder="Si compila scegliendo un modello; puoi adattarla a mano"
        />
        <p style={{ margin: "6px 0 0", fontSize: 12, color: "#64748b" }}>
          Resta valorizzata quando aggiungi servizi oltre al modello; svuotala solo se non serve in fattura / in elenco.
        </p>
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 14 }}>
          <input
            type="checkbox"
            checked={!!modal.serviziPersonalizzati}
            onChange={(e) => setPersonalized(e.target.checked)}
            style={{ width: 18, height: 18 }}
          />
          <span>
            <strong>Personalizza servizi</strong> per questo cliente
          </span>
        </label>
      </div>

      <div
        style={{
          ...boxStyle,
          maxHeight: 280,
          overflowY: "auto",
          marginBottom: 14,
        }}
      >
        <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 600, color: "#0f172a" }}>Catalogo servizi</p>
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {(catalogServices || []).map((s) => (
            <li
              key={s.id}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                padding: "8px 0",
                borderBottom: "1px solid #e2e8f0",
                fontSize: 14,
              }}
            >
              <input
                type="checkbox"
                checked={!!modal.inclusioni?.[s.id]}
                onChange={() => toggleServizio(s.id)}
                style={{ marginTop: 3, width: 18, height: 18, flexShrink: 0 }}
              />
              <span style={{ flex: 1, lineHeight: 1.4 }}>
                <strong>{s.nome}</strong>
                <span style={{ color: "#64748b", fontWeight: 500 }}> · {formatEuroMonth(s.prezzoMensile)}</span>
                <span style={{ display: "block", fontSize: 12, color: "#94a3b8" }}>{s.categoria}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div style={{ ...boxStyle, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
        <div style={{ flex: "1 1 200px" }}>
          <p style={{ margin: 0, fontSize: 12, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Canone stimato (somma listino)
          </p>
          <p style={{ margin: "4px 0 0", fontSize: 22, fontWeight: 800, color: "#0f172a" }}>{canoneStimato}</p>
          {mostraNetto ? (
            <p style={{ margin: "8px 0 0", fontSize: 14, fontWeight: 700, color: "#0f766e" }}>
              Stima netto mensile: {formatEuroMonth(nettoCanone)}
              <span style={{ fontWeight: 500, color: "#64748b", display: "block", marginTop: 4, fontSize: 12 }}>
                Ordine: prima sconto {pctSconto > 0 ? `${pctSconto}%` : "0%"} sul listino
                {euroFisso > 0 ? `, poi −${euroFisso} €` : ""} sul residuo.
              </span>
            </p>
          ) : promoScadutaConValori ? (
            <p style={{ margin: "6px 0 0", fontSize: 12, color: "#c0392b", fontWeight: 600 }}>
              Promozione scaduta il {new Date(modal.sconto_scadenza + "T12:00:00").toLocaleDateString("it-IT")}: il
              canone è tornato al listino pieno. Togli la scadenza (o mettine una futura) per riattivarla.
            </p>
          ) : (
            <p style={{ margin: "6px 0 0", fontSize: 12, color: "#64748b" }}>
              Imposta sconto % e/o importo fisso nella sezione Abbonamento sotto: qui vedi l’effetto sul canone stimato.
            </p>
          )}
        </div>
        <button type="button" className="sa-btn-outline" onClick={alignPianoToServizi} disabled={!canAlign}>
          Allinea livello contratto
        </button>
      </div>
    </section>
  );
}
