import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useTenant } from "@/app/contexts/TenantContext";
import Loader from "@/components/feedback/Loader";
import ErrorState from "@/components/feedback/ErrorState";
import Modal from "@/components/dashboard/Modal";
import SearchBar from "@/components/dashboard/SearchBar";
import {
  getIngredients,
  createIngredient,
  updateIngredient,
  getAllergeni,
  getIngredienteAllergeniMap,
  setIngredienteAllergeni,
  recalculateAllPizzaPrices,
} from "@/features/admin/services/adminService";
import { formatPrice } from "@/utils/format";
import {
  INGREDIENTE_CATEGORIA_OPTIONS,
  INGREDIENTE_CATEGORIA_DEFAULT_COLOR,
  normalizeIngredienteCategoria,
  resolveIngredienteCategoriaForSelect,
  labelIngredienteCategoria,
} from "@/constants/ingredienteCategoria";

/** Ordine colonne allergeni per Formato B (foglio con spunte). Deve coincidere con GUIDA_CSV_INGREDIENTI.md */
const ALLERGENE_COLUMN_NAMES = [
  "Glutine", "Crostacei", "Uova", "Pesce", "Soia", "Latte", "Frutta a guscio",
  "Sedano", "Senape", "Sesamo", "Solfiti", "Lupini", "Molluschi",
];

/** Regola ordine uscita: 0–99 = in cottura, 100+ = a fine cottura. Stesso ordine = stessi passaggi. */
const ORDINE_USCITA_RULE = "Ordine 0–99 = in cottura, da 100 in poi = a fine cottura. Più ingredienti possono avere lo stesso ordine.";

/** Ordine 0–99 (o assente) → in cottura; da 100 → a fine cottura. */
function isOrdineInCottura(ordine) {
  const n = Number(ordine);
  if (!Number.isFinite(n)) return true;
  return n < 100;
}

