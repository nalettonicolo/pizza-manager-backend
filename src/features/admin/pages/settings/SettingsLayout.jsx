import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { useTenant } from "@/app/contexts/TenantContext";
import Loader from "@/components/feedback/Loader";
import ErrorState from "@/components/feedback/ErrorState";
import { getTenantSettings } from "@/features/admin/services/adminService";

export default function SettingsLayout() {
  const { tenantId } = useTenant();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!tenantId) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const data = await getTenantSettings(tenantId);
        if (!cancelled) setSettings(data || {});
      } catch (err) {
        console.error(err);
        if (!cancelled) setError("Errore caricamento impostazioni.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tenantId]);

  if (loading) return <Loader />;
  if (error) return <ErrorState message={error} />;
  if (!settings) return null;

  return <Outlet context={{ settings, setSettings }} />;
}
