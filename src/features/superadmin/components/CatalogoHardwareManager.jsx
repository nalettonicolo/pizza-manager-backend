import { useState } from "react";
import {
  createAttrezzaturaCatalogo,
  updateAttrezzaturaCatalogo,
} from "@/features/superadmin/services/noleggiAttrezzatureService";
import { formatEuroMonth } from "@/features/superadmin/catalog/servicesStorage";

export const CATEGORIE_ATTREZZATURA = ["tablet", "pc", "stampante", "pos", "router", "lettore_barcode", "kit_completo", "altro"];

const inputStyle = {
  width: "100%",
  padding: "8px 10px",
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  boxSizing: "border-box",
  fontSize: 14,
};
const labelStyle = { display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4, color: "#475569" };

function formatEuro(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  return new Intl.NumberFormat("it-IT", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(v);
}

/**
 * Margine interno PizzaManager (mai mostrato al tenant): sulla vendita è un importo secco
 * (prezzo vendita − costo acquisto); sul noleggio non esiste un "margine" a importo fisso, ma
 * un tempo di rientro dell'investimento (mesi di canone per ripagare il costo di acquisto) —
 * indicatori diversi perché il flusso di cassa è diverso (una tantum vs ricorrente).
 */
function calcolaMargine(item) {
  const costo = Number(item.costo_acquisto) || 0;
  if (!(costo > 0)) return null;
  const vendita = Number(item.prezzo_vendita) || 0;
  const noleggio = Number(item.canone_noleggio_mensile) || 0;
  const parti = [];
  if (vendita > 0) {
    const margine = vendita - costo;
    parti.push(`vendita: margine € ${formatEuro(margine)} (${((margine / vendita) * 100).toFixed(0)}%)`);
  }
  if (noleggio > 0) {
    const mesi = costo / noleggio;
    parti.push(`noleggio: rientro in ${mesi.toFixed(1)} mesi`);
  }
  return parti.length ? `costo acquisto € ${formatEuro(costo)} — ${parti.join(" · ")}` : `costo acquisto € ${formatEuro(costo)}`;
}

/**
 * Gestione completa del catalogo Hardware (public.attrezzature_catalogo): prezzi STANDARD di
 * noleggio e/o vendita, mai da reinserire a mano in fase di preventivo — richiesta esplicita
 * dell'utente. Componente condiviso tra la pagina dedicata "Catalogo Hardware" (voce di menu
 * Commerciale) e la sezione compatta dentro "Preventivi e contratti", per non duplicare la
 * logica di creazione/modifica prezzi in due punti che potrebbero divergere.
 *
 * @param {object} props
 * @param {Array<object>} props.catalogo - righe attrezzature_catalogo già caricate dal chiamante
 * @param {() => void | Promise<void>} props.onReload - ricarica il catalogo dopo una modifica
 */
export default function CatalogoHardwareManager({ catalogo, onReload }) {
  const [error, setError] = useState(null);

  const [nuovaAttrezzatura, setNuovaAttrezzatura] = useState({
    nome: "",
    categoria: "tablet",
    canone_noleggio_mensile: "",
    prezzo_vendita: "",
    costo_acquisto: "",
    cauzione: "",
    descrizione: "",
  });
  const [savingAttrezzatura, setSavingAttrezzatura] = useState(false);

  const [editingCatalogoId, setEditingCatalogoId] = useState(null);
  const [catalogoDraft, setCatalogoDraft] = useState({ canone_noleggio_mensile: "", prezzo_vendita: "", costo_acquisto: "", cauzione: "" });
  const [savingCatalogoDraft, setSavingCatalogoDraft] = useState(false);

  async function handleAggiungiAttrezzaturaCatalogo() {
    const nome = nuovaAttrezzatura.nome.trim();
    const canone = nuovaAttrezzatura.canone_noleggio_mensile !== "" ? Number(nuovaAttrezzatura.canone_noleggio_mensile) : 0;
    const vendita = nuovaAttrezzatura.prezzo_vendita !== "" ? Number(nuovaAttrezzatura.prezzo_vendita) : 0;
    if (!nome) {
      setError("Il nome è obbligatorio.");
      return;
    }
    if (!(canone > 0) && !(vendita > 0)) {
      setError("Imposta almeno un prezzo standard: canone di noleggio o prezzo di vendita.");
      return;
    }
    setSavingAttrezzatura(true);
    setError(null);
    try {
      await createAttrezzaturaCatalogo({
        nome,
        categoria: nuovaAttrezzatura.categoria,
        canone_noleggio_mensile: canone,
        prezzo_vendita: vendita || null,
        costo_acquisto: nuovaAttrezzatura.costo_acquisto !== "" ? Number(nuovaAttrezzatura.costo_acquisto) : null,
        cauzione: nuovaAttrezzatura.cauzione !== "" ? Number(nuovaAttrezzatura.cauzione) : 0,
        descrizione: nuovaAttrezzatura.descrizione.trim() || null,
        disponibile: true,
      });
      setNuovaAttrezzatura({ nome: "", categoria: "tablet", canone_noleggio_mensile: "", prezzo_vendita: "", costo_acquisto: "", cauzione: "", descrizione: "" });
      await onReload();
    } catch (err) {
      setError(err?.message || "Impossibile aggiungere il prodotto al catalogo.");
    } finally {
      setSavingAttrezzatura(false);
    }
  }

  async function handleToggleDisponibileCatalogo(item) {
    try {
      await updateAttrezzaturaCatalogo(item.id, { disponibile: !item.disponibile });
      await onReload();
    } catch (err) {
      setError(err?.message || "Operazione non riuscita.");
    }
  }

  function iniziaModificaPrezzi(item) {
    setEditingCatalogoId(item.id);
    setCatalogoDraft({
      canone_noleggio_mensile: item.canone_noleggio_mensile != null ? String(item.canone_noleggio_mensile) : "",
      prezzo_vendita: item.prezzo_vendita != null ? String(item.prezzo_vendita) : "",
      costo_acquisto: item.costo_acquisto != null ? String(item.costo_acquisto) : "",
      cauzione: item.cauzione != null ? String(item.cauzione) : "",
    });
  }

  async function handleSalvaPrezziCatalogo(item) {
    setSavingCatalogoDraft(true);
    setError(null);
    try {
      await updateAttrezzaturaCatalogo(item.id, {
        canone_noleggio_mensile: catalogoDraft.canone_noleggio_mensile !== "" ? Number(catalogoDraft.canone_noleggio_mensile) : 0,
        prezzo_vendita: catalogoDraft.prezzo_vendita !== "" ? Number(catalogoDraft.prezzo_vendita) : null,
        costo_acquisto: catalogoDraft.costo_acquisto !== "" ? Number(catalogoDraft.costo_acquisto) : null,
        cauzione: catalogoDraft.cauzione !== "" ? Number(catalogoDraft.cauzione) : 0,
      });
      setEditingCatalogoId(null);
      await onReload();
    } catch (err) {
      setError(err?.message || "Impossibile aggiornare i prezzi.");
    } finally {
      setSavingCatalogoDraft(false);
    }
  }

  return (
    <div>
      <p style={{ fontSize: 12.5, color: "#64748b", margin: "0 0 12px" }}>
        Prezzi standard, non modificabili in fase di preventivo: scegli qui una volta per tutte quanto costa ogni
        prodotto a noleggio e/o in vendita — poi in un preventivo si sceglie solo prodotto, modalità e quantità. Il
        <strong> costo di acquisto</strong> è per il tuo margine interno: non compare mai in contratti/preventivi del
        cliente.
      </p>

      {error ? <div className="dashboard-error" style={{ marginBottom: 12 }}>{error}</div> : null}

      {catalogo.length === 0 ? (
        <p style={{ fontSize: 13, color: "#64748b" }}>Catalogo vuoto: aggiungi il primo prodotto qui sotto.</p>
      ) : (
        <ul style={{ margin: "0 0 14px", padding: 0, listStyle: "none" }}>
          {catalogo.map((a) =>
            editingCatalogoId === a.id ? (
              <li key={a.id} style={{ padding: "10px 0", borderBottom: "1px solid #e2e8f0" }}>
                <p style={{ margin: "0 0 8px", fontSize: 13.5, fontWeight: 700 }}>{a.nome} ({a.categoria})</p>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
                  <div style={{ width: 140 }}>
                    <label style={labelStyle}>Noleggio (€/mese)</label>
                    <input type="number" step="0.01" value={catalogoDraft.canone_noleggio_mensile} onChange={(e) => setCatalogoDraft((d) => ({ ...d, canone_noleggio_mensile: e.target.value }))} style={inputStyle} />
                  </div>
                  <div style={{ width: 140 }}>
                    <label style={labelStyle}>Vendita (€)</label>
                    <input type="number" step="0.01" value={catalogoDraft.prezzo_vendita} onChange={(e) => setCatalogoDraft((d) => ({ ...d, prezzo_vendita: e.target.value }))} style={inputStyle} />
                  </div>
                  <div style={{ width: 130 }}>
                    <label style={labelStyle}>Cauzione (€)</label>
                    <input type="number" step="0.01" value={catalogoDraft.cauzione} onChange={(e) => setCatalogoDraft((d) => ({ ...d, cauzione: e.target.value }))} style={inputStyle} />
                  </div>
                  <div style={{ width: 150 }}>
                    <label style={labelStyle}>Costo acquisto (€, interno)</label>
                    <input type="number" step="0.01" value={catalogoDraft.costo_acquisto} onChange={(e) => setCatalogoDraft((d) => ({ ...d, costo_acquisto: e.target.value }))} style={inputStyle} placeholder="quanto paghi tu al fornitore" />
                  </div>
                  <button type="button" className="btn-primary-dashboard" disabled={savingCatalogoDraft} onClick={() => handleSalvaPrezziCatalogo(a)}>
                    {savingCatalogoDraft ? "Salvo…" : "Salva prezzi"}
                  </button>
                  <button type="button" onClick={() => setEditingCatalogoId(null)} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 13 }}>
                    Annulla
                  </button>
                </div>
              </li>
            ) : (
              <li key={a.id} style={{ padding: "8px 0", borderBottom: "1px solid #e2e8f0", fontSize: 13.5, opacity: a.disponibile ? 1 : 0.5 }}>
                <strong>{a.nome}</strong> ({a.categoria}) —{" "}
                {Number(a.canone_noleggio_mensile) > 0 ? `noleggio ${formatEuroMonth(Number(a.canone_noleggio_mensile))}` : "noleggio n/d"}
                {" · "}
                {Number(a.prezzo_vendita) > 0 ? `vendita € ${formatEuro(a.prezzo_vendita)}` : "vendita n/d"}
                {Number(a.cauzione) > 0 ? `, cauzione € ${formatEuro(a.cauzione)}` : ""}
                {calcolaMargine(a) ? (
                  <span style={{ display: "block", fontSize: 12, color: "#0369a1", marginTop: 2 }}>
                    {calcolaMargine(a)}
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => iniziaModificaPrezzi(a)}
                  style={{ marginLeft: 10, background: "none", border: "none", color: "#0f172a", cursor: "pointer", fontSize: 12.5, textDecoration: "underline" }}
                >
                  Modifica prezzi
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleDisponibileCatalogo(a)}
                  style={{ marginLeft: 10, background: "none", border: "none", color: "#962d22", cursor: "pointer", fontSize: 12.5, textDecoration: "underline" }}
                >
                  {a.disponibile ? "Rendi non disponibile" : "Rendi disponibile"}
                </button>
              </li>
            ),
          )}
        </ul>
      )}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", borderTop: "1px solid #e2e8f0", paddingTop: 14 }}>
        <div style={{ minWidth: 160 }}>
          <label style={labelStyle}>Nome</label>
          <input type="text" value={nuovaAttrezzatura.nome} onChange={(e) => setNuovaAttrezzatura((n) => ({ ...n, nome: e.target.value }))} style={inputStyle} placeholder="es. Tablet Samsung 10&quot;" />
        </div>
        <div style={{ width: 150 }}>
          <label style={labelStyle}>Categoria</label>
          <select value={nuovaAttrezzatura.categoria} onChange={(e) => setNuovaAttrezzatura((n) => ({ ...n, categoria: e.target.value }))} style={inputStyle}>
            {CATEGORIE_ATTREZZATURA.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div style={{ width: 140 }}>
          <label style={labelStyle}>Noleggio (€/mese)</label>
          <input type="number" step="0.01" value={nuovaAttrezzatura.canone_noleggio_mensile} onChange={(e) => setNuovaAttrezzatura((n) => ({ ...n, canone_noleggio_mensile: e.target.value }))} style={inputStyle} placeholder="0 = non disponibile" />
        </div>
        <div style={{ width: 140 }}>
          <label style={labelStyle}>Vendita (€, una tantum)</label>
          <input type="number" step="0.01" value={nuovaAttrezzatura.prezzo_vendita} onChange={(e) => setNuovaAttrezzatura((n) => ({ ...n, prezzo_vendita: e.target.value }))} style={inputStyle} placeholder="0 = non disponibile" />
        </div>
        <div style={{ width: 130 }}>
          <label style={labelStyle}>Cauzione noleggio (€)</label>
          <input type="number" step="0.01" value={nuovaAttrezzatura.cauzione} onChange={(e) => setNuovaAttrezzatura((n) => ({ ...n, cauzione: e.target.value }))} style={inputStyle} />
        </div>
        <div style={{ width: 150 }}>
          <label style={labelStyle}>Costo acquisto (€, interno)</label>
          <input type="number" step="0.01" value={nuovaAttrezzatura.costo_acquisto} onChange={(e) => setNuovaAttrezzatura((n) => ({ ...n, costo_acquisto: e.target.value }))} style={inputStyle} placeholder="quanto paghi tu al fornitore" />
        </div>
        <div style={{ minWidth: 200 }}>
          <label style={labelStyle}>Descrizione (facoltativa)</label>
          <input type="text" value={nuovaAttrezzatura.descrizione} onChange={(e) => setNuovaAttrezzatura((n) => ({ ...n, descrizione: e.target.value }))} style={inputStyle} />
        </div>
        <button type="button" className="btn-primary-dashboard" disabled={savingAttrezzatura} onClick={handleAggiungiAttrezzaturaCatalogo}>
          {savingAttrezzatura ? "Aggiungo…" : "+ Aggiungi al catalogo"}
        </button>
      </div>
    </div>
  );
}
