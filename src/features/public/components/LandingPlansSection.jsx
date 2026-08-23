import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  formatValiditaMesiLabel,
  getActivePlansForMarketing,
  inclusioniIncluded,
} from "@/features/superadmin/catalog/plansStorage";
import {
  formatEuroMonth,
  sumMonthlyFromInclusioni,
} from "@/features/superadmin/catalog/servicesStorage";

export default function LandingPlansSection() {
  const [payload, setPayload] = useState(null);

  useEffect(() => {
    const load = () => setPayload(getActivePlansForMarketing());
    load();
    const onStorage = (e) => {
      if (
        e.key === "pizzamanager_superadmin_plans_v2" ||
        e.key === "pizzamanager_superadmin_plans_v1" ||
        e.key === "pizzamanager_superadmin_services_v2" ||
        e.key === "pizzamanager_superadmin_services_v1"
      ) {
        load();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const plans = payload?.plans ?? [];
  const services = payload?.services ?? [];

  return (
    <section id="piani" className="pricing-section">
      <p className="pricing-badge">Piani chiari</p>
      <h2 className="pricing-title">Scala quando sei pronto</h2>
      <p className="pricing-subtitle">
        Nessun piano “free” permanente: inizi con <strong>14 giorni di prova</strong> sul{" "}
        <strong>piano che scegli</strong>, poi prosegui con l’abbonamento relativo. Le offerte qui sotto riflettono i
        piani configurati in console (stesso browser se hai salvato listino e catalogo).
        <br />
        <strong>Il dominio del tuo sito lo gestiamo noi</strong>: nessun pensiero tecnico, ce ne occupiamo
        direttamente per te.
      </p>
      <div className="pricing-grid pricing-grid--plans-catalog">
        <div className="pricing-card featured">
          <div className="pricing-card-header">
            <span className="pricing-tag">Per iniziare</span>
            <span className="pricing-name">Prova 14 giorni</span>
            <div className="pricing-price">
              <span className="pricing-amount">14 giorni</span>
            </div>
            <p className="pricing-desc">Scegli il piano e provalo per 14 giorni</p>
          </div>
          <ul className="pricing-features">
            <li>Accesso al piano selezionato (Base / Pro / Enterprise, …)</li>
            <li>Non è un piano a tempo indeterminato: serve per decidere</li>
            <li>Al termine attivi un piano a pagamento con l’admin</li>
          </ul>
          <Link to="/contatti#prova-gratuita" className="pricing-cta primary">
            Richiedi la prova
          </Link>
        </div>

        {plans.map((p) => {
          const incl = inclusioniIncluded(p.inclusioni, services);
          const validita =
            p.validitaMesi != null && Number.isFinite(Number(p.validitaMesi))
              ? `Validità listino: ${formatValiditaMesiLabel(p.validitaMesi)} (mesi di calendario)`
              : null;
          const monthly = sumMonthlyFromInclusioni(p.inclusioni, services);
          // Solo mensile in vetrina pubblica: niente sconto/opzione annuale mostrata al cliente.
          const annualHint = monthly > 0 ? `Da ${formatEuroMonth(monthly)}` : null;
          const contattiHref = `/contatti?piano=${encodeURIComponent(p.id)}#prova-gratuita`;

          return (
            <div key={p.id} className="pricing-card">
              <div className="pricing-card-header">
                <span className="pricing-name">{p.nome}</span>
                {validita ? (
                  <p className="pricing-period" style={{ margin: "8px 0 0", fontSize: 15, color: "var(--text-muted)" }}>
                    {validita}
                  </p>
                ) : null}
                {annualHint ? (
                  <p className="pricing-period" style={{ margin: "6px 0 0", fontSize: 14, color: "var(--text-muted)" }}>
                    {annualHint}
                  </p>
                ) : null}
                {p.descrizione ? <p className="pricing-desc">{p.descrizione}</p> : null}
              </div>
              {incl.length > 0 ? (
                <ul className="pricing-features">
                  {incl.map((s) => (
                    <li key={s.id}>{s.nome}</li>
                  ))}
                </ul>
              ) : (
                <ul className="pricing-features">
                  <li>Servizi da comporre con l&apos;amministratore (piano su misura)</li>
                </ul>
              )}
              <Link to={contattiHref} className="pricing-cta secondary">
                Richiedi informazioni
              </Link>
            </div>
          );
        })}
      </div>
      <p className="pricing-note">
        Gli abbonamenti includono aggiornamenti del prodotto. Per prova, preventivo o composizione su misura usa la
        pagina Contatti: puoi indicare il piano o i moduli desiderati. I listini pubblici senza cifre possono variare in
        base alla configurazione salvata in console (stesso browser).
      </p>
    </section>
  );
}
