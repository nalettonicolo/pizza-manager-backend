import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { usePv } from "@/app/contexts/PvContext";

export default function SelectPuntoVendita() {
  const [puntiVendita, setPuntiVendita] = useState([]);
  const { selectPv } = usePv(); // ✅ hook corretto

  useEffect(() => {
    fetchPuntiVendita();
  }, []);

  async function fetchPuntiVendita() {
    const { data, error } = await supabase
      .from("punti_vendita")
      .select("*");

    if (error) {
      console.error("Errore caricamento punti vendita:", error);
      return;
    }

    setPuntiVendita(data || []);
  }

  function handleSelect(pv) {
    selectPv(pv.id); // ✅ usa il context corretto
  }

  return (
    <div style={{ padding: "40px" }}>
      <h2>Seleziona Punto Vendita</h2>

      {puntiVendita.map((pv) => (
        <div
          key={pv.id}
          onClick={() => handleSelect(pv)}
          style={{
            padding: "20px",
            marginBottom: "15px",
            border: "1px solid #ddd",
            borderRadius: "8px",
            cursor: "pointer",
            background: "#fff",
          }}
        >
          <strong>{pv.nome}</strong>
          <div>{pv.indirizzo_principale}</div>
        </div>
      ))}
    </div>
  );
}
