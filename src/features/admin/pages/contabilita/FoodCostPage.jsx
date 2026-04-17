import { useMemo, useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import AdminModuleShell from "@/features/admin/components/AdminModuleShell";
import { useTenantLocalJson, newLocalId } from "@/features/admin/hooks/useTenantLocalJson";
import { useTenant } from "@/app/contexts/TenantContext";
import {
  updateTenantSettings,
  getCategories,
  getProducts,
  getConfigurazioneCosti,
  getProductIngredientiBatch,
  foodCostCostoRicettaEuro,
} from "@/features/admin/services/adminService";

function toNum(v) {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function marginePctManuale(costoAlKg, pesoG, prezzoVendita) {
  const kg = Number(pesoG) / 1000;
  const costo = Number(costoAlKg) * kg;
  const vendita = Number(prezzoVendita);
  if (!vendita || vendita <= 0) return null;
  return ((vendita - costo) / vendita) * 100;
}

export default function FoodCostPage() {
  const { tenantId, tenantData, refreshTenant } = useTenant();
  const { data, setData, ready } = useTenantLocalJson("contabilita_foodcost", { righe: [] });
  const [ingrediente, setIngrediente] = useState("");
  const [costoAlKg, setCostoAlKg] = useState("");
  const [pesoTeoricoG, setPesoTeoricoG] = useState("");
  const [prezzoVendita, setPrezzoVendita] = useState("");
  const [note, setNote] = useState("");
  const [margineDraft, setMargineDraft] = useState("");
  const [margineSaving, setMargineSaving] = useState(false);

  const [menuLoading, setMenuLoading] = useState(false);
  const [menuError, setMenuError] = useState(null);
  const [menuRows, setMenuRows] = useState([]);

  const righeManuali = useMemo(() => data.righe || [], [data.righe]);

  useEffect(() => {
    const raw = tenantData?.parametri_operativi?.foodcost_margine_percent;
    if (raw === undefined || raw === null || raw === "") {
      setMargineDraft("");
      return;
    }
    setMargineDraft(String(raw));
  }, [tenantData?.parametri_operativi?.foodcost_margine_percent]);

  const loadMenuProducts = useCallback(async () => {
    if (!tenantId) return;
    setMenuLoading(true);
    setMenuError(null);
    try {
      const [categories, products, config] = await Promise.all([
        getCategories(tenantId),
        getProducts(tenantId),
        getConfigurazioneCosti(tenantId),
      ]);
      const costoImpasto = toNum(config?.costo_impasto ?? config?.costoImpasto);
      const catById = Object.fromEntries((categories || []).map((c) => [c.id, c]));
      const attivi = (products || []).filter((p) => p.attivo !== false);
      const ids = attivi.map((p) => p.id).filter(Boolean);
      const ingByProduct = ids.length ? await getProductIngredientiBatch(tenantId, ids) : {};

      const sorted = [...attivi].sort((a, b) => {
        const ca = catById[a.categoria_id || a.categoriaId];
        const cb = catById[b.categoria_id || b.categoriaId];
        const oa = Number(ca?.ordine) || 0;
        const ob = Number(cb?.ordine) || 0;
        if (oa !== ob) return oa - ob;
        return (a.nome || "").localeCompare(b.nome || "", "it");
      });

      const rows = sorted.map((p) => {
        const cid = p.categoria_id || p.categoriaId;
        const cat = cid ? catById[cid] : null;
        const slug = cat?.slug || "";
        const ings = ingByProduct[p.id] || [];
        const costoRicetta = foodCostCostoRicettaEuro(slug, costoImpasto, ings);
        const prezzo = toNum(p.prezzo);
        let margine = null;
        if (prezzo > 0 && costoRicetta > 0) {
          margine = ((prezzo - costoRicetta) / prezzo) * 100;
        }
        return {
          id: p.id,
          categoriaNome: cat?.nome || "—",
          nome: p.nome || "—",
          costoRicetta,
          prezzo,
          margine,
        };
      });
      setMenuRows(rows);
    } catch (e) {
      console.error(e);
      setMenuError(e?.message || "Caricamento listino non riuscito.");
      setMenuRows([]);
    } finally {
      setMenuLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    if (!tenantId || !ready) return;
    void loadMenuProducts();
  }, [tenantId, ready, loadMenuProducts]);

  const saveMargineTarget = useCallback(async () => {
    if (!tenantId || !tenantData) return;
    const n =
      margineDraft === "" ? 0 : Math.min(95, Math.max(0, Number(String(margineDraft).replace(",", ".")) || 0));
    setMargineSaving(true);
    try {
      const parametri_operativi = {
        ...(tenantData.parametri_operativi && typeof tenantData.parametri_operativi === "object"
          ? tenantData.parametri_operativi
          : {}),
        foodcost_margine_percent: n,
      };
      await updateTenantSettings(tenantId, { parametri_operativi });
      await refreshTenant();
      setMargineDraft(String(n));
      alert("Margine target salvato.");
    } catch (err) {
      console.error(err);
      alert(err?.message || "Salvataggio non riuscito.");
    } finally {
      setMargineSaving(false);
    }
  }, [tenantId, tenantData, margineDraft, refreshTenant]);

  if (!ready) {
    return <p className="text-gray-400 text-sm">Caricamento…</p>;
  }

  function addManuale() {
    if (!ingrediente.trim()) return;
    const row = {
      id: newLocalId(),
      ingrediente: ingrediente.trim(),
      costoAlKg: Number(costoAlKg) || 0,
      pesoTeoricoG: Number(pesoTeoricoG) || 0,
      prezzoVendita: Number(prezzoVendita) || 0,
      note: note.trim(),
    };
    setData((d) => ({ ...d, righe: [row, ...(d.righe || [])] }));
    setIngrediente("");
    setCostoAlKg("");
    setPesoTeoricoG("");
    setPrezzoVendita("");
    setNote("");
  }

  function removeManuale(id) {
    setData((d) => ({ ...d, righe: (d.righe || []).filter((r) => r.id !== id) }));
  }

  return (
    <AdminModuleShell
      title="Food cost"
      lead="Elenco automatico da tutte le categorie del menù (pizze, fritti, dolci, bibite, …): costo ricetta stimato da impasto + ingredienti e confronto con il prezzo listino. Sotto puoi aggiungere analisi manuali per singolo ingrediente."
      specTitle="Logica costo ricetta (listino)"
      specChildren={
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li>
            Per pizze e categorie «normali»: costo = <strong>costo impasto</strong> (da Impasti) + somma costi ingredienti
            associati al prodotto.
          </li>
          <li>
            Per <strong>fritti, dolci e bibite</strong>: si usano solo i costi ingredienti se presenti; il costo impasto non
            viene sommato (come nel ricalcolo listino pizze).
          </li>
          <li>
            Margine % = (prezzo listino − costo ricetta) / prezzo listino. Se il costo ricetta è 0 (nessun dato), il margine
            non è calcolato.
          </li>
        </ul>
      }
    >
      <div
        style={{
          marginBottom: 24,
          padding: "14px 16px",
          borderRadius: 10,
          border: "1px solid #e2e8f0",
          background: "#f8fafc",
          maxWidth: 420,
        }}
      >
        <label style={{ fontSize: 13, fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 }}>
          Food cost — margine target (% guadagno)
        </label>
        <p style={{ margin: "0 0 10px", fontSize: 12, color: "#64748b", lineHeight: 1.45 }}>
          Usato per ricalcoli listino e controlli in cassa. Prezzo target = costo totale / (1 − margine%). Esempio: margine
          30% su costo 5,00 € → prezzo 7,14 €.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          <input
            type="number"
            min={0}
            max={95}
            placeholder="es. 30"
            value={margineDraft}
            onChange={(e) => setMargineDraft(e.target.value)}
            disabled={!tenantId || !tenantData || margineSaving}
            style={{ padding: "8px 10px", width: 120, borderRadius: 6, border: "1px solid #cbd5e1" }}
            aria-label="Margine target percentuale food cost"
          />
          <button
            type="button"
            className="btn-primary-dashboard"
            disabled={!tenantId || !tenantData || margineSaving}
            onClick={() => void saveMargineTarget()}
          >
            {margineSaving ? "Salvataggio…" : "Salva margine"}
          </button>
        </div>
        <p style={{ margin: "10px 0 0", fontSize: 12, color: "#64748b" }}>
          Altri parametri operativi restano in{" "}
          <Link to="/admin/settings/parametri" style={{ fontWeight: 600 }}>
            Impostazioni → Parametri
          </Link>
          .
        </p>
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 16, color: "#0f172a" }}>Prodotti dal menù</h2>
        <button
          type="button"
          className="dashboard-settings-btn-secondary"
          disabled={!tenantId || menuLoading}
          onClick={() => void loadMenuProducts()}
        >
          {menuLoading ? "Aggiornamento…" : "Aggiorna da menù"}
        </button>
      </div>
      {menuError ? (
        <p style={{ color: "#b91c1c", fontSize: 14, marginBottom: 12 }}>{menuError}</p>
      ) : null}
      {menuLoading && menuRows.length === 0 ? (
        <p style={{ padding: 16, color: "#64748b", fontSize: 14 }}>Caricamento prodotti…</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, marginBottom: 32 }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "2px solid #e2e8f0", color: "#64748b" }}>
              <th style={{ padding: "10px 8px" }}>Categoria</th>
              <th style={{ padding: "10px 8px" }}>Prodotto</th>
              <th style={{ padding: "10px 8px" }}>Costo ricetta €</th>
              <th style={{ padding: "10px 8px" }}>Prezzo listino €</th>
              <th style={{ padding: "10px 8px" }}>Margine %</th>
            </tr>
          </thead>
          <tbody>
            {menuRows.map((r) => (
              <tr key={r.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: "10px 8px", color: "#475569" }}>{r.categoriaNome}</td>
                <td style={{ padding: "10px 8px", fontWeight: 600 }}>{r.nome}</td>
                <td style={{ padding: "10px 8px" }}>€ {r.costoRicetta.toFixed(2)}</td>
                <td style={{ padding: "10px 8px" }}>€ {r.prezzo.toFixed(2)}</td>
                <td
                  style={{
                    padding: "10px 8px",
                    fontWeight: r.margine != null && r.margine < 0 ? 600 : 400,
                    color: r.margine != null && r.margine < 0 ? "#b91c1c" : "#0f172a",
                  }}
                >
                  {r.margine == null ? "—" : `${r.margine.toFixed(1)} %`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {!menuLoading && menuRows.length === 0 && !menuError ? (
        <p style={{ padding: "0 0 24px", color: "#94a3b8", fontSize: 14 }}>Nessun prodotto attivo nel menù.</p>
      ) : null}

      <h2 style={{ fontSize: 16, marginBottom: 12, color: "#0f172a" }}>Analisi manuale per ingrediente (facoltativo)</h2>
      <p style={{ margin: "0 0 16px", fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>
        Righe salvate in questo browser (€/kg e peso teorico). Utile per simulazioni non legate a una voce di menù.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
          gap: 10,
          marginBottom: 20,
          alignItems: "end",
        }}
      >
        <div style={{ gridColumn: "span 2" }}>
          <label style={{ fontSize: 12, color: "#64748b" }}>Ingrediente / voce</label>
          <input
            value={ingrediente}
            onChange={(e) => setIngrediente(e.target.value)}
            style={{ width: "100%", marginTop: 4, padding: 8, borderRadius: 6, border: "1px solid #cbd5e1" }}
          />
        </div>
        <div>
          <label style={{ fontSize: 12, color: "#64748b" }}>Costo €/kg</label>
          <input
            type="number"
            step="0.01"
            value={costoAlKg}
            onChange={(e) => setCostoAlKg(e.target.value)}
            style={{ width: "100%", marginTop: 4, padding: 8, borderRadius: 6, border: "1px solid #cbd5e1" }}
          />
        </div>
        <div>
          <label style={{ fontSize: 12, color: "#64748b" }}>Peso teorico (g)</label>
          <input
            type="number"
            step="0.1"
            value={pesoTeoricoG}
            onChange={(e) => setPesoTeoricoG(e.target.value)}
            style={{ width: "100%", marginTop: 4, padding: 8, borderRadius: 6, border: "1px solid #cbd5e1" }}
          />
        </div>
        <div>
          <label style={{ fontSize: 12, color: "#64748b" }}>Prezzo vendita €</label>
          <input
            type="number"
            step="0.01"
            value={prezzoVendita}
            onChange={(e) => setPrezzoVendita(e.target.value)}
            style={{ width: "100%", marginTop: 4, padding: 8, borderRadius: 6, border: "1px solid #cbd5e1" }}
          />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={{ fontSize: 12, color: "#64748b" }}>Note</label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            style={{ width: "100%", marginTop: 4, padding: 8, borderRadius: 6, border: "1px solid #cbd5e1" }}
          />
        </div>
        <button type="button" className="btn-primary" onClick={addManuale}>
          Aggiungi riga manuale
        </button>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "2px solid #e2e8f0", color: "#64748b" }}>
            <th style={{ padding: "10px 8px" }}>Voce</th>
            <th style={{ padding: "10px 8px" }}>€/kg</th>
            <th style={{ padding: "10px 8px" }}>g teorici</th>
            <th style={{ padding: "10px 8px" }}>Costo teorico</th>
            <th style={{ padding: "10px 8px" }}>Prezzo vendita</th>
            <th style={{ padding: "10px 8px" }}>Margine %</th>
            <th style={{ padding: "10px 8px" }} />
          </tr>
        </thead>
        <tbody>
          {righeManuali.map((r) => {
            const kg = r.pesoTeoricoG / 1000;
            const costoTeo = r.costoAlKg * kg;
            const m = marginePctManuale(r.costoAlKg, r.pesoTeoricoG, r.prezzoVendita);
            return (
              <tr key={r.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: "10px 8px", fontWeight: 600 }}>{r.ingrediente}</td>
                <td style={{ padding: "10px 8px" }}>€ {r.costoAlKg.toFixed(2)}</td>
                <td style={{ padding: "10px 8px" }}>{r.pesoTeoricoG}</td>
                <td style={{ padding: "10px 8px" }}>€ {costoTeo.toFixed(2)}</td>
                <td style={{ padding: "10px 8px" }}>€ {r.prezzoVendita.toFixed(2)}</td>
                <td style={{ padding: "10px 8px", fontWeight: m != null && m < 0 ? 600 : 400, color: m != null && m < 0 ? "#b91c1c" : "#0f172a" }}>
                  {m == null ? "—" : `${m.toFixed(1)} %`}
                </td>
                <td style={{ padding: "10px 8px" }}>
                  <button
                    type="button"
                    style={{ color: "#b91c1c", border: "none", background: "none", cursor: "pointer" }}
                    onClick={() => removeManuale(r.id)}
                  >
                    Elimina
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {righeManuali.length === 0 ? (
        <p style={{ padding: 16, color: "#94a3b8", fontSize: 14 }}>Nessuna riga manuale.</p>
      ) : null}
    </AdminModuleShell>
  );
}
