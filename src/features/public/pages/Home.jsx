import { useMemo, useEffect, useState } from "react";
import DashboardNavCards from "@/components/dashboard/DashboardNavCards";
import { useAuth } from "@/app/contexts/AuthContext";
import { useTenant } from "@/app/contexts/TenantContext";
import { usePv } from "@/app/contexts/PvContext";
import { usePlan } from "@/app/hooks/usePlan";
import { useTenantServizi } from "@/app/hooks/useTenantServizi";
import { getTenantVenditeInsights } from "@/features/admin/services/adminService";

const HOME_NAV = [
  { to: "/select-pv", label: "Scegli punto vendita", description: "Seleziona la pizzeria" },
  { to: "/preview", label: "Anteprima", description: "Vedi l’app in anteprima" },
];

const ADMIN_NAV = [
  { to: "/admin/menu", label: "Menu e listino", description: "Categorie, pizze, ingredienti", servizioId: null },
  { to: "/admin/magazzino", label: "Magazzino", description: "Ordini fornitori e DDT", servizioId: "magazzino_gestione" },
  { to: "/admin/contabilita", label: "Contabilità", description: "Fatture, food cost, spese, incassi", servizioId: "contabilita_locale" },
  { to: "/admin/settings", label: "Impostazioni", description: "Dati pizzeria, layout, parametri", servizioId: null },
  { to: "/admin/ruoli", label: "Ruoli", description: "Gestione ruoli e accessi", servizioId: "ruoli_avanzati" },
];

export default function Home() {
  const { ruolo } = useAuth();
  const { tenantData, tenantId } = useTenant();
  const [venditeInsights, setVenditeInsights] = useState(null);
  const { pvList } = usePv();
  const { plan, isPro, isEnterprise, canUseFeature } = usePlan();
  const { hasServizio } = useTenantServizi();
  const adminNavHome = useMemo(
    () => ADMIN_NAV.filter((item) => !item.servizioId || hasServizio(item.servizioId)),
    [hasServizio],
  );
  const homeNavItems = useMemo(
    () =>
      HOME_NAV.filter(
        (item) =>
          item.to !== "/select-pv" ||
          (canUseFeature("multi_punto_vendita") && pvList.length > 1),
      ),
    [canUseFeature, pvList],
  );

  const isAdmin = ruolo === "admin";

  useEffect(() => {
    if (!isAdmin || !tenantId) {
      setVenditeInsights(null);
      return;
    }
    let cancelled = false;
    const t = window.setTimeout(() => {
      getTenantVenditeInsights(tenantId)
        .then((d) => {
          if (!cancelled) setVenditeInsights(d);
        })
        .catch(() => {
          if (!cancelled) setVenditeInsights(null);
        });
    }, 1);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [isAdmin, tenantId]);
  const pianoLabel =
    plan === "PRO"
      ? "Pro"
      : plan === "ENTERPRISE"
        ? "Enterprise"
        : plan === "TRIAL"
          ? "Prova (14 giorni)"
          : plan === "FREE"
            ? "Free (legacy)"
            : plan

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-xl font-semibold text-gray-900 mb-2">Benvenuto</h1>
        <p className="text-sm text-gray-500 mb-4">
          {tenantData?.nome ? `Pizzeria: ${tenantData.nome}` : "Scegli dove andare."}
        </p>
        {(isPro || isEnterprise) && (
          <p className="text-xs text-gray-500 mb-4">
            Piano: <span className="font-medium text-gray-700">{pianoLabel}</span>
          </p>
        )}
        <DashboardNavCards items={homeNavItems} columns={2} />
        {isAdmin && (
          <>
            <h2 className="text-lg font-medium text-gray-800 mt-8 mb-3">Area admin</h2>
            <DashboardNavCards items={adminNavHome} columns={2} />
            {venditeInsights && venditeInsights.ordiniAnalizzati > 0 && (
              <section className="mt-8 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                <h3 className="text-base font-semibold text-gray-900 mb-1">Statistiche vendite (campione recente)</h3>
                <p className="text-xs text-gray-500 mb-4">
                  Basate sugli ultimi {venditeInsights.ordiniAnalizzati} ordini del locale (quantità per prodotto e clienti con più ordini).
                </p>
                <div className="grid gap-6 sm:grid-cols-2">
                  <div>
                    <h4 className="text-sm font-medium text-gray-800 mb-2">Pizze / prodotti più venduti</h4>
                    <ol className="list-decimal list-inside text-sm text-gray-700 space-y-1">
                      {venditeInsights.topProducts.map((p) => (
                        <li key={p.id}>
                          {p.nome} — <span className="font-medium">{p.qty}</span> pz.
                        </li>
                      ))}
                    </ol>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-800 mb-2">Clienti con più ordini (chiave nome / indirizzo)</h4>
                    <ol className="list-decimal list-inside text-sm text-gray-700 space-y-1">
                      {venditeInsights.clientiTop.map((c, i) => (
                        <li key={i}>
                          {c.label} — <span className="font-medium">{c.ordini}</span> ord.
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
