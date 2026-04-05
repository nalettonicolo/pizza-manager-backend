import { useState } from "react";
import { apiClient } from "@/app/api/client";

export default function TurnoControl({ userId, tenantId, puntoVenditaId }) {
  const [loading, setLoading] = useState(false);

  const apriTurno = async () => {
    try {
      setLoading(true);
      await apiClient.post("/api/turni/apri", {
        userId,
        tenantId,
        puntoVenditaId,
      });
      alert("Turno aperto!");
    } catch (err) {
      alert(err.response?.data?.error || "Errore");
    } finally {
      setLoading(false);
    }
  };

  const chiudiTurno = async () => {
    try {
      setLoading(true);
      await apiClient.post("/api/turni/chiudi", {
        userId,
        tenantId,
      });
      alert("Turno chiuso!");
    } catch (err) {
      alert(err.response?.data?.error || "Errore");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button type="button" onClick={apriTurno} disabled={loading}>
        Apri Turno
      </button>

      <button type="button" onClick={chiudiTurno} disabled={loading}>
        Chiudi Turno
      </button>
    </div>
  );
}
