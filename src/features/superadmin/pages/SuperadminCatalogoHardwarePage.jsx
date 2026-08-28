import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import CatalogoHardwareManager from "@/features/superadmin/components/CatalogoHardwareManager";
import { listAttrezzatureCatalogo } from "@/features/superadmin/services/noleggiAttrezzatureService";

/**
 * Pagina dedicata alla configurazione del catalogo Hardware (voce di menu Commerciale, come
 * "Catalogo servizi") — prima esisteva solo come sezione a comparsa dentro "Preventivi e
 * contratti", poco individuabile. Quella sezione resta comunque disponibile lì (sotto la
 * selezione del cliente) per comodità durante la compilazione di un preventivo.
 */
export default function SuperadminCatalogoHardwarePage() {
  const [catalogo, setCatalogo] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const cat = await listAttrezzatureCatalogo({});
      setCatalogo(cat);
    } catch (err) {
      setError(err?.message || "Impossibile caricare il catalogo hardware.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="dashboard-settings-page">
      <header className="sa-page-header" style={{ marginBottom: 20 }}>
        <p className="sa-page-kicker">Super Admin · commerciale</p>
        <h1 className="dashboard-page-title sa-page-title">Catalogo Hardware</h1>
        <p className="sa-page-lede" style={{ maxWidth: 780 }}>
          Prodotti hardware (tablet, PC, stampanti, POS, …) con prezzi standard di noleggio mensile
          e/o vendita una tantum, usati in{" "}
          <Link to="/superadmin/preventivi-contratti">Preventivi e contratti</Link> — si scelgono lì
          prodotto, modalità e quantità, il prezzo arriva sempre da qui.
        </p>
      </header>

      {error ? <div className="dashboard-error" style={{ marginBottom: 16 }}>{error}</div> : null}

      <div className="dashboard-box" style={{ padding: 18 }}>
        {loading ? (
          <p style={{ fontSize: 13, color: "#64748b" }}>Caricamento…</p>
        ) : (
          <CatalogoHardwareManager catalogo={catalogo} onReload={load} />
        )}
      </div>
    </div>
  );
}
