import { useEffect, useLayoutEffect, useRef, useState } from "react";
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
  // Lettura iniziale subito (stessa funzione di prima): così i piani sono già nel primo disegno
  // e la comparsa allo scorrimento non scatta due volte.
  const [payload, setPayload] = useState(() => getActivePlansForMarketing());
  const sectionRef = useRef(null);

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

  // Comparsa allo scorrimento: leggera (opacità + 18 px di spostamento), solo se il browser la
  // supporta e l'utente non ha chiesto "riduci movimento". Senza JS o con movimento ridotto
  // tutto è subito visibile.
  useLayoutEffect(() => {
    const root = sectionRef.current;
    if (!root) return undefined;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !("IntersectionObserver" in window)) return undefined;

    root.classList.add("is-armed");
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            io.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.1 },
    );
    root.querySelectorAll(".forno-reveal").forEach((el) => io.observe(el));
    return () => {
      io.disconnect();
      root.classList.remove("is-armed");
      root.querySelectorAll(".forno-reveal").forEach((el) => el.classList.remove("is-in"));
    };
  }, [plans.length]);

  return (
    <section id="piani" className="forno-piani" ref={sectionRef}>
      <div className="forno-piani__inner">
        <div className="forno-piani__testa forno-reveal">
          <p className="forno-etichetta">Piani chiari</p>
          <h2 className="forno-piani__titolo">Scala quando sei pronto</h2>
          <p className="forno-piani__sottotitolo">
            Nessun piano “free” permanente: inizi con <strong>14 giorni di prova</strong> sul{" "}
            <strong>piano che scegli</strong>, poi prosegui con l’abbonamento relativo. Le offerte qui sotto riflettono i
            piani configurati in console (stesso browser se hai salvato listino e catalogo).
            <br />
            <strong>Il dominio del tuo sito lo gestiamo noi</strong>: nessun pensiero tecnico, ce ne occupiamo
            direttamente per te.
          </p>
        </div>

        <div className="forno-piani__corpo">
          <div className="forno-prova forno-reveal">
            <div className="forno-prova__scatola">
              <div className="forno-comanda">
                <span className="forno-timbro">Per iniziare</span>
                <span className="forno-prova__nome">Prova 14 giorni</span>
                <span className="forno-prova__cifra">14 giorni</span>
                <p className="forno-prova__desc">Scegli il piano e provalo per 14 giorni</p>
                <ul className="forno-elenco">
                  <li>Accesso al piano selezionato (Base / Pro / Enterprise, …)</li>
                  <li>Non è un piano a tempo indeterminato: serve per decidere</li>
                  <li>Al termine attivi un piano a pagamento con l’admin</li>
                </ul>
                <Link to="/contatti#prova-gratuita" className="forno-btn forno-btn--pieno">
                  Richiedi la prova
                </Link>
              </div>
            </div>
          </div>

          <div className="forno-lavagna">
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
                <article key={p.id} className="forno-piano forno-reveal">
                  <div className="forno-piano__riga">
                    <h3 className="forno-piano__nome">{p.nome}</h3>
                    {annualHint ? (
                      <>
                        <span className="forno-piano__punti" aria-hidden="true" />
                        <span className="forno-piano__prezzo">{annualHint}</span>
                      </>
                    ) : null}
                  </div>
                  {validita ? <p className="forno-piano__validita">{validita}</p> : null}
                  {p.descrizione ? <p className="forno-piano__desc">{p.descrizione}</p> : null}
                  {incl.length > 0 ? (
                    <ul className="forno-elenco">
                      {incl.map((s) => (
                        <li key={s.id}>{s.nome}</li>
                      ))}
                    </ul>
                  ) : (
                    <ul className="forno-elenco">
                      <li>Servizi da comporre con l&apos;amministratore (piano su misura)</li>
                    </ul>
                  )}
                  <Link to={contattiHref} className="forno-btn">
                    Richiedi informazioni
                  </Link>
                </article>
              );
            })}
          </div>
        </div>

        <p className="forno-nota forno-reveal">
          Gli abbonamenti includono aggiornamenti del prodotto. Per prova, preventivo o composizione su misura usa la
          pagina Contatti: puoi indicare il piano o i moduli desiderati. I listini pubblici senza cifre possono variare in
          base alla configurazione salvata in console (stesso browser).
        </p>
      </div>
    </section>
  );
}