function normalizeHexColor(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  const withHash = s.startsWith("#") ? s : `#${s}`;
  if (/^#[0-9a-fA-F]{6}$/.test(withHash)) return withHash.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(withHash)) {
    const h = withHash.slice(1);
    return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`.toLowerCase();
  }
  return "";
}

function textColorOnBackground(hex) {
  const h = normalizeHexColor(hex);
  if (!h) return "#1e293b";
  const r = parseInt(h.slice(1, 3), 16);
  const g = parseInt(h.slice(3, 5), 16);
  const b = parseInt(h.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.65 ? "#1e293b" : "#ffffff";
}

const LIST_BADGE_BASE = {
  display: "inline-flex",
  alignItems: "center",
  padding: "2px 10px",
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 700,
  lineHeight: 1.35,
  border: "1px solid rgba(15, 23, 42, 0.1)",
  whiteSpace: "nowrap",
};

function isAllergenChecked(val) {
  const v = (val ?? "").toString().trim().toLowerCase();
  return v === "1" || v === "x" || v === "sì" || v === "si" || v === "yes" || v === "s" || v === "✓" || v === "✔" || v === "true";
}

/** 1 / si / sì / true / x → true (come va_in_cottura e celle allergeni). */
function parsePrepCucinaCell(val) {
  return isAllergenChecked(val);
}

function headerColIndex(headerParts, name) {
  const n = String(name).toLowerCase();
  return headerParts.findIndex((h) => String(h ?? "").trim().toLowerCase() === n);
}

/** Cella attivo CSV: vuoto = non modificare in update; 0/no/false = disattivo; altrimenti attivo. */
function parseCsvAttivoCell(val) {
  const raw = (val ?? "").toString().trim().toLowerCase();
  if (raw === "") return undefined;
  if (raw === "0" || raw === "no" || raw === "false" || raw === "off") return false;
  return isAllergenChecked(val);
}

/** Select + chip per tipo cucina (affettato, fritto, …). */
function IngredienteCategoriaPicker({ value, onChange, onSuggestColor }) {
  const selectValue = resolveIngredienteCategoriaForSelect(value);
  const isKnown = INGREDIENTE_CATEGORIA_OPTIONS.some((o) => o.value === selectValue);
  const legacy = selectValue && !isKnown ? selectValue : "";

  function pick(next) {
    const v = next || "";
    onChange(v);
    if (v && onSuggestColor) {
      const hex = INGREDIENTE_CATEGORIA_DEFAULT_COLOR[v];
      if (hex) onSuggestColor(hex);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        <button
          type="button"
          className={!selectValue ? "btn-primary-dashboard" : undefined}
          onClick={() => pick("")}
          style={
            !selectValue
              ? { padding: "6px 10px", fontSize: 12 }
              : {
                  padding: "6px 10px",
                  fontSize: 12,
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: 8,
                  color: "#64748b",
                  cursor: "pointer",
                }
          }
        >
          Nessuna
        </button>
        {INGREDIENTE_CATEGORIA_OPTIONS.map((o) => {
          const active = selectValue === o.value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => pick(o.value)}
              className={active ? "btn-primary-dashboard" : undefined}
              style={
                active
                  ? { padding: "6px 10px", fontSize: 12 }
                  : {
                      padding: "6px 10px",
                      fontSize: 12,
                      background: "#fff",
                      border: "1px solid #e2e8f0",
                      borderRadius: 8,
                      color: "#334155",
                      cursor: "pointer",
                    }
              }
            >
              {o.label}
            </button>
          );
        })}
      </div>
      <select
        className="dashboard-search-input"
        value={isKnown ? selectValue : legacy ? "__legacy__" : ""}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "__legacy__") return;
          pick(v);
        }}
        aria-label="Tipo ingrediente"
        style={{ maxWidth: 280 }}
      >
        <option value="">— Seleziona tipo —</option>
        {INGREDIENTE_CATEGORIA_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
        {legacy ? (
          <option value="__legacy__" disabled>
            Altro (vecchio): {legacy}
          </option>
        ) : null}
      </select>
      <span style={{ fontSize: 11, color: "#64748b" }}>
        Valori CSV: affettato, fritto, dolce, bibita, congelato
      </span>
    </div>
  );
}

export default function IngredientiPage() {
  const { tenantId } = useTenant();
  const [ingredients, setIngredients] = useState([]);
  const [allergeni, setAllergeni] = useState([]);
  const [allergeniMap, setAllergeniMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [newNome, setNewNome] = useState("");
  const [newPrezzo, setNewPrezzo] = useState("");
  const [newCostoAbbondante, setNewCostoAbbondante] = useState("");
  const [newCostoSenza, setNewCostoSenza] = useState("");
  const [newCostoPoco, setNewCostoPoco] = useState("");
  const [newVaInCottura, setNewVaInCottura] = useState(false);
  const [newPrepCucina, setNewPrepCucina] = useState(false);
  const [newCategoria, setNewCategoria] = useState("");
  const [newColore, setNewColore] = useState("");
  const [newOrdine, setNewOrdine] = useState("");
  const [newAllergeni, setNewAllergeni] = useState([]);
  const [editIngredient, setEditIngredient] = useState(null);
  const [editNome, setEditNome] = useState("");
  const [editPrezzo, setEditPrezzo] = useState("");
  const [editCostoAbbondante, setEditCostoAbbondante] = useState("");
  const [editCostoSenza, setEditCostoSenza] = useState("");
  const [editCostoPoco, setEditCostoPoco] = useState("");
  const [editVaInCottura, setEditVaInCottura] = useState(false);
  const [editPrepCucina, setEditPrepCucina] = useState(false);
  const [editCategoria, setEditCategoria] = useState("");
  const [editColore, setEditColore] = useState("");
  const [editOrdine, setEditOrdine] = useState("");
  const [editAllergeni, setEditAllergeni] = useState([]);
  const [editAttivo, setEditAttivo] = useState(true);
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [csvImporting, setCsvImporting] = useState(false);
  const csvFileInputId = useId();
  const csvFileInputRef = useRef(null);

  const load = useCallback(async () => {
    if (!tenantId) return;
    try {
      setLoading(true);
      const [data, allergeniList, map] = await Promise.all([
        getIngredients(tenantId),
        getAllergeni(tenantId),
        getIngredienteAllergeniMap(tenantId),
      ]);
      setIngredients(data || []);
      setAllergeni(allergeniList || []);
      setAllergeniMap(map || {});
    } catch (err) {
      console.error(err);
      setError("Errore caricamento ingredienti.");
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredIngredients = useMemo(() => {
    const list = !searchTerm.trim()
      ? ingredients
      : ingredients.filter((ing) => (ing.nome || "").toLowerCase().includes(searchTerm.trim().toLowerCase()));
    return [...list].sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));
  }, [ingredients, searchTerm]);

  if (loading) return <Loader />;
  if (error) return <ErrorState message={error} />;

  /** Allergeni dell'ingrediente con icona (per mostrare icone a dx del nome) */
  const getAllergeniConIcona = (ingredienteId) => {
    const ids = allergeniMap[ingredienteId] || [];
    return ids
      .map((id) => allergeni.find((a) => a.id === id))
      .filter((a) => a && (a.icona || a.nome));
  };

  async function handleAdd() {
    if (!newNome.trim()) return;
    const payload = {
      tenantId,
      nome: newNome.trim(),
      costoUnitario: Number(newPrezzo) || 0,
      attivo: true,
    };
    if (newCostoAbbondante !== "") payload.costoAbbondante = Number(newCostoAbbondante);
    if (newCostoSenza !== "") payload.costoSenza = Number(newCostoSenza);
    if (newCostoPoco !== "") payload.costoPoco = Number(newCostoPoco);
    if (newVaInCottura) payload.vaInCottura = true;
    if (newPrepCucina) payload.prepCucina = true;
    {
      const cat = normalizeIngredienteCategoria(newCategoria);
      if (cat) payload.categoria = cat;
    }
    if (newColore.trim()) payload.colore = newColore.trim();
    if (newOrdine !== "" && !Number.isNaN(Number(newOrdine))) payload.ordine = Number(newOrdine);
    try {
      const created = await createIngredient(payload);
      if (created?.id && newAllergeni.length > 0) {
        try {
          await setIngredienteAllergeni(tenantId, created.id, newAllergeni);
        } catch (allergeniErr) {
          // ingrediente_allergeni punta a core.ingredienti, non a public."Ingrediente" → FK fallisce
          console.warn("Allergeni non salvati (tabella core.ingredienti):", allergeniErr?.message || allergeniErr);
        }
      }
      setNewNome("");
      setNewPrezzo("");
      setNewCostoAbbondante("");
      setNewCostoSenza("");
      setNewCostoPoco("");
      setNewVaInCottura(false);
      setNewPrepCucina(false);
      setNewCategoria("");
      setNewColore("");
      setNewOrdine("");
      setNewAllergeni([]);
      setModalOpen(false);
      load();
      if (tenantId) {
        try {
          await recalculateAllPizzaPrices(tenantId);
        } catch (e) {
          console.warn("Ricalcolo prezzi pizze:", e);
        }
      }
    } catch (err) {
      console.error(err)
      const isTenantFk =
        err?.code === "23503" && (err?.details?.includes("Tenant") || err?.message?.includes("tenantId_fkey"))
      const msg = isTenantFk
        ? `Il tenant del tuo account non è presente nella tabella Tenant. Aggiungi in Supabase (SQL Editor) un record nella tabella "Tenant" con id = ${tenantId}. Vedi file server/pizzeria-backend/prisma/insert_tenant_mancante.sql per un esempio.`
        : "Errore creazione ingrediente. Verifica che la tabella Ingrediente esista e abbia i permessi."
      alert(msg)
    }
  }

  function toggleNewAllergene(allergeneId) {
    setNewAllergeni((prev) =>
      prev.includes(allergeneId) ? prev.filter((id) => id !== allergeneId) : [...prev, allergeneId]
    );
  }

  async function handleToggle(ing) {
    try {
      await updateIngredient(ing.id, { attivo: !ing.attivo });
      load();
    } catch (err) {
      console.error(err);
      if (err?.code === "PGRST204" && err?.message?.includes("attivo")) {
        alert(
          "La tabella Ingrediente non ha la colonna 'attivo'. Aggiungila in Supabase (SQL Editor) eseguendo il file server/pizzeria-backend/prisma/add_attivo_ingrediente.sql"
        );
      } else {
        alert("Errore aggiornamento.");
      }
    }
  }

  function openEdit(ing) {
    setEditIngredient(ing);
    setEditNome(ing.nome ?? "");
    setEditPrezzo(String(ing.costo ?? ing.costoUnitario ?? ing.costo_unitario ?? ""));
    setEditCostoAbbondante(String(ing.costoAbbondante ?? ing.costo_abbondante ?? ""));
    setEditCostoSenza(String(ing.costoSenza ?? ing.costo_senza ?? ""));
    setEditCostoPoco(String(ing.costoPoco ?? ing.costo_poco ?? ""));
    setEditVaInCottura(ing.vaInCottura === true || ing.va_in_cottura === true);
    setEditPrepCucina(ing.prepCucina === true || ing.prep_cucina === true);
    setEditCategoria(resolveIngredienteCategoriaForSelect(ing.categoria));
    setEditColore(ing.colore != null ? String(ing.colore) : "");
    setEditOrdine(ing.ordine !== undefined && ing.ordine !== null ? String(ing.ordine) : "");
    setEditAllergeni(allergeniMap[ing.id] ? [...allergeniMap[ing.id]] : []);
    setEditAttivo(ing.attivo !== false);
  }

  function toggleEditAllergene(allergeneId) {
    setEditAllergeni((prev) =>
      prev.includes(allergeneId) ? prev.filter((id) => id !== allergeneId) : [...prev, allergeneId]
    );
  }

  async function handleSaveEdit() {
    if (!editIngredient || !editNome.trim()) return;
    try {
      const updates = {
        nome: editNome.trim(),
        costo: Number(editPrezzo) || 0,
        attivo: editAttivo,
        prepCucina: editPrepCucina,
        vaInCottura: editVaInCottura,
        categoria: normalizeIngredienteCategoria(editCategoria) || null,
        colore: editColore.trim() || null,
      };
      if (editOrdine !== "" && !Number.isNaN(Number(editOrdine))) updates.ordine = Number(editOrdine);
      if (editCostoAbbondante !== "" && !Number.isNaN(Number(editCostoAbbondante)))
        updates.costoAbbondante = Number(editCostoAbbondante);
      if (editCostoSenza !== "" && !Number.isNaN(Number(editCostoSenza))) updates.costoSenza = Number(editCostoSenza);
      if (editCostoPoco !== "" && !Number.isNaN(Number(editCostoPoco))) updates.costoPoco = Number(editCostoPoco);
      let ok = false;
      try {
        await updateIngredient(editIngredient.id, updates);
        ok = true;
      } catch (updateErr) {
        if (updateErr?.code === "PGRST204" && updateErr?.message?.includes("attivo")) {
          const rest = { ...updates };
          delete rest.attivo;
          await updateIngredient(editIngredient.id, rest);
          ok = true;
        } else throw updateErr;
      }
      if (ok) {
        try {
          await setIngredienteAllergeni(tenantId, editIngredient.id, editAllergeni);
        } catch (allergeniErr) {
          console.warn("Allergeni non aggiornati (tabella core.ingredienti):", allergeniErr?.message || allergeniErr);
        }
        setEditIngredient(null);
        load();
      }
      if (tenantId) {
        try {
          await recalculateAllPizzaPrices(tenantId);
        } catch (e) {
          console.warn("Ricalcolo prezzi pizze:", e);
        }
      }
    } catch (err) {
      console.error(err);
      alert("Errore aggiornamento ingrediente.");
    }
  }

  /**
   * Formato B: dopo i campi fissi ci sono colonne allergeni (nome = Glutine, …).
   * Con prep_cucina: …;va_in_cottura;prep_cucina;Glutine;…
   * Legacy senza prep: …;va_in_cottura;Glutine;…
   */
  function isFormatoB(headerParts) {
    if (!headerParts || headerParts.length < 8) return false;
    const allergeniNames = new Set(allergeni.map((a) => (a.nome || "").trim()));
    const h7 = (headerParts[7] || "").trim().toLowerCase();
    if (h7 === "prep_cucina") {
      if (headerParts.length < 9) return false;
      const h8 = (headerParts[8] || "").trim();
      return allergeniNames.has(h8) || ALLERGENE_COLUMN_NAMES.includes(h8);
    }
    const eighth = (headerParts[7] || "").trim();
    return allergeniNames.has(eighth) || ALLERGENE_COLUMN_NAMES.includes(eighth);
  }

  /** Indice colonna prep_cucina nell’intestazione, o -1 se assente (file legacy). */
  function prepCucinaHeaderIndex(headerParts) {
    const i = headerParts.findIndex((h) => String(h ?? "").trim().toLowerCase() === "prep_cucina");
    return i;
  }

  function handleExportCsv() {
    const sep = ";";
    const allergeniOrder = allergeni.length > 0
      ? [...allergeni].sort((a, b) => {
          const iA = ALLERGENE_COLUMN_NAMES.indexOf(a.nome || "");
          const iB = ALLERGENE_COLUMN_NAMES.indexOf(b.nome || "");
          if (iA === -1 && iB === -1) return (a.nome || "").localeCompare(b.nome || "");
          if (iA === -1) return 1;
          if (iB === -1) return -1;
          return iA - iB;
        })
      : ALLERGENE_COLUMN_NAMES.map((nome) => ({ id: null, nome }));
    const allergenCols = allergeniOrder.map((a) => (a.nome || "").trim()).filter(Boolean);
    const header = [
      "nome_ingrediente",
      "ordine",
      "costo_eur",
      "abbondante",
      "senza",
      "poco",
      "va_in_cottura",
      "prep_cucina",
      ...allergenCols,
      "categoria",
      "attivo",
    ].join(sep);
    const rows = ingredients.map((ing) => {
      const nome = (ing.nome ?? "").replace(/"/g, '""');
      const ordine = String(ing.ordine ?? 0);
      const costo = formatPrice(ing.costo ?? ing.costoUnitario ?? ing.costo_unitario, "");
      const abb = formatPrice(ing.costoAbbondante ?? ing.costo_abbondante, "");
      const senza = formatPrice(ing.costoSenza ?? ing.costo_senza, "");
      const poco = formatPrice(ing.costoPoco ?? ing.costo_poco, "");
      const vaInCottura = ing.vaInCottura === true || ing.va_in_cottura === true ? "1" : "0";
      const prepCucina = ing.prepCucina === true || ing.prep_cucina === true ? "1" : "0";
      const ids = allergeniMap[ing.id] || [];
      const allergenCells = allergenCols.map((colNome) => {
        const a = allergeni.find((x) => (x.nome || "").trim() === colNome && ids.includes(x.id));
        return a ? "1" : "";
      });
      const cat = normalizeIngredienteCategoria(ing.categoria);
      const att = ing.attivo === false ? "0" : "1";
      return [nome, ordine, costo, abb, senza, poco, vaInCottura, prepCucina, ...allergenCells, cat, att].join(sep);
    });
    const csv = [header, ...rows].join("\r\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ingredienti_export.csv";
    a.click();
    URL.revokeObjectURL(url);
    setCsvModalOpen(false);
  }

  function parseCsv(text) {
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return { headerParts: [], dataRows: [] };
    const sep = text.includes(";") ? ";" : ",";
    const headerParts = lines[0].split(sep).map((p) => p.replace(/^"|"$/g, "").trim());
    const dataRows = [];
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(sep).map((p) => p.replace(/^"|"$/g, "").trim());
      if (parts[0]) dataRows.push(parts);
    }
    return { headerParts, dataRows };
  }

  async function handleCsvFileChange(e) {
    const file = e.target.files?.[0];
    if (!file || !tenantId) return;
    e.target.value = "";
    setCsvImporting(true);
    try {
      const text = await file.text();
      const { headerParts, dataRows } = parseCsv(text);
      if (dataRows.length === 0) {
        alert("Nessuna riga dati nel file. Verifica che la prima riga sia l'intestazione e che ci siano righe con nome ingrediente.");
        setCsvImporting(false);
        return;
      }
      const formatoB = isFormatoB(headerParts);
      const prepIdx = prepCucinaHeaderIndex(headerParts);
      const catI = headerColIndex(headerParts, "categoria");
      const attI = headerColIndex(headerParts, "attivo");
      const allergenNameToId = {};
      allergeni.forEach((a) => {
        const n = (a.nome || "").trim();
        if (n) allergenNameToId[n.toLowerCase()] = a.id;
      });
      ALLERGENE_COLUMN_NAMES.forEach((nome) => {
        if (!allergenNameToId[nome.toLowerCase()]) {
          const a = allergeni.find((x) => (x.nome || "").trim().toLowerCase() === nome.toLowerCase());
          if (a) allergenNameToId[nome.toLowerCase()] = a.id;
        }
      });

      const byName = new Map();
      ingredients.forEach((ing) => {
        const k = (ing.nome || "").trim().toLowerCase();
        if (k) byName.set(k, ing);
      });

      let created = 0;
      let updated = 0;

      /** Elabora una riga: crea o aggiorna l'ingrediente + allergeni. Righe indipendenti tra
       * loro, quindi si possono processare in parallelo (a lotti) invece che una alla volta. */
      async function processRow(row) {
        const nome = (row[0] || "").trim();
        if (!nome) return null;
        const nomeKey = nome.toLowerCase();
        const ordineVal = row[1] !== "" && row[1] !== undefined ? Number(String(row[1]).replace(",", ".")) : undefined;
        const costo = Number(String(row[2]).replace(",", ".")) || 0;
        const abbondante = row[3] !== "" && row[3] !== undefined ? Number(String(row[3]).replace(",", ".")) : undefined;
        const senza = row[4] !== "" && row[4] !== undefined ? Number(String(row[4]).replace(",", ".")) : undefined;
        const poco = row[5] !== "" && row[5] !== undefined ? Number(String(row[5]).replace(",", ".")) : undefined;
        const vaInCotturaRaw = (row[6] ?? "").toString().trim().toLowerCase();
        const vaInCottura = vaInCotturaRaw === "1" || vaInCotturaRaw === "si" || vaInCotturaRaw === "sì" || vaInCotturaRaw === "true" || vaInCotturaRaw === "yes";
        const prepCucina = prepIdx >= 0 ? parsePrepCucinaCell(row[prepIdx]) : false;
        const payload = { nome, costoUnitario: costo, attivo: true };
        if (abbondante !== undefined) payload.costoAbbondante = abbondante;
        if (senza !== undefined) payload.costoSenza = senza;
        if (poco !== undefined) payload.costoPoco = poco;
        if (vaInCottura) payload.vaInCottura = true;
        if (prepCucina) payload.prepCucina = true;
        if (ordineVal !== undefined && !Number.isNaN(ordineVal)) payload.ordine = ordineVal;
        if (catI >= 0 && catI < row.length) {
          const v = normalizeIngredienteCategoria(row[catI]);
          if (v) {
            payload.categoria = v;
            // Colore non è più una colonna CSV: si deriva sempre dalla categoria (nuovo
            // ingrediente, quindi nessun colore esistente da preservare/sovrascrivere).
            const defaultHex = INGREDIENTE_CATEGORIA_DEFAULT_COLOR[v];
            if (defaultHex) payload.colore = defaultHex;
          }
        }
        if (attI >= 0 && attI < row.length) {
          const attParsed = parseCsvAttivoCell(row[attI]);
          if (attParsed !== undefined) payload.attivo = attParsed;
        }

        let allergeneIds = [];
        if (formatoB && headerParts.length > 7) {
          const startJ = prepIdx >= 0 ? prepIdx + 1 : 7;
          for (let j = startJ; j < Math.min(headerParts.length, row.length); j++) {
            const colName = (headerParts[j] || "").trim();
            const id = allergenNameToId[colName.toLowerCase()] || allergeni.find((a) => (a.nome || "").trim().toLowerCase() === colName.toLowerCase())?.id;
            if (id && isAllergenChecked(row[j])) allergeneIds.push(id);
          }
        } else {
          const allergCol = prepIdx >= 0 ? prepIdx + 1 : 7;
          const allergeniStr = row[allergCol] ?? "";
          if (allergeniStr.trim()) {
            const names = allergeniStr.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
            allergeneIds = names
              .map((name) => allergeni.find((a) => (a.nome || "").toLowerCase() === name.toLowerCase())?.id)
              .filter(Boolean);
          }
        }

        const existing = byName.get(nomeKey);
        if (existing) {
          try {
            const updates = {
              nome,
              costo: costo,
            };
            if (abbondante !== undefined) updates.costoAbbondante = abbondante;
            if (senza !== undefined) updates.costoSenza = senza;
            if (poco !== undefined) updates.costoPoco = poco;
            updates.vaInCottura = vaInCottura;
            updates.prepCucina = prepCucina;
            if (ordineVal !== undefined && !Number.isNaN(ordineVal)) updates.ordine = ordineVal;
            if (catI >= 0 && catI < row.length) {
              const raw = (row[catI] ?? "").trim();
              updates.categoria = raw.length ? normalizeIngredienteCategoria(raw) || null : null;
              // Colore non più gestito da CSV: sugli ingredienti già esistenti si lascia il
              // colore attuale (custom o già derivato) invariato — si cambia dal form (Admin →
              // Ingredienti), che suggerisce il colore categoria ma permette l'override.
            }
            if (attI >= 0 && attI < row.length) {
              const attParsed = parseCsvAttivoCell(row[attI]);
              if (attParsed !== undefined) updates.attivo = attParsed;
              else updates.attivo = existing.attivo !== false;
            } else {
              updates.attivo = existing.attivo !== false;
            }
            await updateIngredient(existing.id, updates);
            try {
              await setIngredienteAllergeni(tenantId, existing.id, allergeneIds);
            } catch {
              console.warn("Allergeni non aggiornati per", nome);
            }
            return "updated";
          } catch (err) {
            console.warn("Ingrediente non aggiornato:", nome, err?.message);
            return null;
          }
        }

        const createPayload = { tenantId, ...payload };
        try {
          const createdIng = await createIngredient(createPayload);
          if (createdIng?.id && allergeneIds.length > 0) {
            try {
              await setIngredienteAllergeni(tenantId, createdIng.id, allergeneIds);
            } catch {
              console.warn("Allergeni non salvati per", nome);
            }
          }
          return "created";
        } catch (err) {
          console.warn("Ingrediente saltato:", nome, err?.message);
          return null;
        }
      }

      // Righe indipendenti tra loro: elaborate a lotti in parallelo invece che una alla volta
      // (prima erano N await sequenziali, quindi N × latenza di rete solo per il CSV import).
      const CONCURRENCY = 6;
      for (let i = 0; i < dataRows.length; i += CONCURRENCY) {
        const batch = dataRows.slice(i, i + CONCURRENCY);
        const results = await Promise.all(batch.map((row) => processRow(row)));
        for (const r of results) {
          if (r === "created") created++;
          else if (r === "updated") updated++;
        }
      }

      setCsvModalOpen(false);
      load();
      if (tenantId) {
        try {
          await recalculateAllPizzaPrices(tenantId);
        } catch (e) {
          console.warn("Ricalcolo prezzi pizze:", e);
        }
      }
      const parts = [];
      if (updated > 0) parts.push(`${updated} aggiornati`);
      if (created > 0) parts.push(`${created} inseriti`);
      alert(parts.length ? `Import CSV: ${parts.join(", ")}.` : "Nessuna riga elaborata.");
    } catch (err) {
      console.error(err);
      alert("Errore lettura file CSV.");
    } finally {
      setCsvImporting(false);
    }
  }

  return (
    <div className="dashboard-menu-area">
      <div className="dashboard-title-row">
        <h1 className="dashboard-page-title">Ingredienti</h1>
        <SearchBar value={searchTerm} onChange={setSearchTerm} placeholder="Cerca ingredienti..." />
        <button
          type="button"
          className="btn-primary-dashboard"
          onClick={() => csvFileInputRef.current?.click()}
          disabled={csvImporting}
          style={{ marginRight: 8, opacity: csvImporting ? 0.7 : 1 }}
        >
          {csvImporting ? "Import CSV…" : "Importa CSV"}
        </button>
        <input
          ref={csvFileInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={handleCsvFileChange}
          style={{ display: "none" }}
          id={csvFileInputId}
          aria-hidden
          tabIndex={-1}
        />
        <button
          type="button"
          className="btn-primary-dashboard"
          onClick={() => setCsvModalOpen(true)}
          style={{ marginRight: 8, background: "#555" }}
        >
          Guida CSV
        </button>
        <button type="button" className="btn-primary-dashboard" onClick={() => setModalOpen(true)}>
          Inserisci
        </button>
      </div>
      <p className="dashboard-menu-intro">
        Nome, prezzo unitario, costi variante (abbondante / senza / poco), <strong>va in cottura</strong> e{" "}
        <strong>Prep. cucina</strong> (comparsa su monitor Cucina/Bancone con celle colorate — non serve se hai già impostato una{" "}
        <strong>categoria</strong>, basta quella). Opzionale: <strong>categoria</strong> (tipo: affettato, fritto, dolce, bibita, congelato — chip o
        tendina). Il <strong>colore</strong> non si imposta a mano: segue sempre la categoria scelta (personalizzabile poi dal form
        ingrediente, se serve). Ordine di uscita: 0–99 = in cottura, da 100 in poi = a fine cottura.{" "}
        <strong>Export CSV</strong> aggiunge in coda le colonne <code>categoria</code>, <code>attivo</code> così un re-import
        mantiene categoria e stato attivo/disattivo (il colore non passa da CSV). I colori di default per tipo sulla vista Cucina si
        regolano in <strong>Menu → Colori prep Cucina</strong>.
      </p>

      <Modal open={!!editIngredient} onClose={() => setEditIngredient(null)} title="Modifica ingrediente">
        <div className="dashboard-box dashboard-ingredienti-form">
          <div className="dashboard-form-row">
            <input
              type="text"
              placeholder="Nome"
              value={editNome}
              onChange={(e) => setEditNome(e.target.value)}
            />
            <input
              type="number"
              placeholder="Costo €"
              value={editPrezzo}
              onChange={(e) => setEditPrezzo(e.target.value)}
              step="0.01"
              style={{ width: 100 }}
            />
          </div>
          <div className="dashboard-form-row">
            <label>
              <span>Costo variante Abbondante €</span>
              <input
                type="number"
                placeholder="0"
                value={editCostoAbbondante}
                onChange={(e) => setEditCostoAbbondante(e.target.value)}
                step="0.01"
                style={{ width: 90 }}
              />
            </label>
            <label>
              <span>Senza €</span>
              <input
                type="number"
                placeholder="0"
                value={editCostoSenza}
                onChange={(e) => setEditCostoSenza(e.target.value)}
                step="0.01"
                style={{ width: 90 }}
              />
            </label>
            <label>
              <span>Poco €</span>
              <input
                type="number"
                placeholder="0"
                value={editCostoPoco}
                onChange={(e) => setEditCostoPoco(e.target.value)}
                step="0.01"
                style={{ width: 90 }}
              />
            </label>
          </div>
          <div className="dashboard-form-row">
            <label className="dashboard-checkbox-label">
              <input
                type="checkbox"
                checked={editVaInCottura}
                onChange={(e) => setEditVaInCottura(e.target.checked)}
              />
              Va in cottura
            </label>
            <label className="dashboard-checkbox-label" style={{ marginLeft: 16 }}>
              <input
                type="checkbox"
                checked={editPrepCucina}
                onChange={(e) => setEditPrepCucina(e.target.checked)}
              />
              Prep. cucina
            </label>
            <label className="dashboard-checkbox-label" style={{ marginLeft: 16 }}>
              <input
                type="checkbox"
                checked={editAttivo}
                onChange={(e) => setEditAttivo(e.target.checked)}
              />
              Abilitato
            </label>
            <label style={{ marginLeft: 16, display: "flex", alignItems: "center", gap: 6 }}>
              <span>Ordine di uscita</span>
              <input
                type="number"
                placeholder="0"
                value={editOrdine}
                onChange={(e) => setEditOrdine(e.target.value)}
                min={0}
                style={{ width: 70 }}
              />
            </label>
          </div>
          <p className="dashboard-form-hint" style={{ margin: "0 0 8px 0", fontSize: 12, color: "#666" }} title={ORDINE_USCITA_RULE}>
            {ORDINE_USCITA_RULE}
          </p>
          <div className="dashboard-form-row" style={{ flexWrap: "wrap", gap: 12 }}>
            <div style={{ flex: "1 1 280px", display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 500 }}>Tipo (Cucina/Bancone)</span>
              <IngredienteCategoriaPicker
                value={editCategoria}
                onChange={setEditCategoria}
                onSuggestColor={(hex) => {
                  if (!editColore.trim()) setEditColore(hex);
                }}
              />
            </div>
            <label style={{ flex: "0 1 140px", display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 500 }}>Colore #hex</span>
              <input
                type="text"
                className="dashboard-search-input"
                placeholder="#dbeafe"
                value={editColore}
                onChange={(e) => setEditColore(e.target.value)}
                maxLength={16}
              />
            </label>
          </div>
          {allergeni.length > 0 && (
            <div className="dashboard-form-row">
              <span style={{ marginRight: 8 }}>Allergeni:</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {allergeni.map((a) => (
                  <label key={a.id} className="dashboard-checkbox-label" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <input
                      type="checkbox"
                      checked={editAllergeni.includes(a.id)}
                      onChange={() => toggleEditAllergene(a.id)}
                    />
                    {a.icona && <span>{a.icona}</span>}
                    <span>{a.nome}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <button type="button" className="btn-primary-dashboard" onClick={handleSaveEdit}>
            Salva modifiche
          </button>
        </div>
      </Modal>

      <Modal open={csvModalOpen} onClose={() => setCsvModalOpen(false)} title="Formato CSV ingredienti">
        <div
          className="dashboard-box"
          style={{ display: "flex", flexDirection: "column", gap: 16, padding: 16, marginBottom: 0, overflowX: "hidden" }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={{ fontWeight: 600 }}>Import rapido</span>
            <p style={{ margin: 0, fontSize: 14, color: "#555" }}>
              Usa il pulsante <strong>Importa CSV</strong> in alto: si apre una sola finestra di selezione file.
            </p>
            <span style={{ fontWeight: 600, marginTop: 8 }}>Struttura file</span>
            <p style={{ margin: 0, fontSize: 14, color: "#555", lineHeight: 1.35 }}>
              Carica un file CSV in <strong>Formato B (foglio con spunte)</strong>. Prima riga:
            </p>
            <code
              style={{
                display: "block",
                fontSize: 12,
                color: "#334155",
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                padding: "8px 10px",
                whiteSpace: "normal",
                overflowWrap: "anywhere",
                wordBreak: "break-word",
              }}
            >
              nome_ingrediente;ordine;costo_eur;abbondante;senza;poco;va_in_cottura;prep_cucina;[allergeni];categoria;attivo
            </code>
            <p style={{ margin: 0, fontSize: 14, color: "#555", lineHeight: 1.35 }}>
              <strong>prep_cucina</strong> serve solo per ingredienti <strong>senza categoria</strong> che vanno comunque preparati
              (es. tagliati, scongelati): se imposti una <strong>categoria</strong>, l'ingrediente compare già in automatico su
              Cucina/Bancone, non serve anche prep_cucina. Entrambe opzionali: i file senza quelle colonne restano validi. Nelle celle
              allergeni usa 1, x o sì. <strong>Ordine</strong>: 0-99 = in cottura, 100+ = a fine cottura. Prezzi con 2 decimali.
              Colonna finale opzionale <strong>categoria</strong> (affettato | fritto | dolce | bibita | congelato) e{" "}
              <strong>attivo</strong> (1/0): se presenti vengono aggiornate; se assenti (file vecchi) categoria e attivo non si
              toccano. Il <strong>colore</strong> non è più una colonna CSV: segue sempre la categoria (personalizzabile dal form
              ingrediente). Sinonimi accettati in import (es. <code>bibite</code>, <code>fritti</code>, <code>surgelato</code>).
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              <button
                type="button"
                onClick={() => {
                  setCsvModalOpen(false)
                  csvFileInputRef.current?.click()
                }}
                className="btn-primary-dashboard"
                style={{ opacity: csvImporting ? 0.7 : 1, pointerEvents: csvImporting ? "none" : "auto" }}
              >
                {csvImporting ? "Caricamento..." : "Seleziona file CSV"}
              </button>
              <button
                type="button"
                className="btn-primary-dashboard"
                style={{ background: "#555" }}
                onClick={() => {
                  const header = [
                    "nome_ingrediente",
                    "ordine",
                    "costo_eur",
                    "abbondante",
                    "senza",
                    "poco",
                    "va_in_cottura",
                    "prep_cucina",
                    ...ALLERGENE_COLUMN_NAMES,
                    "categoria",
                    "attivo",
                  ].join(";");
                  const n = ALLERGENE_COLUMN_NAMES.length;
                  const tailAllerg = ";".repeat(n);
                  const examples = [
                    `Pomodoro;0;0,40;0,20;-0,40;-0,15;1;0${tailAllerg};1`,
                    `Mozzarella;0;0,80;0,25;-0,80;-0,20;0;0${";".repeat(5)}1${";".repeat(n - 6)};affettato;1`,
                    `Patate surgelate;50;0,50;0,20;-0,50;-0,10;0;1${tailAllerg};congelato;1`,
                    `Patatine fritte;80;1,20;0,40;-1,20;-0,30;0;1${tailAllerg};fritto;1`,
                  ];
                  const csv = [header, ...examples].join("\r\n");
                  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "template_ingredienti_formato_b.csv";
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                Scarica template
              </button>
            </div>
          </div>
          <div style={{ borderTop: "1px solid #eee", paddingTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={{ fontWeight: 600 }}>Esporta CSV</span>
            <p style={{ margin: 0, fontSize: 14, color: "#555" }}>
              Scarica la lista ingredienti in CSV Formato B (fino agli allergeni) più in coda <strong>categoria;attivo</strong> per
              backup completo (il colore non è più tra le colonne: segue sempre la categoria). Ordine: 0–99 in cottura, 100+ a fine cottura.
              Prezzi con 2 decimali.
            </p>
            <button type="button" className="btn-primary-dashboard" onClick={handleExportCsv}>
              Esporta CSV
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nuovo ingrediente">
        <div className="dashboard-box dashboard-ingredienti-form">
        <div className="dashboard-form-row">
          <input
            type="text"
            placeholder="Nome ingrediente"
            value={newNome}
            onChange={(e) => setNewNome(e.target.value)}
          />
          <input
            type="number"
            placeholder="Prezzo unitario €"
            value={newPrezzo}
            onChange={(e) => setNewPrezzo(e.target.value)}
            step="0.01"
            style={{ width: 120 }}
          />
        </div>
        <div className="dashboard-form-row">
          <label>
            <span>Costo variante Abbondante €</span>
            <input
              type="number"
              placeholder="0"
              value={newCostoAbbondante}
              onChange={(e) => setNewCostoAbbondante(e.target.value)}
              step="0.01"
              style={{ width: 90 }}
            />
          </label>
          <label>
            <span>Senza €</span>
            <input
              type="number"
              placeholder="0"
              value={newCostoSenza}
              onChange={(e) => setNewCostoSenza(e.target.value)}
              step="0.01"
              style={{ width: 90 }}
            />
          </label>
          <label>
            <span>Poco €</span>
            <input
              type="number"
              placeholder="0"
              value={newCostoPoco}
              onChange={(e) => setNewCostoPoco(e.target.value)}
              step="0.01"
              style={{ width: 90 }}
            />
          </label>
        </div>
        <div className="dashboard-form-row">
          <label className="dashboard-checkbox-label">
            <input
              type="checkbox"
              checked={newVaInCottura}
              onChange={(e) => setNewVaInCottura(e.target.checked)}
            />
            Va in cottura
          </label>
          <label className="dashboard-checkbox-label" style={{ marginLeft: 16 }}>
            <input
              type="checkbox"
              checked={newPrepCucina}
              onChange={(e) => setNewPrepCucina(e.target.checked)}
            />
            Prep. cucina
          </label>
          <label style={{ marginLeft: 16, display: "flex", alignItems: "center", gap: 6 }}>
            <span>Ordine di uscita</span>
            <input
              type="number"
              placeholder="0"
              value={newOrdine}
              onChange={(e) => setNewOrdine(e.target.value)}
              min={0}
              style={{ width: 70 }}
            />
          </label>
        </div>
        <p className="dashboard-form-hint" style={{ margin: "0 0 8px 0", fontSize: 12, color: "#666" }} title={ORDINE_USCITA_RULE}>
          {ORDINE_USCITA_RULE}
        </p>
        <div className="dashboard-form-row" style={{ flexWrap: "wrap", gap: 12 }}>
          <div style={{ flex: "1 1 280px", display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 500 }}>Tipo (Cucina/Bancone)</span>
            <IngredienteCategoriaPicker
              value={newCategoria}
              onChange={setNewCategoria}
              onSuggestColor={(hex) => {
                if (!newColore.trim()) setNewColore(hex);
              }}
            />
          </div>
          <label style={{ flex: "0 1 140px", display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 500 }}>Colore #hex</span>
            <input
              type="text"
              className="dashboard-search-input"
              placeholder="#dbeafe"
              value={newColore}
              onChange={(e) => setNewColore(e.target.value)}
              maxLength={16}
            />
          </label>
        </div>
        {allergeni.length > 0 && (
          <div className="dashboard-form-row">
            <span style={{ marginRight: 8 }}>Allergeni:</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {allergeni.map((a) => (
                <label key={a.id} className="dashboard-checkbox-label" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <input
                    type="checkbox"
                    checked={newAllergeni.includes(a.id)}
                    onChange={() => toggleNewAllergene(a.id)}
                  />
                  {a.icona && <span>{a.icona}</span>}
                  <span>{a.nome}</span>
                </label>
              ))}
            </div>
          </div>
        )}
        <button type="button" className="btn-primary-dashboard" onClick={handleAdd}>
            Aggiungi ingrediente
          </button>
        </div>
      </Modal>

      <ul className="dashboard-list">
        {filteredIngredients.map((ing) => {
          const allergeniConIcona = getAllergeniConIcona(ing.id);
          const inCottura = isOrdineInCottura(ing.ordine);
          const catKey = normalizeIngredienteCategoria(ing.categoria);
          const catLabel = ing.categoria ? labelIngredienteCategoria(ing.categoria) : "";
          const catBg =
            catLabel
              ? normalizeHexColor(ing.colore) ||
                INGREDIENTE_CATEGORIA_DEFAULT_COLOR[catKey] ||
                "#e2e8f0"
              : "";
          const prepCucina = ing.prepCucina === true || ing.prep_cucina === true;
          return (
            <li key={ing.id} className="dashboard-list-item">
              <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span className="dashboard-list-item-name">{ing.nome}</span>
                {allergeniConIcona.length > 0 && (
                  <span className="dashboard-list-item-allergeni" style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
                    {allergeniConIcona.map((a) => (
                      <span key={a.id} title={a.nome || ""} style={{ fontSize: "1.1em" }} aria-label={a.nome || "allergene"}>
                        {a.icona || "⚠️"}
                      </span>
                    ))}
                  </span>
                )}
              </div>
              <span
                className="dashboard-list-item-meta"
                style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}
              >
                <span>€ {formatPrice(ing.costoUnitario ?? ing.costo_unitario ?? ing.costo)}</span>
                <span
                  style={{
                    ...LIST_BADGE_BASE,
                    ...(inCottura
                      ? {
                          background: "#fff7ed",
                          color: "#9a3412",
                          borderColor: "rgba(154, 52, 18, 0.18)",
                        }
                      : {
                          background: "transparent",
                          color: "#1e40af",
                          borderColor: "rgba(30, 64, 175, 0.35)",
                          fontWeight: 600,
                        }),
                  }}
                >
                  {inCottura ? "In cottura" : "A fine cottura"}
                </span>
                {catLabel ? (
                  <span
                    style={{
                      ...LIST_BADGE_BASE,
                      background: catBg,
                      color: textColorOnBackground(catBg),
                    }}
                    title={ing.colore ? `Colore ${normalizeHexColor(ing.colore) || ing.colore}` : undefined}
                  >
                    {catLabel}
                  </span>
                ) : null}
                {prepCucina ? (
                  <span style={{ ...LIST_BADGE_BASE, background: "#f8fafc", color: "#475569", fontWeight: 600 }}>
                    Prep cucina
                  </span>
                ) : null}
              </span>
              <button type="button" className="btn-primary-dashboard" onClick={() => openEdit(ing)} style={{ marginRight: 8 }}>
                Modifica
              </button>
              <button
                type="button"
                className={ing.attivo !== false ? "dashboard-btn-active" : "dashboard-btn-inactive"}
                onClick={() => handleToggle(ing)}
              >
                {ing.attivo !== false ? "Disabilita" : "Abilita"}
              </button>
            </li>
          );
        })}
      </ul>
      {filteredIngredients.length === 0 && (
        <p className="dashboard-empty">
          {searchTerm.trim() ? "Nessun ingrediente corrisponde alla ricerca." : "Nessun ingrediente. Aggiungine uno per iniziare."}
        </p>
      )}
    </div>
  );
}
