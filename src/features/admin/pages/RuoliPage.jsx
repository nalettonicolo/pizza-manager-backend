import { useEffect, useState } from "react";
import { useTenant } from "@/app/contexts/TenantContext";
import Loader from "@/components/feedback/Loader";
import ErrorState from "@/components/feedback/ErrorState";
import Modal from "@/components/dashboard/Modal";
import { getRuoliPizzeria, updateRuoloPizzeriaPermessi } from "@/features/admin/services/adminService";

const AREE_NAV = [
  { key: "accesso_riepilogo", label: "Riepilogo" },
  { key: "accesso_cassa", label: "Cassa" },
  { key: "accesso_cucina", label: "Cucina" },
  { key: "accesso_bancone", label: "Bancone" },
  { key: "accesso_pizzaiolo", label: "Pizzaioli" },
  { key: "accesso_delivery", label: "Delivery" },
  { key: "accesso_pony", label: "Pony (stesso reparto Delivery)" },
];

function getCosaPuoFare(ruolo, puoModificareParametri) {
  const list = [];
  switch (ruolo) {
    case "admin":
      list.push("Accesso completo ad Admin (Impostazioni, Ruoli, Menù, Ordini)");
      list.push("Gestione ruoli e permessi della pizzeria");
      list.push("Configurazione parametri, orari, layout");
      break;
    case "cassa":
      list.push("Area Cassa: creare ordini, clienti, gestire carrello");
      list.push("Riepilogo ordine e conferma");
      if (puoModificareParametri) {
        list.push("Pagina Impostazioni cassa (parametri operativi)");
      } else {
        list.push("Non può modificare i parametri cassa (solo se abilitato in Ruoli)");
      }
      break;
    case "operatore":
      list.push("Accesso alle aree operative (Riepilogo, Cassa, Cucina, Bancone, Pizzaioli, Delivery)");
      break;
    case "bancone":
      list.push("Area Bancone");
      break;
    case "cucina":
      list.push("Area Cucina");
      break;
    case "pizzaiolo":
      list.push("Area Pizzaiolo");
      break;
    case "delivery":
      list.push("Area Delivery");
      break;
    default:
      list.push("Ruolo: " + (ruolo || "—"));
  }
  return list;
}

