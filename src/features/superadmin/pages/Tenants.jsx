import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { serviziIdsIncludedForPiano } from "@/app/hooks/useTenantServizi";
import TenantServiziPlanFields from "@/features/superadmin/components/TenantServiziPlanFields";
import { defaultInclusioni, loadPlansResolved } from "@/features/superadmin/catalog/plansStorage";
import { loadServicesCatalog } from "@/features/superadmin/catalog/servicesStorage";
import {
  listArchivioPasswordAccounts,
  upsertStaffPasswordNote,
  creaAccountStaffBulk,
} from "@/features/admin/services/adminService";
import {
  RUOLO_BASE_OPTIONS,
  nuovaStaffRow,
  nuoveStaffRowsStandard,
} from "@/features/admin/utils/staffAccountRows";

import {
  createTenant,
  getGoLiveChecklist,
  getSubscriptionRow,
  getTenants,
  updateTenant,
  resetAccountPasswordReale,
} from "@/features/superadmin/services/superadminService";
import { seedMenuBase } from "@/features/admin/services/menuBaseSeed";
import { labelFromEmailPrefix } from "@/utils/emailDisplayLabel";
import { pianoDisplayLabel, tenantListinoLabel } from "@/features/superadmin/utils/pianoLabels";
import SaListSearchField from "@/features/superadmin/components/SaListSearchField";
import { normalizeListSearchQuery, rowMatchesListSearch } from "@/utils/listSearchFilter";
import {
  REGISTER_IT_SMTP,
  emailDomainForTenantForm,
  mergeTenantEmailCanaliIntoParametri,
  suggestedMailboxAddresses,
  tenantEmailCanaliFromParametri,
} from "@/features/superadmin/utils/tenantEmailCanali";

/** Placeholder ruoli@dominio: dominio del locale, sottodominio piattaforma, o fallback. */
function emailDomainForModal(modal) {
  return emailDomainForTenantForm(modal) || "illocale.it";
}

const PIANO_OPTIONS = [
  { value: "TRIAL", label: "Prova (14 gg) — bundle come Pro" },
  { value: "FREE", label: "Gratuito — solo bundle Base" },
  { value: "PRO", label: "Pro" },
  { value: "ENTERPRISE", label: "Enterprise" },
];

const MODAL_TABS = [
  { id: "anagrafica", label: "Anagrafica" },
  { id: "servizi", label: "Contratto e servizi" },
  { id: "fiscale", label: "Fiscale e contatti" },
  { id: "email", label: "Email e SMTP" },
  { id: "canone", label: "Canone servizio" },
  { id: "account", label: "Account attivi" },
];

