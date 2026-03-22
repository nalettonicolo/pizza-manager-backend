import { useState } from "react";
import { Link } from "react-router-dom";

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid #ddd",
  borderRadius: 6,
  boxSizing: "border-box",
  fontSize: 14,
};
const labelStyle = { display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6, color: "#333" };

export default function Settings() {
  const [saved, setSaved] = useState(false);

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <Link
          to="/superadmin/dashboard"
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
          ← Torna al Riepilogo
        </Link>
      </div>
      <h1 className="dashboard-page-title">Impostazioni</h1>
      <p style={{ margin: "0 0 24px 0", fontSize: 15, color: "#555", maxWidth: 640 }}>
        Configura i parametri globali della piattaforma PizzaManager. Le modifiche si applicano a tutti i clienti (pizzerie) che usano il servizio.
      </p>

      <div className="dashboard-box" style={{ maxWidth: 640, marginBottom: 24 }}>
        <h2 style={{ marginBottom: 4 }}>Configurazione generale</h2>
        <p style={{ margin: "0 0 20px 0", fontSize: 14, color: "#666" }}>
          Nome dell’applicazione mostrato ai clienti e nei messaggi di sistema.
        </p>
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Nome applicazione</label>
          <input type="text" defaultValue="Pizzeria Manager" style={{ ...inputStyle, background: "#f5f5f5" }} readOnly disabled />
        </div>
        <button type="button" className="btn-primary-dashboard" onClick={() => setSaved(true)}>
          Salva impostazioni
        </button>
        {saved && <span style={{ marginLeft: 12, fontSize: 14, color: "#2e7d32" }}>Salvato (simulato).</span>}
      </div>

      <div className="dashboard-box" style={{ maxWidth: 640, marginBottom: 24 }}>
        <h2 style={{ marginBottom: 4 }}>Supporto</h2>
        <p style={{ margin: "0 0 20px 0", fontSize: 14, color: "#666" }}>
          Contatti e link mostrati ai clienti per assistenza (help, email supporto).
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={labelStyle}>URL pagina supporto</label>
            <input type="url" placeholder="https://support.pizzamanager.it" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Email supporto</label>
            <input type="email" placeholder="support@pizzamanager.it" style={inputStyle} />
          </div>
        </div>
      </div>

      <div className="dashboard-box" style={{ maxWidth: 640, marginBottom: 24 }}>
        <h2 style={{ marginBottom: 4 }}>Piani di abbonamento</h2>
        <p style={{ margin: "0 0 12px 0", fontSize: 14, color: "#666" }}>
          Crea e modifica i piani commerciali (nome, prezzo, cosa include ogni piano). Non esiste un piano free permanente: i nuovi clienti partono con la <strong>prova di 7 giorni</strong>, poi passano a un abbonamento. Ogni cliente è associato a un codice piano (es. Prova, Pro, Enterprise).
        </p>
        <Link to="/superadmin/piani" className="btn-primary-dashboard" style={{ display: "inline-block", textDecoration: "none" }}>
          Vai a Piani di abbonamento →
        </Link>
      </div>

      <div className="dashboard-box" style={{ maxWidth: 640, marginBottom: 24 }}>
        <h2 style={{ marginBottom: 4 }}>Stato piattaforma</h2>
        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, color: "#555", lineHeight: 1.8 }}>
          <li><strong>Riepilogo</strong> — Statistiche globali: numero clienti, abbonamenti attivi, ordini totali.</li>
          <li><strong>Clienti</strong> — Elenco pizzerie registrate; puoi creare, modificare e disattivare clienti.</li>
          <li><strong>Piani di abbonamento</strong> — Definizione dei piani e delle funzioni incluse; prova 7 giorni poi abbonamento.</li>
          <li><strong>Abbonamenti</strong> — Stato delle licenze per ogni cliente (attiva, scaduta, sospesa).</li>
          <li><strong>Impostazioni</strong> — Configurazione globale (supporto, nome app, parametri piattaforma).</li>
        </ul>
      </div>
    </>
  );
}