export default function RuoliPage() {
  const { tenantId } = useTenant();
  const [ruoli, setRuoli] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [detailUser, setDetailUser] = useState(null);

  async function loadRuoli() {
    if (!tenantId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await getRuoliPizzeria(tenantId);
      setRuoli(data);
    } catch (err) {
      console.error(err);
      setError("Errore nel caricamento dei ruoli.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRuoli();
  }, [tenantId]);

  async function handleToggleParametri(ruoloRecord) {
    if (!tenantId || !ruoloRecord?.user_id) return;
    try {
      await updateRuoloPizzeriaPermessi(tenantId, ruoloRecord.user_id, {
        puo_modificare_parametri: !ruoloRecord.puo_modificare_parametri,
      });
      await loadRuoli();
      if (detailUser?.user_id === ruoloRecord.user_id) {
        setDetailUser((prev) => (prev ? { ...prev, puo_modificare_parametri: !ruoloRecord.puo_modificare_parametri } : null));
      }
    } catch (err) {
      console.error(err);
      alert("Errore nell'aggiornare i permessi. " + (err?.message || ""));
    }
  }

  async function handleToggleArea(ruoloRecord, areaKey) {
    if (!tenantId || !ruoloRecord?.user_id) return;
    const current = ruoloRecord[areaKey] !== false;
    try {
      await updateRuoloPizzeriaPermessi(tenantId, ruoloRecord.user_id, { [areaKey]: !current });
      await loadRuoli();
      if (detailUser?.user_id === ruoloRecord.user_id) {
        setDetailUser((prev) => (prev ? { ...prev, [areaKey]: !current } : null));
      }
    } catch (err) {
      console.error(err);
      alert("Errore nell'aggiornare l'accesso. " + (err?.message || ""));
    }
  }

  async function handleToggleAttivo(r) {
    if (!tenantId || !r?.user_id) return;
    const nuovoAttivo = !(r.attivo !== false);
    try {
      await updateRuoloPizzeriaPermessi(tenantId, r.user_id, { attivo: nuovoAttivo });
      await loadRuoli();
      if (detailUser?.user_id === r.user_id) setDetailUser((prev) => (prev ? { ...prev, attivo: nuovoAttivo } : null));
    } catch (err) {
      console.error(err);
      alert("Errore nell'aggiornare lo stato. " + (err?.message || ""));
    }
  }

  if (loading) return <Loader />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="dashboard-settings-page">
      <h1 className="dashboard-page-title">Ruoli</h1>
      <p className="dashboard-settings-section-desc" style={{ marginBottom: 20 }}>
        Ruoli della tua pizzeria.
      </p>

      <section className="dashboard-box dashboard-settings-section">
        <h2 className="dashboard-settings-section-title">Elenco ruoli</h2>
        <p style={{ color: "#64748b", fontSize: 13, marginBottom: 12 }}>
          Qui vedi gli utenti associati alla pizzeria e il loro ruolo. Clicca sull’email per aprire il dettaglio di cosa può fare; usa l’interruttore per abilitare o disabilitare l’accesso.
        </p>
        {ruoli.length === 0 ? (
          <p style={{ color: "#64748b", fontSize: 14 }}>Nessun ruolo presente per questa pizzeria.</p>
        ) : (
          <ul className="dashboard-settings-fields" style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {ruoli.map((r) => (
              <li
                key={r.user_id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "12px 0",
                  borderBottom: "1px solid #e2e8f0",
                  gap: 16,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <button
                    type="button"
                    onClick={() => setDetailUser(r)}
                    style={{
                      background: "none",
                      border: "none",
                      padding: 0,
                      cursor: "pointer",
                      textAlign: "left",
                      font: "inherit",
                      color: "inherit",
                      width: "100%",
                    }}
                  >
                    <strong style={{ display: "block", textDecoration: "underline" }}>{r.email}</strong>
                  </button>
                  <span style={{ fontSize: 13, color: "#64748b" }}>{r.ruolo}</span>
                </div>
                <label style={{ fontSize: 13, color: "#334155", display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ whiteSpace: "nowrap" }}>Abilitato</span>
                  <input
                    type="checkbox"
                    checked={r.attivo !== false}
                    onChange={() => handleToggleAttivo(r)}
                    style={{ width: 18, height: 18, cursor: "pointer" }}
                  />
                </label>
                {r.ruolo === "cassa" && (
                  <label style={{ fontSize: 13, color: "#334155", display: "flex", alignItems: "center", gap: 6 }}>
                    <input
                      type="checkbox"
                      checked={!!r.puo_modificare_parametri}
                      onChange={() => handleToggleParametri(r)}
                    />
                    Può modificare parametri cassa
                  </label>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <Modal
        open={!!detailUser}
        onClose={() => setDetailUser(null)}
        title={detailUser ? `Cosa può fare – ${detailUser.email}` : ""}
      >
        {detailUser && (
          <div style={{ padding: "8px 0" }}>
            <p style={{ marginBottom: 12, color: "#64748b", fontSize: 14 }}>
              Ruolo: <strong style={{ color: "#334155" }}>{detailUser.ruolo}</strong>
            </p>
            <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.8, marginBottom: 16 }}>
              {getCosaPuoFare(detailUser.ruolo, detailUser.puo_modificare_parametri).map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
            <p style={{ marginBottom: 8, fontSize: 14, fontWeight: 600, color: "#334155" }}>Aree consentite</p>
            <p style={{ marginBottom: 12, fontSize: 12, color: "#64748b" }}>Abilita o disabilita le aree che questo utente può vedere e usare.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {AREE_NAV.map((area) => (
                <label key={area.key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={detailUser[area.key] !== false}
                    onChange={() => handleToggleArea(detailUser, area.key)}
                    style={{ width: 18, height: 18, cursor: "pointer" }}
                  />
                  {area.label}
                </label>
              ))}
            </div>
            {detailUser.ruolo === "cassa" && (
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, marginTop: 12, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={!!detailUser.puo_modificare_parametri}
                  onChange={() => handleToggleParametri(detailUser)}
                  style={{ width: 18, height: 18, cursor: "pointer" }}
                />
                Può modificare parametri cassa
              </label>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
