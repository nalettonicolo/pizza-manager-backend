import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useTenant } from "@/app/contexts/TenantContext";
import Loader from "@/components/feedback/Loader";
import ErrorState from "@/components/feedback/ErrorState";
import Modal from "@/components/dashboard/Modal";
import {
  getRuoliPizzeria,
  updateRuoloPizzeriaPermessi,
  listStaffPasswordNotes,
  upsertStaffPasswordNote,
  aggiungiRuoloPizzeria,
  creaAccountStaffBulk,
} from "@/features/admin/services/adminService";
import { isDefaultAreaForRole, isDedicatedRepartoRole } from "@/utils/operativeAreaAccess";
import { labelFromEmailPrefix } from "@/utils/emailDisplayLabel";
import { verifyCurrentAdminPassword } from "@/utils/adminPasswordReverify";
import {
  RUOLO_BASE_OPTIONS,
  generateStaffPassword,
  nuovaStaffRow,
  nuoveStaffRowsStandard,
} from "@/features/admin/utils/staffAccountRows";

const ARCHIVIO_PASSWORD_MS = 10 * 60 * 1000;

const AREE_NAV = [
  { key: "accesso_riepilogo", label: "Aree di lavoro" },
  { key: "accesso_cassa", label: "Cassa" },
  { key: "accesso_cucina", label: "Cucina" },
  { key: "accesso_bancone", label: "Bancone" },
  { key: "accesso_pizzaiolo", label: "Pizzaioli" },
  { key: "accesso_delivery", label: "Delivery" },
  { key: "accesso_pony", label: "Pony (stesso reparto Delivery)" },
];

const ACCESS_TO_AREA_KEY = {
  accesso_riepilogo: "riepilogo",
  accesso_cassa: "cassa",
  accesso_cucina: "cucina",
  accesso_bancone: "bancone",
  accesso_pizzaiolo: "pizzaiolo",
  accesso_delivery: "delivery",
  accesso_pony: "pony",
};

const RUOLO_BASE_VALUES = new Set(RUOLO_BASE_OPTIONS.map((o) => o.value));

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
      list.push("Solo area Cassa nel menu operativo; per più reparti usa il ruolo operatore.");
      if (puoModificareParametri) {
        list.push("Pagina Impostazioni cassa (parametri operativi)");
      } else {
        list.push("Non può modificare i parametri cassa (solo se abilitato in Ruoli)");
      }
      break;
    case "operatore":
      list.push("Di default solo «Aree di lavoro»; le altre aree si abilitano sotto «Aree consentite».");
      break;
    case "bancone":
      list.push("Area Bancone");
      list.push("Solo area Bancone; per più reparti usa il ruolo operatore.");
      break;
    case "cucina":
      list.push("Area Cucina");
      list.push("Solo area Cucina; per più reparti usa il ruolo operatore.");
      break;
    case "pizzaiolo":
      list.push("Area Pizzaiolo (schermata dedicata)");
      list.push("Solo area Pizzaioli; per più reparti usa il ruolo operatore.");
      break;
    case "delivery":
      list.push("Area Delivery");
      list.push("Solo area Delivery; per più reparti usa il ruolo operatore.");
      break;
    case "pony":
      list.push("Area Pony (stesso flusso Delivery)");
      list.push("Solo area Delivery; per più reparti usa il ruolo operatore.");
      break;
    default:
      list.push("Ruolo: " + (ruolo || "—"));
  }
  return list;
}

