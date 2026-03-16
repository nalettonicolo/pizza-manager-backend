import { useEffect, useState } from "react";

import { useAuth } from "@/app/contexts/AuthContext";
import HeroStore from "@/features/public/components/HeroStore";
import Loader from "@/components/feedback/Loader";
import ErrorState from "@/components/feedback/ErrorState";
import ProductGrid from "@/features/operative/cassa/components/ProductGrid";

import { getPublicMenu, getPublicTenantInfo } from "@/features/services/publicService";

function isTodayClosed(orariSettimana) {
  if (!Array.isArray(orariSettimana) || !orariSettimana.length) return false;
  // In orari_settimana: giorno 0 = Lunedì ... 6 = Domenica
  const jsDay = new Date().getDay(); // 0=Dom ... 6=Sab
  const giornoKey = (jsDay + 6) % 7; // 0=Lun ... 6=Dom
  const row = orariSettimana.find(
    (o) => Number(o.giorno) === giornoKey
  );
  if (!row) return false;
  return !row.aperto;
}

export default function PublicStore() {
  const { user } = useAuth();
  const [menu, setMenu] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [closedToday, setClosedToday] = useState(false);
  const [tenantName, setTenantName] = useState(null);
  const [branding, setBranding] = useState(null);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [menuData, tenant] = await Promise.all([
          getPublicMenu(),
          getPublicTenantInfo(),
        ]);
        setMenu(menuData || []);
        if (tenant) {
          setTenantName(tenant.nome || null);
          if (tenant.orari_settimana) {
            setClosedToday(isTodayClosed(tenant.orari_settimana));
          }
          setBranding({
            nome: tenant.nome,
            logo_url: tenant.logo_url ?? null,
            indirizzo: tenant.indirizzo ?? null,
            ordinazione_attiva: true,
          });
        } else {
          setBranding(null);
        }
      } catch (err) {
        console.error(err);
        setError("Errore nel caricamento del menu.");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  if (loading) return <Loader />;
  if (error) return <ErrorState message={error} />;

  return (
    <div style={styles.wrapper}>
      <HeroStore branding={branding} />

      {closedToday && (
        <div style={styles.closedBanner}>
          Oggi {tenantName ? `la pizzeria ${tenantName}` : "la pizzeria"} è <strong>chiusa</strong>. Le ordinazioni online non sono disponibili.
        </div>
      )}

      <div style={styles.menuSection}>
        <h2 style={styles.menuTitle}>Menù</h2>
        {!user && (
          <p style={styles.loginHint}>Accedi per ordinare</p>
        )}
        <ProductGrid
          products={menu}
          ingredientiMap={menu.reduce((acc, p) => ({ ...acc, [p.id]: p.descrizione ? [p.descrizione] : [] }), {})}
          rowBackground="#f8f9fa"
          canAdd={!!user}
          onAdd={() => {}}
        />
      </div>
    </div>
  );
}

/* =========================
   STYLES
========================= */

const styles = {
  wrapper: {
    padding: "30px",
  },
  closedBanner: {
    marginTop: 24,
    marginBottom: 16,
    padding: "12px 16px",
    borderRadius: 8,
    background: "#fffbeb",
    border: "1px solid #fde68a",
    color: "#92400e",
    fontSize: 14,
  },
  menuSection: {
    marginTop: 30,
  },
  menuTitle: {
    marginBottom: 8,
    fontSize: 22,
    fontWeight: 600,
  },
  loginHint: {
    fontSize: 14,
    color: "#666",
    marginBottom: 12,
  },
};
