import { useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/app/contexts/AuthContext";
import { useTenant } from "@/app/contexts/TenantContext";
import { usePv } from "@/app/contexts/PvContext";
import Loader from "@/components/feedback/Loader";
import { getOperativeHomePathForStaff } from "@/constants/operativeRoutes";
import { ADMIN_TENANT_HOME } from "@/constants/adminTenantHome";

function postSelectPath(ruolo, email) {
  const r = (ruolo && String(ruolo).toLowerCase().trim()) || "";
  if (r === "admin") return ADMIN_TENANT_HOME;
  if (r === "superadmin") return "/superadmin/ingresso";
  return getOperativeHomePathForStaff(ruolo, email);
}

export default function SelectPuntoVendita() {
  const navigate = useNavigate();
  const autoSinglePvRef = useRef(false);
  const { user, loading: authLoading, tipoUtente, ruolo } = useAuth();
  const { tenantId } = useTenant();
  const { pvList, selectPv, loading: pvLoading } = usePv();

  const staff = tipoUtente === "staff";
  const loading = authLoading || (staff && !!tenantId && pvLoading);

  useEffect(() => {
    if (authLoading || pvLoading || !user || !staff || !tenantId || autoSinglePvRef.current) return;
    if (pvList.length !== 1) return;
    autoSinglePvRef.current = true;
    selectPv(pvList[0].id);
    navigate(postSelectPath(ruolo, user?.email), { replace: true });
  }, [authLoading, pvLoading, user, staff, tenantId, pvList, ruolo, navigate, selectPv]);

  if (authLoading) {
    return <Loader />;
  }

  if (!user || !staff) {
    return (
      <div style={{ padding: 40, maxWidth: 520, margin: "0 auto" }}>
        <h2 className="dashboard-page-title" style={{ fontSize: 22, marginBottom: 12 }}>
          Seleziona punto vendita
        </h2>
        <p style={{ color: "#64748b", marginBottom: 20, lineHeight: 1.55 }}>
          Accedi con un account staff della pizzeria per scegliere il punto vendita.
        </p>
        <Link
          to="/login"
          style={{
            display: "inline-block",
            padding: "10px 20px",
            background: "#d35400",
            color: "#fff",
            borderRadius: 6,
            textDecoration: "none",
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          Vai al login
        </Link>
      </div>
    );
  }

  if (!tenantId) {
    return (
      <div style={{ padding: 40, maxWidth: 520, margin: "0 auto" }}>
        <h2 className="dashboard-page-title" style={{ fontSize: 22, marginBottom: 12 }}>
          Seleziona punto vendita
        </h2>
        <p style={{ color: "#64748b", lineHeight: 1.55 }}>
          Nessun profilo pizzeria associato a questo utente. Verifica in Supabase che esista una riga in{" "}
          <code style={{ fontSize: 12 }}>utenti_ruoli</code> con il tuo utente e un <code style={{ fontSize: 12 }}>tenant_id</code>{" "}
          valido.
        </p>
      </div>
    );
  }

  if (pvLoading) {
    return <Loader />;
  }

  const ruoloKey = (ruolo && String(ruolo).toLowerCase().trim()) || "";
  const isAdmin = ruoloKey === "admin";

  function handleSelect(pv) {
    selectPv(pv.id);
    navigate(postSelectPath(ruolo, user?.email), { replace: true });
  }

  return (
    <div style={{ padding: "40px 24px", maxWidth: 640, margin: "0 auto" }}>
      <h2 className="dashboard-page-title" style={{ fontSize: 22, marginBottom: 8 }}>
        Seleziona punto vendita
      </h2>
      <p style={{ color: "#64748b", fontSize: 14, marginBottom: 24, lineHeight: 1.55 }}>
        Scegli il locale con cui vuoi operare. Con un solo punto vendita verrai reindirizzato automaticamente.
      </p>

      {pvList.length === 0 ? (
        <div
          style={{
            padding: 20,
            borderRadius: 8,
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            color: "#475569",
            fontSize: 14,
            lineHeight: 1.6,
          }}
        >
          <p style={{ margin: "0 0 12px" }}>
            Non risultano punti vendita per questa pizzeria (nessuna riga in{" "}
            <code style={{ fontSize: 12 }}>punti_vendita</code> per il tuo tenant).
          </p>
          {isAdmin ? (
            <p style={{ margin: 0 }}>
              Inserisci i punti vendita dal database (tabella <code style={{ fontSize: 12 }}>punti_vendita</code>, campo{" "}
              <code style={{ fontSize: 12 }}>tenant_id</code>) oppure apri{" "}
              <Link to={ADMIN_TENANT_HOME} style={{ color: "#c2410c", fontWeight: 600 }}>
                Admin
              </Link>{" "}
              dopo averli creati.
            </p>
          ) : (
            <p style={{ margin: 0 }}>Chiedi a un amministratore della pizzeria di configurare almeno un punto vendita.</p>
          )}
        </div>
      ) : (
        pvList.map((pv) => (
          <button
            key={pv.id}
            type="button"
            onClick={() => handleSelect(pv)}
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              padding: 20,
              marginBottom: 12,
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              cursor: "pointer",
              background: "#fff",
              font: "inherit",
              boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
            }}
          >
            <strong style={{ display: "block", color: "#0f172a", marginBottom: 4 }}>{pv.nome || "Punto vendita"}</strong>
            {pv.indirizzo_principale ? (
              <span style={{ fontSize: 14, color: "#64748b" }}>{pv.indirizzo_principale}</span>
            ) : null}
          </button>
        ))
      )}
    </div>
  );
}