function slugify(s) {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

function toDateInputValue(v) {
  if (v == null || v === "") return "";
  const d = typeof v === "string" ? new Date(v) : v;
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

/** True se la data di scadenza sconto (YYYY-MM-DD) è passata rispetto a oggi. Nessuna scadenza = mai scaduto. */
function scontoScaduto(scadenzaYmd) {
  if (!scadenzaYmd) return false;
  const oggi = new Date();
  const oggiYmd = `${oggi.getFullYear()}-${String(oggi.getMonth() + 1).padStart(2, "0")}-${String(oggi.getDate()).padStart(2, "0")}`;
  return String(scadenzaYmd) < oggiYmd;
}

function emptyModal(mode, services, reloadInclusioniFromPiano) {
  return {
    mode,
    nome: "",
    slug: "",
    piano: "TRIAL",
    attivo: true,
    partita_iva: "",
    email_fatturazione: "",
    pec: "",
    codice_univoco_sdi: "",
    addebito_automatico_mensile: false,
    data_attivazione_abbonamento: "",
    sconto_percentuale: "0",
    sconto_importo_euro: "0",
    sconto_scadenza: "",
    prova_valida_fino: "",
    serviziPersonalizzati: false,
    pianoTemplateId: "",
    pianoCommercialeNome: "",
    inclusioni: reloadInclusioniFromPiano("TRIAL", services),
    parametriOperativiBase: {},
    abbonamentoCicloGiorni: 30,
    abbonamentoScontoAnnualePercent: "",
    sito_web_cliente: "",
    public_domain: "",
    public_domain_status: "none",
    caricaMenuBase: true,
    email_noreply: "",
    email_info: "",
    email_support: "",
    smtp_host: "",
    smtp_port: "",
    smtp_user: "",
    smtp_pass: "",
    smtp_pass_impostata: false,
  };
}

function tenantToModal(t, mode, services, reloadInclusioniFromPiano) {
  const po = t.parametri_operativi && typeof t.parametri_operativi === "object" ? { ...t.parametri_operativi } : {};
  const serviziPersonalizzati = po.servizi_personalizzati === true;
  const ids = Array.isArray(po.servizi_abilitati) ? po.servizi_abilitati : [];
  let inclusioni;
  if (serviziPersonalizzati && ids.length) {
    inclusioni = defaultInclusioni(services);
    for (const id of ids) {
      if (Object.prototype.hasOwnProperty.call(inclusioni, id)) inclusioni[id] = true;
    }
  } else {
    inclusioni = reloadInclusioniFromPiano(t.piano, services);
  }
  return {
    mode,
    id: t.id,
    nome: t.nome ?? "",
    slug: t.slug ?? "",
    piano: t.piano ?? "TRIAL",
    attivo: !!t.attivo,
    partita_iva: t.partita_iva ?? "",
    email_fatturazione: t.email_fatturazione ?? "",
    pec: t.pec ?? "",
    codice_univoco_sdi: t.codice_univoco_sdi ?? "",
    addebito_automatico_mensile: !!t.addebito_automatico_mensile,
    data_attivazione_abbonamento: toDateInputValue(t.data_attivazione_abbonamento),
    sconto_percentuale:
      t.sconto_percentuale != null && t.sconto_percentuale !== ""
        ? String(t.sconto_percentuale)
        : "0",
    sconto_importo_euro:
      po.sconto_importo_euro != null && po.sconto_importo_euro !== ""
        ? String(po.sconto_importo_euro)
        : "0",
    sconto_scadenza: toDateInputValue(t.sconto_scadenza),
    prova_valida_fino: toDateInputValue(t.prova_valida_fino),
    serviziPersonalizzati,
    pianoTemplateId: "",
    pianoCommercialeNome: typeof po.piano_listino_nome === "string" ? po.piano_listino_nome.trim() : "",
    inclusioni,
    parametriOperativiBase: po,
    abbonamentoCicloGiorni: 30,
    abbonamentoScontoAnnualePercent: "",
    sito_web_cliente: t.sito_web_cliente ?? "",
    public_domain: t.public_domain ?? "",
    public_domain_status: t.public_domain_status ?? "none",
    ...tenantEmailCanaliFromParametri(po),
  };
}

function extractHostname(rawUrl) {
  const v = String(rawUrl || "").trim();
  if (!v) return "";
  const candidate = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  try {
    const u = new URL(candidate);
    return String(u.hostname || "").trim().toLowerCase();
  } catch {
    return "";
  }
}

function CellEllipsis({ children, title }) {
  return (
    <td
      style={{
        maxWidth: 140,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        fontSize: 13,
        color: "#444",
      }}
      title={title ?? (typeof children === "string" ? children : undefined)}
    >
      {children}
    </td>
  );
}

export default function Tenants() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [modalTab, setModalTab] = useState("anagrafica");
  const [listQuery, setListQuery] = useState("");
  /** Modale Modifica cliente: staff + note archivio password (stessa tabella che vede Admin → Ruoli). */
  const [archivio, setArchivio] = useState({
    loading: false,
    error: null,
    ruoli: [],
    drafts: {},
    savingUserId: null,
  });
  /** Checklist go-live del tenant in modifica, per non far attivare un cliente col dominio a metà. */
  const [goLiveChecks, setGoLiveChecks] = useState(null);
  /**
   * Creazione account staff dalla tab "Account attivi" — prima di questo il superadmin non aveva
   * ALCUN modo di creare un account per un tenant senza entrare come admin di quel tenant (blocco
   * reale trovato testando dal vivo il pannello). Stessa logica/edge function di Admin → Ruoli →
   * "Crea account standard" (crea-account-staff accetta già il superadmin come chiamante).
   */
  const [staffRows, setStaffRows] = useState([]);
  const [staffBusy, setStaffBusy] = useState(false);
  const [staffResults, setStaffResults] = useState(null);
  const [applyingUserId, setApplyingUserId] = useState(null);
  const [applyMsg, setApplyMsg] = useState({});

  const catalogServices = useMemo(() => loadServicesCatalog(), []);
  const commercialPlans = useMemo(() => {
    const { plans } = loadPlansResolved();
    return plans.filter((p) => p.attivo !== false);
  }, []);

  const filteredList = useMemo(() => {
    const q = normalizeListSearchQuery(listQuery);
    if (!q) return list;
    return list.filter((t) =>
      rowMatchesListSearch(q, [
        t.nome,
        t.slug,
        t.partita_iva,
        t.email_fatturazione,
        t.pec,
        t.codice_univoco_sdi,
        t.piano,
        pianoDisplayLabel(t.piano),
        tenantListinoLabel(t),
        t.attivo ? "attivo" : "disattivo",
        t.prova_valida_fino,
        t.created_at,
      ]),
    );
  }, [list, listQuery]);

  const reloadInclusioniFromPiano = useCallback((piano, services) => {
    const set = serviziIdsIncludedForPiano(piano);
    const z = defaultInclusioni(services);
    for (const id of set) {
      if (Object.prototype.hasOwnProperty.call(z, id)) z[id] = true;
    }
    return z;
  }, []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getTenants();
      setList(data);
    } catch (err) {
      setError(err?.message ?? "Errore caricamento tenant");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!modal || modal.mode !== "edit" || !modal.id) {
      setArchivio({ loading: false, error: null, ruoli: [], drafts: {}, savingUserId: null });
      return undefined;
    }
    const tenantId = modal.id;
    let cancelled = false;
    (async () => {
      setArchivio({ loading: true, error: null, ruoli: [], drafts: {}, savingUserId: null });
      try {
        const { accounts, notesByUser } = await listArchivioPasswordAccounts(tenantId);
        if (cancelled) return;
        const drafts = {};
        for (const r of accounts || []) {
          drafts[r.user_id] = notesByUser[r.user_id] ?? "";
        }
        setArchivio({ loading: false, error: null, ruoli: accounts || [], drafts, savingUserId: null });
      } catch (err) {
        if (cancelled) return;
        setArchivio({
          loading: false,
          error: err?.message ?? "Impossibile caricare account o password archiviate.",
          ruoli: [],
          drafts: {},
          savingUserId: null,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `modal` cambia a ogni campo del form; serve solo tenant/mode
  }, [modal?.mode, modal?.id]);

  // Righe "crea account standard" pre-selezionate in base ai ruoli già presenti sul tenant —
  // aspetta che l'archivio finisca di caricare, altrimenti la preselezione partirebbe alla cieca.
  useEffect(() => {
    if (!modal || modal.mode !== "edit" || !modal.id) {
      setStaffRows([]);
      setStaffResults(null);
      return;
    }
    if (archivio.loading) return;
    setStaffRows(nuoveStaffRowsStandard(archivio.ruoli));
    setStaffResults(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al termine del caricamento, non ad ogni modifica di archivio.ruoli
  }, [modal?.mode, modal?.id, archivio.loading]);

  useEffect(() => {
    if (!modal || modal.mode !== "edit" || !modal.id) {
      setGoLiveChecks(null);
      return undefined;
    }
    const tenantId = modal.id;
    let cancelled = false;
    (async () => {
      try {
        const checks = await getGoLiveChecklist(tenantId);
        if (!cancelled) setGoLiveChecks(checks ?? null);
      } catch {
        if (!cancelled) setGoLiveChecks(null);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- serve solo tenant/mode, non ogni campo del form
  }, [modal?.mode, modal?.id]);

  const saveArchivioNote = async (userId, text) => {
    const tid = modal?.id;
    if (!tid || !userId) return;
    setArchivio((a) => ({ ...a, savingUserId: userId }));
    try {
      await upsertStaffPasswordNote(tid, userId, text);
    } catch (err) {
      setError(err?.message ?? "Salvataggio password archivio non riuscito.");
      setArchivio((a) => ({ ...a, savingUserId: null }));
      return;
    }
    setArchivio((a) => ({ ...a, savingUserId: null }));
  };

  async function applyPasswordReale(userId, password, nome) {
    const tid = modal?.id;
    const testo = String(password || "").trim();
    if (!tid || !userId) return;
    if (testo.length < 6) {
      setApplyMsg((m) => ({ ...m, [userId]: { ok: false, testo: "Minimo 6 caratteri per applicarla su Supabase." } }));
      return;
    }
    const conferma = window.confirm(
      `Sovrascrivere la password reale di ${nome} su Supabase con il testo qui sopra? L'account non potrà più usare la password precedente.`,
    );
    if (!conferma) return;
    setApplyingUserId(userId);
    setApplyMsg((m) => ({ ...m, [userId]: null }));
    try {
      await resetAccountPasswordReale({ tenantId: tid, userId, password: testo });
      setApplyMsg((m) => ({ ...m, [userId]: { ok: true, testo: "Password applicata su Supabase." } }));
    } catch (err) {
      setApplyMsg((m) => ({ ...m, [userId]: { ok: false, testo: err?.message || "Applicazione non riuscita." } }));
    } finally {
      setApplyingUserId(null);
    }
  }

  function updateStaffRow(id, patch) {
    setStaffRows((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function selezionaTutteStaffRow(selezionata) {
    setStaffRows((rows) => rows.map((r) => ({ ...r, selezionata })));
  }

  function aggiungiStaffRow() {
    setStaffRows((rows) => [...rows, nuovaStaffRow("cassa")]);
  }

  function rimuoviStaffRow(id) {
    setStaffRows((rows) => rows.filter((r) => r.id !== id));
  }

  async function handleCreaStaffBulk() {
    const tenantId = modal?.id;
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
      if (risultati.some((r) => r.ok)) {
        const { accounts, notesByUser } = await listArchivioPasswordAccounts(tenantId);
        const drafts = {};
        for (const r of accounts || []) drafts[r.user_id] = notesByUser[r.user_id] ?? "";
        setArchivio({ loading: false, error: null, ruoli: accounts || [], drafts, savingUserId: null });
        setStaffRows(nuoveStaffRowsStandard(accounts || []));
      }
    } catch (err) {
      console.error(err);
      setStaffResults([{ email: "—", ok: false, errore: err?.message || "Chiamata non riuscita." }]);
    } finally {
      setStaffBusy(false);
    }
  }

  const openCreate = () => {
    setModalTab("anagrafica");
    setModal(emptyModal("create", catalogServices, reloadInclusioniFromPiano));
  };

  const openEdit = (t) => {
    setModalTab("anagrafica");
    const base = tenantToModal(t, "edit", catalogServices, reloadInclusioniFromPiano);
    setModal(base);
    void getSubscriptionRow(t.id).then((sub) => {
      if (!sub) return;
      setModal((m) => {
        if (!m || m.id !== t.id || m.mode !== "edit") return m;
        return {
          ...m,
          abbonamentoCicloGiorni: sub.ciclo_fatturazione_giorni ?? 30,
          abbonamentoScontoAnnualePercent:
            sub.sconto_annuale_percent != null && String(sub.sconto_annuale_percent).trim() !== ""
              ? String(sub.sconto_annuale_percent)
              : "",
        };
      });
    });
  };

  const closeModal = () => {
    setModal(null);
    setModalTab("anagrafica");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!modal) return;
    setSaving(true);
    try {
      const enabledIds = Object.entries(modal.inclusioni || {})
        .filter(([, v]) => v)
        .map(([id]) => id);
      const basePo = { ...(modal.parametriOperativiBase || {}) };
      const nextPo = {
        ...basePo,
        servizi_personalizzati: modal.serviziPersonalizzati,
        servizi_abilitati: modal.serviziPersonalizzati ? enabledIds : [],
      };
      if (modal.pianoCommercialeNome && String(modal.pianoCommercialeNome).trim()) {
        nextPo.piano_listino_nome = String(modal.pianoCommercialeNome).trim();
      } else {
        delete nextPo.piano_listino_nome;
      }

      const euroFisso = Math.max(
        0,
        Math.round((Number(String(modal.sconto_importo_euro ?? "").replace(",", ".")) || 0) * 100) / 100,
      );
      nextPo.sconto_importo_euro = euroFisso;

      Object.assign(
        nextPo,
        mergeTenantEmailCanaliIntoParametri(nextPo, {
          email_noreply: modal.email_noreply,
          email_info: modal.email_info,
          email_support: modal.email_support,
          smtp_host: modal.smtp_host,
          smtp_port: modal.smtp_port,
          smtp_user: modal.smtp_user,
          smtp_pass: modal.smtp_pass,
        }),
      );

      const ciclo = Number(modal.abbonamentoCicloGiorni) === 365 ? 365 : 30;
      const payload = {
        nome: modal.nome,
        slug: modal.slug || slugify(modal.nome),
        piano: modal.piano,
        attivo: modal.attivo,
        partita_iva: modal.partita_iva,
        email_fatturazione: modal.email_fatturazione,
        pec: modal.pec,
        codice_univoco_sdi: modal.codice_univoco_sdi,
        addebito_automatico_mensile: modal.addebito_automatico_mensile,
        data_attivazione_abbonamento: modal.data_attivazione_abbonamento || null,
        sconto_percentuale: modal.sconto_percentuale,
        sconto_scadenza: modal.sconto_scadenza || null,
        prova_valida_fino: modal.prova_valida_fino || null,
        parametri_operativi: nextPo,
        sito_web_cliente: modal.sito_web_cliente || null,
        public_domain: modal.public_domain || extractHostname(modal.sito_web_cliente) || null,
        public_domain_status: modal.public_domain_status || "none",
        abbonamento_ciclo_giorni: ciclo,
        abbonamento_sconto_annuale_percent:
          ciclo === 365 && String(modal.abbonamentoScontoAnnualePercent ?? "").trim() !== ""
            ? modal.abbonamentoScontoAnnualePercent
            : null,
      };
      if (modal.mode === "create") {
        const created = await createTenant(payload);
        const host = payload.public_domain;
        if (host) {
          alert(
            `Cliente creato. Per collegare il dominio ${host} a Supabase Auth (conferma email e reset password) esegui nel progetto:\n\nnpm run supabase:auth:sync-redirects`,
          );
        }
        if (modal.caricaMenuBase && created?.id) {
          try {
            const esito = await seedMenuBase(created.id);
            if (esito.errori.length) {
              console.warn("[Tenants] seedMenuBase con errori parziali:", esito.errori);
              alert(
                `Tenant creato. Menu base caricato parzialmente (${esito.categorie} categorie, ${esito.ingredienti} ingredienti, ${esito.pizze} pizze). ` +
                  `${esito.errori.length} elemento/i non creato/i — puoi ricaricarlo da Admin → Menu → Categorie. Dettaglio in console.`,
              );
            }
          } catch (seedErr) {
            console.error("[Tenants] seedMenuBase fallito:", seedErr);
            alert(
              "Tenant creato, ma il caricamento del menu base non è riuscito. Puoi riprovare da Admin → Menu → Categorie con un account admin di quel tenant.",
            );
          }
        }
      } else {
        await updateTenant(modal.id, payload);
      }
      closeModal();
      load();
    } catch (err) {
      setError(err?.message ?? "Errore salvataggio");
    } finally {
      setSaving(false);
    }
  };

  const setModalField = (field, value) => {
    setModal((m) => {
      if (!m) return m;
      const next = { ...m, [field]: value };
      if (field === "nome" && m.mode === "create") {
        next.slug = slugify(value);
      }
      if (field === "piano" && !m.serviziPersonalizzati && !m.pianoTemplateId) {
        next.inclusioni = reloadInclusioniFromPiano(value, catalogServices);
      }
      return next;
    });
  };

  const inputStyle = {
    width: "100%",
    padding: "8px 12px",
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    boxSizing: "border-box",
    fontSize: 14,
    background: "#fff",
  };

  const labelStyle = { display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6, color: "#475569" };

  // Con un dominio pubblico personalizzato impostato, il cliente non va attivato finché DNS e
  // Firebase Hosting non sono verificati (wizard "Aggiungi dominio") — altrimenti si attiva un
  // account che punta a un dominio non ancora raggiungibile. Senza dominio personalizzato il
  // tenant lavora sullo slug *.pizzamanager.it, sempre pronto: nessuna verifica da attendere.
  const dominioPersonalizzato = Boolean((modal?.public_domain || "").trim());
  const dominioPronto = !dominioPersonalizzato || Boolean(goLiveChecks?.firebase_host && goLiveChecks?.dns);
  const attivazioneBloccata = Boolean(modal && !modal.attivo && dominioPersonalizzato && !dominioPronto);

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="skeleton" />
        <div className="skeleton-row" />
        <div className="skeleton-row" />
      </div>
    );
  }

  return (
    <>
      <header className="sa-page-header">
        <p className="sa-page-kicker">Super Admin · commerciale</p>
        <h1 className="dashboard-page-title sa-page-title">Clienti (tenant)</h1>
        <p className="sa-page-lede">
          Anagrafica pizzerie, livello contratto e — se serve — servizi personalizzati rispetto al listino.
        </p>
      </header>

      <div className="sa-page-toolbar">
        <SaListSearchField
          id="sa-tenants-search"
          value={listQuery}
          onChange={setListQuery}
          placeholder="Cerca per nome, slug, email, P.IVA, piano, listino…"
          resultsCount={filteredList.length}
          totalCount={list.length}
        />
        <div className="sa-page-toolbar-actions">
          <button type="button" className="btn-primary-dashboard" onClick={openCreate}>
            Nuovo cliente
          </button>
        </div>
      </div>

      {error && <div className="dashboard-error" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="dashboard-table-wrap" style={{ overflowX: "auto" }}>
        <table style={{ minWidth: 960 }}>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Slug</th>
              <th>P.IVA</th>
              <th>Email</th>
              <th>PEC</th>
              <th>Cod. univoco</th>
              <th>Addebito auto.</th>
              <th>Sconto %</th>
              <th>Contratto</th>
              <th>Listino</th>
              <th>Prova fino al</th>
              <th>Stato</th>
              <th>Creato</th>
              <th style={{ textAlign: "right" }}>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr>
                <td colSpan={14} style={{ padding: 32, textAlign: "center", color: "#666", fontSize: 14 }}>
                  Nessun cliente. Clicca &quot;Nuovo cliente&quot; per aggiungerne uno.
                </td>
              </tr>
            ) : filteredList.length === 0 ? (
              <tr>
                <td colSpan={14} style={{ padding: 32, textAlign: "center", color: "#666", fontSize: 14 }}>
                  Nessun risultato per la ricerca. Modifica o cancella il filtro nel campo di ricerca sopra.
                </td>
              </tr>
            ) : (
              filteredList.map((t) => (
                <tr key={t.id}>
                  <td style={{ fontWeight: 600, fontSize: 14 }}>{t.nome}</td>
                  <CellEllipsis title={t.slug}>{t.slug || "—"}</CellEllipsis>
                  <CellEllipsis title={t.partita_iva}>{t.partita_iva || "—"}</CellEllipsis>
                  <CellEllipsis title={t.email_fatturazione}>{t.email_fatturazione || "—"}</CellEllipsis>
                  <CellEllipsis title={t.pec}>{t.pec || "—"}</CellEllipsis>
                  <CellEllipsis title={t.codice_univoco_sdi}>{t.codice_univoco_sdi || "—"}</CellEllipsis>
                  <td style={{ fontSize: 13 }}>
                    {t.addebito_automatico_mensile ? (
                      <span className="badge badge-success">Sì</span>
                    ) : (
                      <span className="badge badge-neutral">No</span>
                    )}
                  </td>
                  <td style={{ fontSize: 13, color: "#444" }}>
                    {(() => {
                      const po =
                        t.parametri_operativi && typeof t.parametri_operativi === "object"
                          ? t.parametri_operativi
                          : {};
                      const euro = Number(po.sconto_importo_euro) || 0;
                      const pct = t.sconto_percentuale != null && Number(t.sconto_percentuale) > 0;
                      const bits = [];
                      if (pct) bits.push(`${Number(t.sconto_percentuale)}%`);
                      if (euro > 0) bits.push(`−${euro} €`);
                      if (!bits.length) return "—";
                      const scaduto = scontoScaduto(t.sconto_scadenza);
                      const scadenzaLabel = t.sconto_scadenza
                        ? new Date(t.sconto_scadenza + "T12:00:00").toLocaleDateString("it-IT")
                        : null;
                      return (
                        <>
                          <span style={scaduto ? { textDecoration: "line-through", color: "#94a3b8" } : undefined}>
                            {bits.join(" · ")}
                          </span>
                          {scadenzaLabel ? (
                            <span
                              style={{
                                display: "block",
                                fontSize: 11,
                                color: scaduto ? "#c0392b" : "#64748b",
                                fontWeight: scaduto ? 700 : 400,
                              }}
                            >
                              {scaduto ? `Scaduto il ${scadenzaLabel}` : `Fino al ${scadenzaLabel}`}
                            </span>
                          ) : null}
                        </>
                      );
                    })()}
                  </td>
                  <td style={{ fontSize: 13 }}>{pianoDisplayLabel(t.piano)}</td>
                  <td style={{ fontSize: 13, color: "#64748b" }}>{tenantListinoLabel(t) ?? "—"}</td>
                  <td style={{ color: "#666", fontSize: 13 }}>
                    {t.prova_valida_fino
                      ? new Date(t.prova_valida_fino + "T12:00:00").toLocaleDateString("it-IT")
                      : "—"}
                  </td>
                  <td>
                    <span className={t.attivo ? "badge badge-success" : "badge badge-neutral"}>
                      {t.attivo ? "Attivo" : "Disattivo"}
                    </span>
                  </td>
                  <td style={{ color: "#666", fontSize: 13 }}>
                    {t.created_at ? new Date(t.created_at).toLocaleDateString("it-IT") : "—"}
                  </td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <Link to={`/superadmin/tenants/${t.id}/archivio-password`} className="sa-table-action">
                      Archivio password
                    </Link>
                    <button type="button" onClick={() => openEdit(t)} className="sa-table-action" style={{ marginLeft: 8 }}>
                      Modifica
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="sa-modal-overlay" role="presentation">
          <div
            className="dashboard-box sa-modal-panel"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="sa-tenant-modal-title"
          >
            <h2 id="sa-tenant-modal-title" className="sa-modal-title">
              {modal.mode === "create" ? "Nuovo cliente" : "Modifica cliente"}
            </h2>
            <p className="sa-modal-subtitle">
              Struttura cliente a finestre: anagrafica, servizi, fiscale, email/SMTP, canone e account attivi.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
              {MODAL_TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={modalTab === t.id ? "btn-primary-dashboard" : "sa-btn-ghost"}
                  onClick={() => setModalTab(t.id)}
                  style={{ padding: "8px 12px" }}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <form onSubmit={handleSubmit} className="sa-modal-form">
              {modalTab === "anagrafica" ? (
                <section className="sa-form-section">
                <h3 className="sa-form-section-title">Anagrafica e contratto</h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
                  <div>
                    <label style={labelStyle}>Nome attività</label>
                    <input
                      type="text"
                      value={modal.nome}
                      onChange={(e) => setModalField("nome", e.target.value)}
                      style={inputStyle}
                      required
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Slug</label>
                    <input
                      type="text"
                      value={modal.slug}
                      onChange={(e) => setModalField("slug", e.target.value)}
                      style={inputStyle}
                      required
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Livello contratto (subscription)</label>
                    <select
                      value={modal.piano}
                      onChange={(e) => setModalField("piano", e.target.value)}
                      style={inputStyle}
                    >
                      {PIANO_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <p style={{ margin: "6px 0 0", fontSize: 12, color: "#64748b" }}>
                      Valore tecnico su DB e abbonamenti; il bundle operativo predefinito segue questo livello se non
                      personalizzi i servizi.
                    </p>
                  </div>
                  <div>
                    <label style={labelStyle}>Prova valida fino al (incluso)</label>
                    <input
                      type="date"
                      value={modal.prova_valida_fino}
                      onChange={(e) => setModalField("prova_valida_fino", e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={labelStyle}>URL sito cliente</label>
                    <input
                      type="text"
                      value={modal.sito_web_cliente}
                      onChange={(e) => setModalField("sito_web_cliente", e.target.value)}
                      style={inputStyle}
                      placeholder="https://miapizzeria.pizzamanager.it"
                      autoComplete="off"
                    />
                    <p style={{ margin: "6px 0 0", fontSize: 12, color: "#64748b" }}>
                      URL completo della vetrina cliente. Se il dominio pubblico è vuoto, al salvataggio viene derivato da qui.
                    </p>
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={labelStyle}>Hostname pubblico (routing tenant)</label>
                    <input
                      type="text"
                      value={modal.public_domain}
                      onChange={(e) => setModalField("public_domain", e.target.value)}
                      style={inputStyle}
                      placeholder="miapizzeria.pizzamanager.it"
                      autoComplete="off"
                    />
                  </div>
                </div>
                <div style={{ marginTop: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      type="checkbox"
                      id="attivo"
                      checked={modal.attivo}
                      disabled={attivazioneBloccata}
                      onChange={(e) => setModalField("attivo", e.target.checked)}
                    />
                    <label htmlFor="attivo" style={{ fontSize: 14, opacity: attivazioneBloccata ? 0.6 : 1 }}>
                      Cliente attivo
                    </label>
                  </div>
                  {attivazioneBloccata ? (
                    <p style={{ margin: "6px 0 0", fontSize: 12, color: "#b45309" }}>
                      Blocco attivazione: hostname personalizzato impostato ma DNS/Firebase Hosting non ancora
                      verificati nella checklist Go-live. Completa il wizard{" "}
                      <Link
                        to={modal.slug ? `/superadmin/go-live?tenant=${encodeURIComponent(modal.slug)}` : "/superadmin/go-live"}
                        style={{ fontWeight: 600, color: "#b45309" }}
                      >
                        Aggiungi dominio
                      </Link>{" "}
                      prima di attivare il cliente.
                    </p>
                  ) : null}
                </div>
                {modal.mode === "create" ? (
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginTop: 12 }}>
                    <input
                      type="checkbox"
                      id="carica-menu-base"
                      checked={modal.caricaMenuBase}
                      onChange={(e) => setModalField("caricaMenuBase", e.target.checked)}
                      style={{ marginTop: 3 }}
                    />
                    <label htmlFor="carica-menu-base" style={{ fontSize: 14 }}>
                      Carica menu base (4 pizze classiche, ingredienti, categorie, formati) — il locale parte già con
                      un menu funzionante da modificare invece che da zero.
                    </label>
                  </div>
                ) : null}
              </section>
              ) : null}

              {modalTab === "servizi" ? (
                <section className="sa-form-section">
                  <h3 className="sa-form-section-title">Contratto e servizi inclusi</h3>
                  <TenantServiziPlanFields
                modal={modal}
                catalogServices={catalogServices}
                commercialPlans={commercialPlans}
                labelStyle={labelStyle}
                inputStyle={inputStyle}
                setModal={setModal}
                reloadInclusioniFromPiano={reloadInclusioniFromPiano}
              />
                </section>
              ) : null}

              {modalTab === "fiscale" ? (
                <section className="sa-form-section">
                <h3 className="sa-form-section-title">Dati fiscali e contatti</h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
                  <div>
                    <label style={labelStyle}>Partita IVA</label>
                    <input
                      type="text"
                      value={modal.partita_iva}
                      onChange={(e) => setModalField("partita_iva", e.target.value)}
                      style={inputStyle}
                      placeholder="es. IT01234567890"
                      autoComplete="off"
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Email (azienda / fatturazione)</label>
                    <input
                      type="email"
                      value={modal.email_fatturazione}
                      onChange={(e) => setModalField("email_fatturazione", e.target.value)}
                      style={inputStyle}
                      placeholder="fatturazione@esempio.it"
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>PEC</label>
                    <input
                      type="email"
                      value={modal.pec}
                      onChange={(e) => setModalField("pec", e.target.value)}
                      style={inputStyle}
                      placeholder="nome@pec.it"
                    />
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={labelStyle}>Codice univoco / SDI</label>
                    <input
                      type="text"
                      value={modal.codice_univoco_sdi}
                      onChange={(e) => setModalField("codice_univoco_sdi", e.target.value)}
                      style={inputStyle}
                      placeholder="es. codice destinatario o '0000000'"
                      autoComplete="off"
                    />
                  </div>
                </div>
              </section>
              ) : null}

              {modalTab === "email" ? (
                <section className="sa-form-section">
                  <h3 className="sa-form-section-title">Email del locale e SMTP</h3>
                  <p style={{ margin: "0 0 14px", fontSize: 13, color: "#64748b", lineHeight: 1.55 }}>
                    Inserisci il dominio della pizzeria in Anagrafica (acquistato da te o già del locale) e le tre
                    caselle create su Register.it o altro provider. Lo script{" "}
                    <code style={{ fontSize: 12 }}>npm run supabase:auth:sync-redirects</code> collega il dominio a
                    Supabase Auth (link di conferma e reset password). L’SMTP di <strong>registrazione clienti</strong> resta
                    quello di piattaforma (<code style={{ fontSize: 12 }}>no-reply@pizzamanager.it</code>): non si può
                    avere un SMTP Auth diverso per ogni tenant. Host e password qui sotto servono alle{" "}
                    <strong>comunicazioni</strong> (notifiche) con mittente <code style={{ fontSize: 12 }}>info@</code> del
                    locale.
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                    <button
                      type="button"
                      className="sa-btn-ghost"
                      onClick={() => {
                        const host = emailDomainForTenantForm(modal);
                        const suggested = suggestedMailboxAddresses(host);
                        setModal((m) =>
                          m
                            ? {
                                ...m,
                                ...suggested,
                                smtp_host: m.smtp_host || REGISTER_IT_SMTP.host,
                                smtp_port: m.smtp_port || String(REGISTER_IT_SMTP.port),
                                smtp_user: m.smtp_user || suggested.email_info,
                              }
                            : m,
                        );
                      }}
                    >
                      Compila no-reply / info / support dal dominio
                    </button>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
                    <div>
                      <label style={labelStyle}>Registrazione clienti (no-reply)</label>
                      <input
                        type="email"
                        value={modal.email_noreply}
                        onChange={(e) => setModalField("email_noreply", e.target.value)}
                        style={inputStyle}
                        placeholder="no-reply@dominio-locale.it"
                        autoComplete="off"
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Comunicazioni (info)</label>
                      <input
                        type="email"
                        value={modal.email_info}
                        onChange={(e) => setModalField("email_info", e.target.value)}
                        style={inputStyle}
                        placeholder="info@dominio-locale.it"
                        autoComplete="off"
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Assistenza (support)</label>
                      <input
                        type="email"
                        value={modal.email_support}
                        onChange={(e) => setModalField("email_support", e.target.value)}
                        style={inputStyle}
                        placeholder="support@dominio-locale.it"
                        autoComplete="off"
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>SMTP host</label>
                      <input
                        type="text"
                        value={modal.smtp_host}
                        onChange={(e) => setModalField("smtp_host", e.target.value)}
                        style={inputStyle}
                        placeholder={REGISTER_IT_SMTP.host}
                        autoComplete="off"
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>SMTP porta</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={modal.smtp_port}
                        onChange={(e) => setModalField("smtp_port", e.target.value)}
                        style={inputStyle}
                        placeholder={String(REGISTER_IT_SMTP.port)}
                        autoComplete="off"
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>SMTP utente</label>
                      <input
                        type="text"
                        value={modal.smtp_user}
                        onChange={(e) => setModalField("smtp_user", e.target.value)}
                        style={inputStyle}
                        placeholder="info@dominio-locale.it"
                        autoComplete="off"
                      />
                    </div>
                    <div style={{ gridColumn: "1 / -1" }}>
                      <label style={labelStyle}>
                        SMTP password
                        {modal.smtp_pass_impostata ? " (già salvata: lascia vuoto per non cambiarla)" : ""}
                      </label>
                      <input
                        type="password"
                        value={modal.smtp_pass}
                        onChange={(e) => setModalField("smtp_pass", e.target.value)}
                        style={inputStyle}
                        autoComplete="new-password"
                      />
                    </div>
                  </div>
                  <p style={{ margin: "14px 0 0", fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>
                    Dopo il salvataggio, da terminale nella cartella del progetto:{" "}
                    <code>npm run supabase:auth:sync-redirects</code>
                    {modal.public_domain
                      ? ` — include il dominio ${emailDomainForTenantForm(modal)} nella allow-list Auth.`
                      : " — funziona quando in Anagrafica è compilato l’hostname pubblico."}
                  </p>
                </section>
              ) : null}

              {modalTab === "account" && modal.mode === "edit" && modal.id ? (
                <section className="sa-form-section">
                  <h3 className="sa-form-section-title">Account attivi cliente</h3>
                  <p style={{ margin: "0 0 12px", fontSize: 13, color: "#64748b", lineHeight: 1.55 }}>
                    In questa finestra puoi vedere gli account attivi e aggiornare la password archivio (nota operativa). Per
                    gestione avanzata resta disponibile la{" "}
                    <Link to={`/superadmin/tenants/${modal.id}/archivio-password`} style={{ fontWeight: 600 }}>
                      pagina dedicata «Archivio password»
                    </Link>
                    .
                  </p>

                  <div
                    style={{
                      border: "1px solid #e2e8f0",
                      borderRadius: 10,
                      padding: 14,
                      marginBottom: 20,
                      background: "#f8fafc",
                    }}
                  >
                    <h4 style={{ margin: "0 0 6px", fontSize: 14 }}>Crea account standard per questo tenant</h4>
                    <p style={{ margin: "0 0 10px", fontSize: 12.5, color: "#64748b", lineHeight: 1.55 }}>
                      Flagga solo i reparti che servono — i ruoli già collegati partono deselezionati. Password
                      generata ma modificabile; annotala prima di chiudere, qui resta visibile solo ora.
                    </p>
                    <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                      <button
                        type="button"
                        className="sa-table-action"
                        onClick={() => selezionaTutteStaffRow(true)}
                      >
                        Seleziona tutto
                      </button>
                      <button
                        type="button"
                        className="sa-table-action"
                        onClick={() => selezionaTutteStaffRow(false)}
                      >
                        Deseleziona tutto
                      </button>
                    </div>
                    <div style={{ overflowX: "auto", marginBottom: 12 }}>
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
                            <tr key={r.id} style={{ borderTop: "1px solid #e2e8f0", opacity: r.selezionata ? 1 : 0.5 }}>
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
                                  value={r.ruolo}
                                  onChange={(e) => updateStaffRow(r.id, { ruolo: e.target.value })}
                                  style={{ minWidth: 110 }}
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
                                  value={r.email}
                                  onChange={(e) => updateStaffRow(r.id, { email: e.target.value })}
                                  placeholder={`${r.ruolo}@${emailDomainForModal(modal)}`}
                                  style={{ ...inputStyle, minWidth: 200 }}
                                  autoComplete="off"
                                />
                              </td>
                              <td style={{ padding: "6px" }}>
                                <input
                                  type="text"
                                  value={r.nomeVisualizzato}
                                  onChange={(e) => updateStaffRow(r.id, { nomeVisualizzato: e.target.value })}
                                  placeholder="es. Marco"
                                  style={{ ...inputStyle, minWidth: 110 }}
                                  autoComplete="off"
                                />
                              </td>
                              <td style={{ padding: "6px" }}>
                                <input
                                  type="text"
                                  value={r.password}
                                  onChange={(e) => updateStaffRow(r.id, { password: e.target.value })}
                                  style={{ ...inputStyle, minWidth: 130, fontFamily: "monospace" }}
                                  spellCheck={false}
                                  autoComplete="off"
                                />
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
                    <button
                      type="button"
                      className="sa-table-action"
                      onClick={aggiungiStaffRow}
                      style={{ marginBottom: 12 }}
                    >
                      + Aggiungi riga
                    </button>
                    {staffResults ? (
                      <ul style={{ listStyle: "none", padding: 0, margin: "0 0 10px", display: "flex", flexDirection: "column", gap: 6 }}>
                        {staffResults.map((r, i) => (
                          <li
                            key={`${r.email}-${i}`}
                            style={{
                              fontSize: 12.5,
                              padding: "5px 8px",
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
                    <button
                      type="button"
                      className="btn-primary-dashboard"
                      disabled={staffBusy}
                      onClick={() => void handleCreaStaffBulk()}
                    >
                      {staffBusy ? "Creazione…" : "Crea account e collega ruoli"}
                    </button>
                  </div>

                  {archivio.loading ? (
                    <p style={{ fontSize: 14, color: "#64748b" }}>Caricamento account staff…</p>
                  ) : null}
                  {archivio.error ? (
                    <div className="dashboard-error" style={{ marginBottom: 12, fontSize: 13 }}>
                      {archivio.error}
                    </div>
                  ) : null}
                  {!archivio.loading && !archivio.error && archivio.ruoli.length === 0 ? (
                    <p style={{ fontSize: 14, color: "#64748b" }}>Nessun account staff collegato a questo tenant.</p>
                  ) : null}
                  {!archivio.loading && archivio.ruoli.length > 0 ? (
                    <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                      {archivio.ruoli.map((r) => (
                        <li
                          key={r.user_id}
                          style={{
                            padding: "14px 0",
                            borderBottom: "1px solid #e2e8f0",
                          }}
                        >
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{labelFromEmailPrefix(r.email)}</div>
                          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>
                            {r.email} · ruolo: {r.ruolo}
                            {r.archivio_tipo === "cliente" ? " · area cliente" : " · Utente attivo sul tenant"}
                          </div>
                          <label style={labelStyle}>Password archivio (nota interna)</label>
                          <textarea
                            value={archivio.drafts[r.user_id] ?? ""}
                            onChange={(e) =>
                              setArchivio((a) => ({
                                ...a,
                                drafts: { ...a.drafts, [r.user_id]: e.target.value },
                              }))
                            }
                            rows={2}
                            style={{ ...inputStyle, resize: "vertical", minHeight: 52 }}
                            autoComplete="off"
                            spellCheck={false}
                          />
                          <div style={{ marginTop: 8, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                            <button
                              type="button"
                              className="sa-table-action"
                              disabled={archivio.savingUserId === r.user_id}
                              onClick={() => saveArchivioNote(r.user_id, archivio.drafts[r.user_id] ?? "")}
                            >
                              {archivio.savingUserId === r.user_id ? "Salvataggio…" : "Salva nota"}
                            </button>
                            <button
                              type="button"
                              className="sa-table-action"
                              disabled={applyingUserId === r.user_id}
                              onClick={() =>
                                applyPasswordReale(r.user_id, archivio.drafts[r.user_id], labelFromEmailPrefix(r.email) || r.email)
                              }
                              title="Sovrascrive la password reale dell'account su Supabase con il testo qui sopra"
                            >
                              {applyingUserId === r.user_id ? "Applico…" : "🔑 Applica su Supabase"}
                            </button>
                          </div>
                          {applyMsg[r.user_id] ? (
                            <p
                              style={{
                                margin: "6px 0 0",
                                fontSize: 12,
                                color: applyMsg[r.user_id].ok ? "#166534" : "#b91c1c",
                              }}
                            >
                              {applyMsg[r.user_id].ok ? "✓ " : "✕ "}
                              {applyMsg[r.user_id].testo}
                            </p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </section>
              ) : null}

              {modalTab === "canone" ? (
                <section className="sa-form-section">
                <h3 className="sa-form-section-title">Abbonamento e pagamento</h3>
                <p style={{ margin: "0 0 14px", fontSize: 13, color: "#64748b", lineHeight: 1.55, maxWidth: 720 }}>
                  Il <strong>prossimo rinnovo</strong> (pagina Abbonamenti) si calcola dalla{" "}
                  <strong>data di attivazione</strong> con <strong>mesi di calendario</strong>: un mese dopo per il
                  mensile, dodici mesi dopo per l&apos;annuale (non giorni fissi: febbraio, mesi da 30/31, ecc.). In caso
                  annuale puoi registrare uno <strong>sconto %</strong> sul totale delle 12 mensilità (unica rata); il
                  listino può suggerire lo stesso sconto in <strong>Piani</strong>.
                </p>
                <div className="sa-callout-muted">
                  <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={modal.addebito_automatico_mensile}
                      onChange={(e) => setModalField("addebito_automatico_mensile", e.target.checked)}
                      style={{ marginTop: 3, width: 18, height: 18 }}
                    />
                    <span style={{ fontSize: 14, color: "#334155", lineHeight: 1.45 }}>
                      <strong>Addebito / rinnovo automatico</strong>
                      <br />
                      Allineato al ciclo scelto (mensile o annuale in mesi solari); gateway di pagamento da configurare.
                    </span>
                  </label>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
                  <div>
                    <label style={labelStyle}>Data attivazione / primo addebito</label>
                    <input
                      type="date"
                      value={modal.data_attivazione_abbonamento}
                      onChange={(e) => setModalField("data_attivazione_abbonamento", e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Ciclo fatturazione</label>
                    <select
                      value={String(modal.abbonamentoCicloGiorni ?? 30)}
                      onChange={(e) => setModalField("abbonamentoCicloGiorni", Number(e.target.value))}
                      style={inputStyle}
                    >
                      <option value="30">Mensile (1 mese di calendario)</option>
                      <option value="365">Annuale (12 mesi di calendario, una rata)</option>
                    </select>
                  </div>
                  {Number(modal.abbonamentoCicloGiorni) === 365 ? (
                    <div>
                      <label style={labelStyle}>Sconto pagamento annuale (%)</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.5}
                        value={modal.abbonamentoScontoAnnualePercent}
                        onChange={(e) => setModalField("abbonamentoScontoAnnualePercent", e.target.value)}
                        style={inputStyle}
                        placeholder="es. 12"
                      />
                      <p style={{ margin: "6px 0 0", fontSize: 12, color: "#64748b" }}>
                        Applicato al totale 12× canone mensile (prima degli sconti commerciali sotto, se li usi a parte).
                      </p>
                    </div>
                  ) : null}
                  <div>
                    <label style={labelStyle}>Sconto sul canone (%)</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      value={modal.sconto_percentuale}
                      onChange={(e) => setModalField("sconto_percentuale", e.target.value)}
                      style={inputStyle}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Sconto fisso sul canone (€ / mese)</label>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={modal.sconto_importo_euro}
                      onChange={(e) => setModalField("sconto_importo_euro", e.target.value)}
                      style={inputStyle}
                      placeholder="0"
                    />
                    <p style={{ margin: "6px 0 0", fontSize: 12, color: "#64748b" }}>
                      Si applica sul totale dopo lo sconto percentuale; salvato con il cliente (parametri operativi).
                    </p>
                  </div>
                  <div>
                    <label style={labelStyle}>Scadenza promozione (opzionale)</label>
                    <input
                      type="date"
                      value={modal.sconto_scadenza}
                      onChange={(e) => setModalField("sconto_scadenza", e.target.value)}
                      style={inputStyle}
                    />
                    <p style={{ margin: "6px 0 0", fontSize: 12, color: "#64748b" }}>
                      Vale sia per lo sconto percentuale sia per quello fisso sopra. Lascia vuoto per uno sconto senza
                      scadenza. Dopo questa data il canone stimato torna al listino pieno, senza cancellare i valori:
                      basta togliere la data (o metterne una futura) per riattivare la stessa promozione.
                    </p>
                  </div>
                </div>
              </section>
              ) : null}

              <div className="sa-modal-actions">
                <button type="button" onClick={closeModal} className="sa-btn-ghost">
                  Annulla
                </button>
                <button type="submit" disabled={saving} className="btn-primary-dashboard">
                  {saving ? "Salvataggio..." : "Salva"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
