import { useState } from "react";
import { useAuth } from "@/app/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";

/**
 * Il proprio account (admin del locale): email di accesso + cambio password.
 * Prima non esisteva nessuna pagina dentro Admin tenant per gestire la password del proprio
 * account — l'«Archivio password» in Super Admin mostra le credenziali per supporto, ma non è
 * un modo per l'admin del locale di cambiare la propria.
 */
export default function AccountSection() {
  const { user } = useAuth();
  const [password, setPassword] = useState("");
  const [conferma, setConferma] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  async function handleSave(e) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    if (password.length < 8) {
      setError("La password deve avere almeno 8 caratteri.");
      return;
    }
    if (password !== conferma) {
      setError("Le due password non coincidono.");
      return;
    }
    setSaving(true);
    try {
      const { error: updErr } = await supabase.auth.updateUser({ password });
      if (updErr) throw updErr;
      setPassword("");
      setConferma("");
      setMessage("Password aggiornata.");
    } catch (err) {
      setError(err?.message || "Errore durante l'aggiornamento della password.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="dashboard-settings-page">
      <h1 className="dashboard-page-title">Il mio account</h1>
      <section className="dashboard-box dashboard-settings-section">
        <p className="dashboard-settings-section-desc">
          Email di accesso e password del tuo account amministratore per questo locale.
        </p>
        <div style={{ marginBottom: 20 }}>
          <span style={{ fontSize: 13, color: "#64748b" }}>Email di accesso</span>
          <div style={{ fontSize: 15, fontWeight: 600, marginTop: 4 }}>{user?.email || "—"}</div>
        </div>
        <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 360 }}>
          <label>
            Nuova password
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Almeno 8 caratteri"
              style={{ marginTop: 6, padding: "8px 10px", width: "100%", boxSizing: "border-box" }}
            />
          </label>
          <label>
            Conferma nuova password
            <input
              type="password"
              autoComplete="new-password"
              value={conferma}
              onChange={(e) => setConferma(e.target.value)}
              style={{ marginTop: 6, padding: "8px 10px", width: "100%", boxSizing: "border-box" }}
            />
          </label>
          {error ? <p style={{ color: "#c0392b", fontSize: 13, margin: 0 }}>{error}</p> : null}
          {message ? <p style={{ color: "#2e7d32", fontSize: 13, margin: 0 }}>{message}</p> : null}
          <div>
            <button type="submit" className="btn-primary-dashboard" disabled={saving}>
              {saving ? "Salvataggio..." : "Aggiorna password"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
