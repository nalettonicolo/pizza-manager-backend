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
          Da <strong>Piani</strong> apri una finestra per ogni piano: nome, canone mensile (somma servizi),{" "}
          <strong>validità listino in mesi di calendario</strong> (di norma 1 mese),{" "}
          <strong>sconto opzionale sull&apos;abbonamento annuale</strong>{" "}
          (anticipo 12 mensilità), abilitazione, descrizione e <strong>servizi inclusi</strong>. Non esiste un piano free
          permanente: i nuovi clienti partono con la <strong>prova di 14 giorni</strong>. Il ciclo mensile/annuale sul
          cliente si imposta in <strong>Clienti → Abbonamento</strong>.
        </p>
        <Link to="/superadmin/piani" className="btn-primary-dashboard" style={{ display: "inline-block", textDecoration: "none" }}>
          Vai a Piani di abbonamento →
        </Link>
      </div>

      <div className="dashboard-box" style={{ maxWidth: 640, marginBottom: 24 }}>
        <h2 style={{ marginBottom: 4 }}>Navigazione</h2>
        <p style={{ margin: 0, fontSize: 14, color: "#555", lineHeight: 1.65 }}>
          Le altre aree della console (clienti, piani, abbonamenti, documentazione, ecc.) sono raggiungibili dalla{" "}
          <strong>barra in alto</strong>, senza ripetere qui l&apos;elenco delle voci.
        </p>
      </div>
    </>
  );
}
