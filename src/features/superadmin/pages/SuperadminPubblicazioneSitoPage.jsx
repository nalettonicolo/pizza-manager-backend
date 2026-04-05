import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import PubblicazioneSitoWorkspace from "@/features/pubblicazione/PubblicazioneSitoWorkspace";
import { getTenants } from "@/features/superadmin/services/superadminService";

const labelStyle = { display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6, color: "#475569" };
const inputStyle = {
  width: "100%",
  maxWidth: 420,
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  fontSize: 14,
  background: "#fff",
  boxSizing: "border-box",
};

export default function SuperadminPubblicazioneSitoPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tenantId, setTenantId] = useState("");

  const loadTenants = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getTenants();
      setTenants(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e?.message ?? "Errore caricamento clienti");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTenants();
  }, [loadTenants]);

  useEffect(() => {
    const q = searchParams.get("tenant");
    if (!q) {
      setTenantId("");
      return;
    }
    if (!tenants.length) return;
    setTenantId(tenants.some((t) => t.id === q) ? q : "");
  }, [searchParams, tenants]);

  const onSelectTenant = (id) => {
    setTenantId(id);
    if (id) setSearchParams({ tenant: id });
    else setSearchParams({});
  };

  return (
    <div className="dashboard-settings-page">
      <header className="sa-page-header" style={{ marginBottom: 20 }}>
        <p className="sa-page-kicker">Super Admin · go-live</p>
        <h1 className="dashboard-page-title sa-page-title">Pubblicazione dominio tenant</h1>
        <p className="sa-page-lede">
          Guida deploy, DNS, Firebase e salvataggio dominio / stato: solo dalla console piattaforma, con scelta del
          cliente.
        </p>
      </header>

      <div
        style={{
          marginBottom: 24,
          padding: 16,
          borderRadius: 10,
          border: "1px solid #e2e8f0",
          background: "#f8fafc",
        }}
      >
        <label style={labelStyle} htmlFor="sa-pubblicazione-tenant">
          Cliente (tenant)
        </label>
        {loading ? (
          <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>Caricamento elenco…</p>
        ) : error ? (
          <p style={{ margin: 0, fontSize: 14, color: "#b91c1c" }}>{error}</p>
        ) : (
          <select
            id="sa-pubblicazione-tenant"
            value={tenantId}
            onChange={(e) => onSelectTenant(e.target.value)}
            style={inputStyle}
          >
            <option value="">— Seleziona un cliente —</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome || t.slug || t.id}
              </option>
            ))}
          </select>
        )}
        <p style={{ margin: "10px 0 0", fontSize: 13, color: "#64748b" }}>
          Collegata a{" "}
          <Link to="/superadmin/deploy-clienti" style={{ fontWeight: 600 }}>
            Deploy siti
          </Link>{" "}
          e{" "}
          <Link to="/superadmin/tenants" style={{ fontWeight: 600 }}>
            Clienti
          </Link>
          . Puoi aprire questa pagina con <code>?tenant=UUID</code> dal bookmark.
        </p>
      </div>

      {tenantId ? (
        <PubblicazioneSitoWorkspace tenantId={tenantId} />
      ) : (
        <p style={{ fontSize: 14, color: "#64748b" }}>Seleziona un cliente per configurare dominio, stato e guida tecnica.</p>
      )}
    </div>
  );
}