/** Dominio suggerito per il placeholder email (ruolo@dominio), coerente con Superadmin → Clienti. */
function emailDomainForTenant(tenantData) {
  const custom = (tenantData?.public_domain || "").trim();
  if (custom) return custom.replace(/^https?:\/\//i, "").replace(/\/.*$/, "");
  const slug = (tenantData?.slug || "").trim();
  if (slug) return `${slug}.pizzamanager.it`;
  return "ilnomedeltuolocale.it";
}

export default function RuoliPage() {
  const { tenantId, tenantData } = useTenant();
  const [ruoli, setRuoli] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [detailUser, setDetailUser] = useState(null);
  /** Dopo verifica password titolare: timestamp scadenza visualizzazione note. */
  const [archivioUnlockUntil, setArchivioUnlockUntil] = useState(0);
  const [noteByUserId, setNoteByUserId] = useState({});
  const [reauthOpen, setReauthOpen] = useState(false);
  const [reauthPassword, setReauthPassword] = useState("");
  const [reauthBusy, setReauthBusy] = useState(false);
  const [reauthError, setReauthError] = useState(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteSaveBusy, setNoteSaveBusy] = useState(false);
  const [roleBusyUserId, setRoleBusyUserId] = useState(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRuolo, setInviteRuolo] = useState("cassa");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [staffModalOpen, setStaffModalOpen] = useState(false);
  const [staffRows, setStaffRows] = useState([]);
  const [staffBusy, setStaffBusy] = useState(false);
  const [staffResults, setStaffResults] = useState(null);

  const archivioSbloccato = typeof archivioUnlockUntil === "number" && Date.now() < archivioUnlockUntil;

  const chiudiArchivio = useCallback(() => {
    setArchivioUnlockUntil(0);
    setNoteByUserId({});
  }, []);

  useEffect(() => {
    if (!archivioUnlockUntil || Date.now() >= archivioUnlockUntil) return undefined;
    const ms = archivioUnlockUntil - Date.now();
    const id = window.setTimeout(() => {
      chiudiArchivio();
    }, Math.max(ms, 0));
    return () => window.clearTimeout(id);
  }, [archivioUnlockUntil, chiudiArchivio]);

  const loadRuoli = useCallback(async () => {
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
  }, [tenantId]);

  useEffect(() => {
    void loadRuoli();
  }, [loadRuoli]);

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
    if (isDedicatedRepartoRole(ruoloRecord.ruolo)) return;
    const ak = ACCESS_TO_AREA_KEY[areaKey];
    if (ak && isDefaultAreaForRole(ruoloRecord.ruolo, ak)) return;
    const current = ruoloRecord[areaKey] === true;
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

  useEffect(() => {
    if (!detailUser || !tenantId) {
      setNoteDraft("");
      return;
    }
    if (archivioSbloccato && Object.prototype.hasOwnProperty.call(noteByUserId, detailUser.user_id)) {
      setNoteDraft(noteByUserId[detailUser.user_id] ?? "");
      return;
    }
    setNoteDraft("");
  }, [detailUser, tenantId, archivioSbloccato, noteByUserId]);

  async function apriReauthMostraNote() {
    setReauthError(null);
    setReauthPassword("");
    setReauthOpen(true);
  }

  async function confermaReauth() {
    if (!tenantId) return;
    setReauthBusy(true);
    setReauthError(null);
    try {
      const v = await verifyCurrentAdminPassword(reauthPassword);
      if (!v.ok) {
        setReauthError(v.message || "Verifica non riuscita.");
        return;
      }
      const rows = await listStaffPasswordNotes(tenantId, reauthPassword);
      const map = {};
      for (const row of rows) {
        map[row.user_id] = row.password_nota ?? "";
      }
      if ((ruoli?.length || 0) > 0 && Object.keys(map).length === 0) {
        setReauthError(
          "Nessuna password archivio leggibile con questo account. Usa Super Admin → Clienti → Archivio password, oppure un admin del locale. (Le note non sono cancellate sul server.)",
        );
        return;
      }
      setNoteByUserId(map);
      setArchivioUnlockUntil(Date.now() + ARCHIVIO_PASSWORD_MS);
      setReauthOpen(false);
      setReauthPassword("");
    } catch (err) {
      console.error(err);
      setReauthError(err?.message || "Impossibile caricare le note.");
    } finally {
      setReauthBusy(false);
    }
  }

  async function salvaNotaPasswordDettaglio() {
    if (!tenantId || !detailUser?.user_id) return;
    setNoteSaveBusy(true);
    try {
      await upsertStaffPasswordNote(tenantId, detailUser.user_id, noteDraft);
      setNoteByUserId((prev) => ({
        ...prev,
        [detailUser.user_id]: noteDraft.trim(),
      }));
      alert(noteDraft.trim() ? "Nota salvata." : "Nota rimossa.");
    } catch (err) {
      console.error(err);
      alert(err?.message || "Salvataggio non riuscito.");
    } finally {
      setNoteSaveBusy(false);
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

  async function handleInviteStaff(e) {
    e.preventDefault();
    if (!tenantId) return;
    const email = inviteEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      alert("Inserisci un’email valida.");
      return;
    }
    setInviteBusy(true);
    try {
      await aggiungiRuoloPizzeria(tenantId, email, inviteRuolo);
      setInviteEmail("");
      await loadRuoli();
      alert("Richiesta inviata. Se l’utente esiste in Auth, risulta collegato al locale.");
    } catch (err) {
      console.error(err);
      alert(err?.message || "Collegamento non riuscito. Verifica che l’utente esista in Supabase Auth o la RPC del progetto.");
    } finally {
      setInviteBusy(false);
    }
  }

  function apriStaffModal() {
    setStaffRows(nuoveStaffRowsStandard(ruoli));
    setStaffResults(null);
    setStaffModalOpen(true);
  }

  function selezionaTutteStaffRow(selezionata) {
    setStaffRows((rows) => rows.map((r) => ({ ...r, selezionata })));
  }

  function chiudiStaffModal() {
    if (staffBusy) return;
    setStaffModalOpen(false);
  }

  function updateStaffRow(id, patch) {
    setStaffRows((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function rigeneraStaffPassword(id) {
    updateStaffRow(id, { password: generateStaffPassword() });
  }

  function aggiungiStaffRow() {
    setStaffRows((rows) => [...rows, nuovaStaffRow("cassa")]);
  }

  function rimuoviStaffRow(id) {
    setStaffRows((rows) => rows.filter((r) => r.id !== id));
  }

  async function handleCreaStaffBulk() {
    if (!tenantId) return;
    const daInviare = staffRows.filter((r) => r.selezionata && r.email.trim());
    if (daInviare.length === 0) {
      alert("Seleziona (flag a sinistra) almeno una riga con l'email compilata.");
      return;
    }
    setStaffBusy(true);
    setStaffResults(null);
    try {
      const risultati = await creaAccountStaffBulk(
        tenantId,
        daInviare.map((r) => ({
          email: r.email.trim(),
          password: r.password,
          ruolo: r.ruolo,
          nome_visualizzato: r.nomeVisualizzato.trim(),
        })),
      );
      setStaffResults(risultati);
      if (risultati.some((r) => r.ok)) await loadRuoli();
    } catch (err) {
      console.error(err);
      setStaffResults([{ email: "—", ok: false, errore: err?.message || "Chiamata non riuscita." }]);
    } finally {
      setStaffBusy(false);
    }
  }

  async function handleRuoloBaseChange(record, nuovoRuolo) {
    if (!tenantId || !record?.user_id) return;
    if (record.ruolo === nuovoRuolo) return;
    setRoleBusyUserId(record.user_id);
    try {
      await updateRuoloPizzeriaPermessi(tenantId, record.user_id, { ruolo: nuovoRuolo });
      await loadRuoli();
      if (detailUser?.user_id === record.user_id) {
        setDetailUser((prev) => (prev ? { ...prev, ruolo: nuovoRuolo } : null));
      }
    } catch (err) {
      console.error(err);
      alert(err?.message || "Aggiornamento ruolo non riuscito.");
    } finally {
      setRoleBusyUserId(null);
    }
  }

  if (loading) return <Loader />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="dashboard-settings-page">
      <h1 className="dashboard-page-title">Ruoli</h1>
      <p className="dashboard-settings-section-desc" style={{ marginBottom: 20 }}>
        Collegamento account ↔ <strong>ruolo base</strong> e <strong>permessi</strong> (aree operative, parametri cassa, note
        password di servizio). Qui <strong>non</strong> si compilano dati anagrafici nè HR: per{" "}
        <strong>nome in sede</strong>, <strong>corsi</strong>, <strong>documenti</strong> e <strong>buste paga</strong> usa{" "}
        <Link to="/admin/dipendenti" style={{ fontWeight: 600 }}>
          Dipendenti
        </Link>
        .
      </p>

      <section className="dashboard-box dashboard-settings-section" style={{ marginBottom: 18, padding: "16px 20px" }}>
        <h2 className="dashboard-settings-section-title" style={{ marginTop: 0 }}>
          Collega un account staff
        </h2>
        <p style={{ color: "#64748b", fontSize: 13, marginBottom: 12, lineHeight: 1.5 }}>
          L&apos;email deve corrispondere a un utente già presente in Authentication (o alla procedura RPC del tuo progetto).
        </p>
        <form onSubmit={(e) => void handleInviteStaff(e)} style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600 }}>Email</span>
            <input
              type="email"
              className="dashboard-search-input"
              style={{ minWidth: 240 }}
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="nome@dominio.it"
              autoComplete="off"
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600 }}>Ruolo iniziale</span>
            <select className="dipendenti-role-select" value={inviteRuolo} onChange={(e) => setInviteRuolo(e.target.value)}>
              {RUOLO_BASE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="btn-primary-dashboard" disabled={inviteBusy}>
            {inviteBusy ? "Invio…" : "Collega"}
          </button>
        </form>
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid #e2e8f0" }}>
          <p style={{ color: "#64748b", fontSize: 13, marginBottom: 10, lineHeight: 1.5 }}>
            Apertura locale nuovo? Genera in un colpo solo gli account standard per reparto (email, password e ruolo
            editabili prima di creare) invece di ripetere il modulo sopra uno per uno.
          </p>
          <button type="button" className="dashboard-settings-btn-secondary" onClick={apriStaffModal}>
            Crea account standard
          </button>
        </div>
      </section>

      <section className="dashboard-box dashboard-settings-section">
        <h2 className="dashboard-settings-section-title">Elenco ruoli</h2>
        <p style={{ color: "#64748b", fontSize: 13, marginBottom: 12 }}>
          Riga principale: <strong>email dell’account</strong>. Se in Dipendenti hai impostato il nome in sede, compare sotto
          come promemoria. Scegli il <strong>ruolo base</strong> dal menu; clicca l’email per il dettaglio (aree consentite).
        </p>
        <p style={{ color: "#64748b", fontSize: 12, marginBottom: 12, lineHeight: 1.5 }}>
          <strong>Password (archivio titolare):</strong> non è la password tecnica in Supabase Auth, ma una{" "}
          <strong>nota opzionale</strong> che registri tu (es. quella che dai al dipendente). Per leggerla in elenco serve{" "}
          <strong>la tua password di accesso</strong> (account admin del locale). Dopo lo sblocco, la visualizzazione resta
          attiva circa 10 minuti. Chi gestisce la piattaforma può inserire o aggiornare le stesse note dalla console Super
          Admin (Clienti → «Archivio password» per quel locale).
        </p>
        {archivioSbloccato ? (
          <p style={{ marginBottom: 12, fontSize: 13 }}>
            <span style={{ color: "#166534", fontWeight: 600 }}>Archivio password sbloccato.</span>{" "}
            <button type="button" className="dashboard-settings-btn-secondary" style={{ marginLeft: 8 }} onClick={chiudiArchivio}>
              Nascondi subito
            </button>
          </p>
        ) : (
          <p style={{ marginBottom: 12, fontSize: 13 }}>
            <button type="button" className="btn-primary-dashboard" style={{ padding: "8px 14px", fontSize: 13 }} onClick={apriReauthMostraNote}>
              Mostra password registrate (chiede la tua password)
            </button>
          </p>
        )}
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
                    <strong style={{ display: "block", textDecoration: "underline", wordBreak: "break-all" }}>{r.email}</strong>
                    {r.nome_visualizzato && String(r.nome_visualizzato).trim() ? (
                      <span style={{ display: "block", fontSize: 12, color: "#64748b", marginTop: 4 }}>
                        Nome in sede (Dipendenti): <strong>{String(r.nome_visualizzato).trim()}</strong>
                      </span>
                    ) : (
                      <span style={{ display: "block", fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                        Etichetta account: {labelFromEmailPrefix(r.email) || "—"}
                      </span>
                    )}
                  </button>
                    <div style={{ marginTop: 8, maxWidth: 320 }} onClick={(e) => e.stopPropagation()}>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 4 }}>
                        Ruolo base
                      </label>
                      <select
                        className="dipendenti-role-select"
                        value={r.ruolo}
                        disabled={roleBusyUserId === r.user_id}
                        onChange={(e) => handleRuoloBaseChange(r, e.target.value)}
                        aria-label={`Ruolo base per ${r.email}`}
                      >
                        {RUOLO_BASE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                        {r.ruolo && !RUOLO_BASE_VALUES.has(r.ruolo) ? (
                          <option value={r.ruolo}>{r.ruolo}</option>
                        ) : null}
                      </select>
                      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>Valore tecnico: {r.ruolo || "—"}</div>
                    </div>
                    <div style={{ fontSize: 12, color: "#64748b", marginTop: 8, lineHeight: 1.45 }}>
                      <span style={{ fontWeight: 600, color: "#475569" }}>Password (archivio): </span>
                      {archivioSbloccato ? (
                        noteByUserId[r.user_id] ? (
                          <code
                            style={{
                              display: "inline-block",
                              marginLeft: 4,
                              padding: "2px 8px",
                              background: "#f1f5f9",
                              borderRadius: 4,
                              fontSize: 12,
                              wordBreak: "break-all",
                            }}
                          >
                            {noteByUserId[r.user_id]}
                          </code>
                        ) : (
                          <span style={{ fontStyle: "italic", color: "#94a3b8" }}>nessuna nota salvata</span>
                        )
                      ) : (
                        <span style={{ letterSpacing: 2, userSelect: "none" }}>••••••••</span>
                      )}
                    </div>
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
            <p style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700, color: "#0f172a", wordBreak: "break-all" }}>{detailUser.email}</p>
            {detailUser.nome_visualizzato && String(detailUser.nome_visualizzato).trim() ? (
              <p style={{ margin: "0 0 12px", fontSize: 13, color: "#64748b" }}>
                Nome in sede (impostato in Dipendenti): <strong>{String(detailUser.nome_visualizzato).trim()}</strong>
              </p>
            ) : (
              <p style={{ margin: "0 0 12px", fontSize: 12, color: "#94a3b8" }}>
                Nome in sede: impostalo in <Link to="/admin/dipendenti">Dipendenti</Link>.
              </p>
            )}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 6 }}>
                Ruolo base
              </label>
              <select
                className="dipendenti-role-select"
                style={{ maxWidth: "100%" }}
                value={detailUser.ruolo}
                disabled={roleBusyUserId === detailUser.user_id}
                onChange={(e) => handleRuoloBaseChange(detailUser, e.target.value)}
              >
                {RUOLO_BASE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
                {detailUser.ruolo && !RUOLO_BASE_VALUES.has(detailUser.ruolo) ? (
                  <option value={detailUser.ruolo}>{detailUser.ruolo}</option>
                ) : null}
              </select>
              <p style={{ margin: "6px 0 0", fontSize: 11, color: "#94a3b8" }}>Valore tecnico: {detailUser.ruolo || "—"}</p>
            </div>
            <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.8, marginBottom: 16 }}>
              {getCosaPuoFare(detailUser.ruolo, detailUser.puo_modificare_parametri).map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
            <p style={{ marginBottom: 8, fontSize: 14, fontWeight: 600, color: "#334155" }}>Aree consentite</p>
            {isDedicatedRepartoRole(detailUser.ruolo) ? (
              <p style={{ marginBottom: 12, fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>
                Per i ruoli di reparto (cassa, cucina, pizzaiolo, ecc.) è attiva <strong>solo</strong> l’area del ruolo: i flag
                nel database non aggiungono altre voci al menu. Per consentire più reparti alla stessa persona, usa il ruolo{" "}
                <strong>operatore</strong> e spunta le aree qui sotto.
              </p>
            ) : (
              <p style={{ marginBottom: 12, fontSize: 12, color: "#64748b" }}>
                L’area del ruolo è sempre attiva. Spunta le altre aree per consentirle in più al menù operativo.
              </p>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {AREE_NAV.map((area) => {
                const ak = ACCESS_TO_AREA_KEY[area.key];
                const fixedByRole = ak ? isDefaultAreaForRole(detailUser.ruolo, ak) : false;
                const dedicated = isDedicatedRepartoRole(detailUser.ruolo);
                const checked = fixedByRole || (!dedicated && detailUser[area.key] === true);
                const disabled = fixedByRole || dedicated;
                return (
                  <label
                    key={area.key}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 14,
                      cursor: disabled ? "default" : "pointer",
                      opacity: disabled ? 0.85 : 1,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={disabled}
                      onChange={() => handleToggleArea(detailUser, area.key)}
                      style={{ width: 18, height: 18, cursor: disabled ? "not-allowed" : "pointer" }}
                    />
                    {area.label}
                    {fixedByRole && (
                      <span style={{ fontSize: 11, color: "#94a3b8" }}>(sempre per questo ruolo)</span>
                    )}
                  </label>
                );
              })}
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

            <div
              style={{
                marginTop: 20,
                paddingTop: 16,
                borderTop: "1px solid #e2e8f0",
              }}
            >
              <p style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 600, color: "#334155" }}>Password d’accesso (archivio)</p>
              <p style={{ margin: "0 0 10px", fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>
                Annota qui la password che usi per questo account (es. dopo creazione utente in Auth). Non viene sincronizzata
                automaticamente con Supabase: è solo un promemoria per il titolare. Lascia vuoto e salva per rimuovere la nota.
              </p>
              {!archivioSbloccato ? (
                <p style={{ margin: "0 0 8px", fontSize: 12, color: "#b45309" }}>
                  Per vedere in chiaro la nota già salvata, sblocca l’archivio dal pulsante sopra l’elenco. Puoi comunque
                  scrivere e salvare una nuova nota senza sbloccare (sovrascrive quella precedente).
                </p>
              ) : null}
              <textarea
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                rows={2}
                className="dashboard-search-input"
                style={{ width: "100%", maxWidth: "100%", boxSizing: "border-box", fontFamily: "inherit", fontSize: 13 }}
                placeholder={
                  archivioSbloccato ? "Password o nota…" : "Nuova nota (testo nascosto fino allo sblocco)…"
                }
              />
              <button
                type="button"
                className="btn-primary-dashboard"
                style={{ marginTop: 10, padding: "8px 16px", fontSize: 13 }}
                disabled={noteSaveBusy}
                onClick={() => void salvaNotaPasswordDettaglio()}
              >
                {noteSaveBusy ? "Salvataggio…" : "Salva nota password"}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={reauthOpen} onClose={() => !reauthBusy && setReauthOpen(false)} title="Conferma la tua password">
        <div style={{ padding: "8px 0 0" }}>
          <p style={{ margin: "0 0 12px", fontSize: 14, color: "#475569", lineHeight: 1.5 }}>
            Per visualizzare le password registrate nell’archivio titolare, inserisci la <strong>password del tuo account admin</strong>{" "}
            (quella con cui accedi a PizzaManager).
          </p>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6, color: "#334155" }} htmlFor="ruoli-reauth-pw">
            Password
          </label>
          <input
            id="ruoli-reauth-pw"
            type="password"
            autoComplete="current-password"
            value={reauthPassword}
            onChange={(e) => setReauthPassword(e.target.value)}
            className="dashboard-search-input"
            style={{ width: "100%", maxWidth: "100%", boxSizing: "border-box", marginBottom: 12 }}
            disabled={reauthBusy}
            onKeyDown={(e) => e.key === "Enter" && !reauthBusy && void confermaReauth()}
          />
          {reauthError ? (
            <p style={{ color: "#b91c1c", fontSize: 13, margin: "0 0 12px" }} role="alert">
              {reauthError}
            </p>
          ) : null}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button type="button" className="dashboard-settings-btn-secondary" disabled={reauthBusy} onClick={() => setReauthOpen(false)}>
              Annulla
            </button>
            <button type="button" className="btn-primary-dashboard" disabled={reauthBusy} onClick={() => void confermaReauth()}>
              {reauthBusy ? "Verifica…" : "Conferma"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={staffModalOpen} onClose={chiudiStaffModal} title="Crea account standard">
        <div style={{ padding: "8px 0 0" }}>
          <p style={{ margin: "0 0 10px", fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>
            Flagga (colonna a sinistra) solo i reparti che ti servono per questo locale — i ruoli già
            collegati al tenant partono deselezionati. Riga per riga: correggi email, ruolo e nome; la
            password è generata ma è modificabile o rigenerabile. Al termine annota le password
            consegnate — qui restano visibili solo finché la finestra è aperta.
          </p>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <button
              type="button"
              className="dashboard-settings-btn-secondary"
              style={{ padding: "4px 10px", fontSize: 12 }}
              onClick={() => selezionaTutteStaffRow(true)}
            >
              Seleziona tutto
            </button>
            <button
              type="button"
              className="dashboard-settings-btn-secondary"
              style={{ padding: "4px 10px", fontSize: 12 }}
              onClick={() => selezionaTutteStaffRow(false)}
            >
              Deseleziona tutto
            </button>
          </div>
          <div className="table-wrap" style={{ overflowX: "auto", marginBottom: 14 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "#64748b", fontSize: 11, textTransform: "uppercase" }}>
                  <th style={{ padding: "4px 6px" }} />
                  <th style={{ padding: "4px 6px" }}>Ruolo</th>
                  <th style={{ padding: "4px 6px" }}>Email</th>
                  <th style={{ padding: "4px 6px" }}>Nome (facoltativo)</th>
                  <th style={{ padding: "4px 6px" }}>Password</th>
                  <th style={{ padding: "4px 6px" }} />
                </tr>
              </thead>
              <tbody>
                {staffRows.map((r) => (
                  <tr
                    key={r.id}
                    style={{ borderTop: "1px solid #e2e8f0", opacity: r.selezionata ? 1 : 0.5 }}
                  >
                    <td style={{ padding: "6px" }}>
                      <input
                        type="checkbox"
                        checked={r.selezionata}
                        onChange={(e) => updateStaffRow(r.id, { selezionata: e.target.checked })}
                        title="Crea questo account"
                      />
                    </td>
                    <td style={{ padding: "6px" }}>
                      <select
                        className="dipendenti-role-select"
                        value={r.ruolo}
                        onChange={(e) => updateStaffRow(r.id, { ruolo: e.target.value })}
                        style={{ minWidth: 120 }}
                      >
                        {RUOLO_BASE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td style={{ padding: "6px" }}>
                      <input
                        type="email"
                        className="dashboard-search-input"
                        value={r.email}
                        onChange={(e) => updateStaffRow(r.id, { email: e.target.value })}
                        placeholder={`${r.ruolo}@${emailDomainForTenant(tenantData)}`}
                        style={{ minWidth: 220 }}
                        autoComplete="off"
                      />
                    </td>
                    <td style={{ padding: "6px" }}>
                      <input
                        type="text"
                        className="dashboard-search-input"
                        value={r.nomeVisualizzato}
                        onChange={(e) => updateStaffRow(r.id, { nomeVisualizzato: e.target.value })}
                        placeholder="es. Marco"
                        style={{ minWidth: 120 }}
                        autoComplete="off"
                      />
                    </td>
                    <td style={{ padding: "6px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <input
                          type="text"
                          className="dashboard-search-input"
                          value={r.password}
                          onChange={(e) => updateStaffRow(r.id, { password: e.target.value })}
                          style={{ minWidth: 140, fontFamily: "monospace" }}
                          spellCheck={false}
                          autoComplete="off"
                        />
                        <button
                          type="button"
                          className="dashboard-settings-btn-secondary"
                          style={{ padding: "4px 8px", fontSize: 12 }}
                          onClick={() => rigeneraStaffPassword(r.id)}
                          title="Rigenera password"
                        >
                          ↻
                        </button>
                      </div>
                    </td>
                    <td style={{ padding: "6px" }}>
                      <button
                        type="button"
                        onClick={() => rimuoviStaffRow(r.id)}
                        style={{ background: "none", border: "none", color: "#b91c1c", cursor: "pointer", fontSize: 13 }}
                      >
                        Rimuovi
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" className="dashboard-settings-btn-secondary" onClick={aggiungiStaffRow} style={{ marginBottom: 16 }}>
            + Aggiungi riga
          </button>

          {staffResults ? (
            <ul style={{ listStyle: "none", padding: 0, margin: "0 0 16px", display: "flex", flexDirection: "column", gap: 6 }}>
              {staffResults.map((r, i) => (
                <li
                  key={`${r.email}-${i}`}
                  style={{
                    fontSize: 13,
                    padding: "6px 10px",
                    borderRadius: 6,
                    background: r.ok ? "#ecfdf5" : "#fef2f2",
                    color: r.ok ? "#166534" : "#b91c1c",
                  }}
                >
                  {r.ok ? "✓" : "✕"} {r.email}: {r.ok ? r.azione : r.errore}
                </li>
              ))}
            </ul>
          ) : null}

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button type="button" className="dashboard-settings-btn-secondary" disabled={staffBusy} onClick={chiudiStaffModal}>
              Chiudi
            </button>
            <button type="button" className="btn-primary-dashboard" disabled={staffBusy} onClick={() => void handleCreaStaffBulk()}>
              {staffBusy ? "Creazione…" : "Crea account e collega ruoli"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
