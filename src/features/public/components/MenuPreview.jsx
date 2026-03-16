import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { formatPrice } from "@/utils/format";

export default function MenuPreview({ branding }) {
  const [prodotti, setProdotti] = useState([]);
  const safe = branding ?? {};

  useEffect(() => {
    if (safe.id) loadMenu();
  }, [safe.id]);

  async function loadMenu() {
    if (!safe.id) return;
    const { data } = await supabase
      .from("Prodotto")
      .select("*")
      .eq("azienda_id", safe.id)
      .eq("attivo", true);

    setProdotti(data || []);
  }

  return (
    <section style={{ padding: "80px 20px", maxWidth: 1000, margin: "auto" }}>
      <h2 style={{ textAlign: "center", marginBottom: 40 }}>Il Nostro Menu</h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
          gap: 30,
        }}
      >
        {prodotti.map((item) => (
          <div
            key={item.id}
            style={{
              border: "1px solid #eee",
              borderRadius: 12,
              padding: 20,
              boxShadow: "0 5px 15px rgba(0,0,0,0.05)",
            }}
          >
            <h3>{item.nome}</h3>
            <p style={{ opacity: 0.7 }}>{item.descrizione}</p>
            <strong style={{ display: "block", marginTop: 10 }}>
              € {formatPrice(item.prezzo)}
            </strong>
          </div>
        ))}
      </div>
    </section>
  );
}
