import { useEffect, useLayoutEffect, useRef } from "react"
import { Link } from "react-router-dom"
import gsap from "gsap"
import Lenis from "lenis"
import LandingPlansSection from "@/features/public/components/LandingPlansSection"
import FaqSection from "@/features/public/components/FaqSection"
import SoftwareApplicationSchema from "@/features/public/components/SoftwareApplicationSchema"
import "@fontsource-variable/fraunces/wght.css"
import "@fontsource-variable/fraunces/wght-italic.css"
import "@fontsource/ibm-plex-sans/400.css"
import "@fontsource/ibm-plex-sans/600.css"
import "@fontsource/ibm-plex-mono/500.css"
import "@fontsource/ibm-plex-mono/700.css"
import "lenis/dist/lenis.css"
import "../../../styles/landing.css"
import "../../../styles/landing-forno.css"

export default function Landing() {
  const heroRef = useRef(null)

  // Entrata dell'apertura: il testo sale, il forno si accende, le comande scendono dalla rotaia.
  // Con "riduci movimento" non parte nulla e tutto resta fermo al suo posto.
  useLayoutEffect(() => {
    const mm = gsap.matchMedia()
    mm.add(
      "(prefers-reduced-motion: no-preference)",
      () => {
        const tl = gsap.timeline({ defaults: { ease: "power3.out" } })
        tl.from(".forno-hero__testo > *", { autoAlpha: 0, y: 24, duration: 0.7, stagger: 0.08 })
          .from(".forno-arco", { autoAlpha: 0, y: 40, duration: 0.8 }, 0.15)
          .from(
            ".forno-comande__voce",
            {
              autoAlpha: 0,
              y: -60,
              rotation: (i) => [-6, 5, -4][i % 3],
              transformOrigin: "50% 0",
              duration: 0.9,
              ease: "back.out(1.4)",
              stagger: 0.14,
            },
            0.5,
          )
          .from(".forno-hero__piede", { autoAlpha: 0, duration: 0.6 }, "-=0.3")
      },
      heroRef,
    )
    return () => mm.revert()
  }, [])

  // Scorrimento fluido solo con mouse (computer): su telefono resta quello nativo.
  // Lenis rispetta da solo "riduci movimento"; allowNestedScroll lascia scorrere la chat dell'assistente.
  useEffect(() => {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return undefined
    const lenis = new Lenis({ autoRaf: true, allowNestedScroll: true })
    return () => lenis.destroy()
  }, [])

  return (
    <div className="landing-wrapper">
      <div className="landing-bg" aria-hidden="true" />

      <section className="forno-hero" ref={heroRef}>
        <div className="forno-hero__inner">
          <div className="forno-hero__testo">
            <p className="forno-etichetta">Gestionale per pizzerie</p>
            <h1>
              La tua pizzeria, <em>finalmente sotto controllo</em>
            </h1>
            <p className="forno-hero__desc">
              Basta comande urlate in cucina, ordini persi su un foglietto, il fattorino che non sai
              dove sia arrivato. PizzaManager mette cassa, cucina, banco e consegne sullo stesso
              sistema, in tempo reale: quando prendi un ordine, tutto il tuo staff lo vede all’istante.
            </p>

            <div className="forno-hero__azioni">
              <Link to="/contatti#prova-gratuita" className="forno-btn forno-btn--pieno">
                Registrati ora
              </Link>
              <Link to="/login" className="forno-btn">
                Accedi al pannello
              </Link>
            </div>
            <p className="forno-hero__nota">
              La licenza di prova si attiva contattando l’admin: ricevi credenziali dedicate per
              entrare in app.
            </p>

            <ul className="forno-punti" aria-label="Punti di forza">
              <li>Tempo reale tra le postazioni</li>
              <li>Consegne e forno sotto controllo</li>
            </ul>
          </div>

          <div className="forno-arco">
            <div className="forno-arco__bocca">
              <div className="forno-dato">
                <span className="forno-dato__etichetta">In coda cucina</span>
                <span className="forno-dato__valore">7</span>
              </div>
              <div className="forno-dato">
                <span className="forno-dato__etichetta">Ordini live</span>
                <span className="forno-dato__valore">24</span>
              </div>
            </div>
          </div>

          <div className="forno-rail">
            <ul className="forno-comande">
              <li className="forno-comande__voce" style={{ "--r": "-1.5deg" }}>
                <div className="forno-comanda">
                  <span className="forno-comanda__titolo">Cassa</span>
                  <p className="forno-comanda__riga">#1042 Bancone</p>
                  <p className="forno-comanda__riga">#1043 Delivery</p>
                </div>
              </li>
              <li className="forno-comande__voce" style={{ "--r": "1deg" }}>
                <div className="forno-comanda forno-comanda--calda">
                  <span className="forno-comanda__titolo">Cucina</span>
                  <p className="forno-comanda__riga">3 in lavorazione</p>
                </div>
              </li>
              <li className="forno-comande__voce" style={{ "--r": "-1deg" }}>
                <div className="forno-comanda">
                  <span className="forno-comanda__titolo">Consegna</span>
                  <p className="forno-comanda__riga">2 in viaggio</p>
                </div>
              </li>
            </ul>
          </div>

          <p className="forno-hero__piede">
            <span>Un ordine preso → tutto lo staff lo vede subito</span>
            <span className="forno-sync">Sync attivo</span>
          </p>
        </div>
      </section>

      <section id="perche" className="section-stats">
        <div className="stat-strip">
          <div className="stat-strip-item">
            <strong>Un solo sistema</strong>
            <span>Cassa, cucina, banco e consegne allineati</span>
          </div>
          <div className="stat-strip-item">
            <strong>Sempre operativo</strong>
            <span>Anche se salta internet il venerdì sera</span>
          </div>
          <div className="stat-strip-item">
            <strong>Cassa che torna</strong>
            <span>Apertura e chiusura turno senza calcoli a mano</span>
          </div>
        </div>
      </section>

      <section id="funzionalita" className="section-bento">
        <div className="section-head">
          <p className="section-eyebrow">Cosa risolve in sala</p>
          <h2 className="section-title">Dal foglietto al controllo, senza caos</h2>
          <p className="section-lead">
            Funzioni pensate per il servizio reale: meno urla, meno ordini persi, più chiarezza su
            forno, cassa e fattorini.
          </p>
        </div>

        <div className="bento-grid">
          <article className="bento bento-large">
            <h3>Non perdi mai un ordine</h3>
            <p>
              Anche se salta internet un venerdì sera pieno, la cassa continua a funzionare e invia
              tutto da sola appena torna la rete.
            </p>
          </article>
          <article className="bento">
            <h3>Sai sempre se la cassa torna</h3>
            <p>
              Apri il turno, lavora, chiudi indicando quanto c’è in cassa: il sistema ti dice subito
              se combacia, senza calcoli a mano a fine serata.
            </p>
          </article>
          <article className="bento">
            <h3>I clienti ordinano da soli</h3>
            <p>
              Vetrina online, pagamento con carta o link WhatsApp, o contanti alla consegna —
              decidi tu. Tu risparmi tempo al telefono.
            </p>
          </article>
          <article className="bento bento-wide">
            <h3>Le consegne non sono più un’incognita</h3>
            <p>
              Disegni tu l’area che copri: un indirizzo fuori zona viene segnalato subito. E vedi in
              tempo reale dove sono i tuoi fattorini sulla mappa.
            </p>
          </article>
          <article className="bento">
            <h3>Ogni pizza al momento giusto</h3>
            <p>
              Il sistema conta da solo quante pizze stai preparando per fascia oraria, così non
              accetti mai più ordini di quanti il forno ne regga.
            </p>
          </article>
          <article className="bento">
            <h3>Cresci senza cambiare sistema</h3>
            <p>
              Un secondo locale? Stesso account, dati sempre separati e al sicuro.
            </p>
          </article>
        </div>
      </section>

      <section className="section-roles">
        <div className="section-head">
          <p className="section-eyebrow">Staff sullo stesso ritmo</p>
          <h2 className="section-title">Quando prendi un ordine, lo vedono tutti</h2>
          <p className="section-lead section-lead-roles">
            Cassa, cucina, banco e consegne non sono più mondi separati: un solo flusso in tempo
            reale, così la cucina non aspetta e nemmeno il tuo gestionale dovrebbe farlo.
          </p>
        </div>
        <div className="roles-grid roles-grid-two">
          <div className="role-card role-card-highlight">
            <span className="role-tag">Gestione</span>
            <h3>Titolare e amministratori</h3>
            <p>
              Menu, orari, area consegna, turni cassa e permessi: il pannello di comando del tuo
              locale, con i dati isolati e al sicuro.
            </p>
          </div>
          <div className="role-card">
            <span className="role-tag">Sala &amp; cucina</span>
            <h3>Operatori</h3>
            <p>
              Schermate per cassa, cucina, bancone e delivery: velocità in servizio, meno errori,
              meno foglietti.
            </p>
          </div>
        </div>
      </section>

      <LandingPlansSection />

      <FaqSection />
      <SoftwareApplicationSchema />

      <section className="cta-block">
        <div className="cta-inner">
          <h2>PizzaManager. La cucina non aspetta, e nemmeno il tuo gestionale dovrebbe farlo.</h2>
          <p>Porta il tuo locale sotto controllo: dalla singola sede al secondo punto vendita.</p>
          <div className="cta-buttons">
            <Link to="/contatti#prova-gratuita" className="btn-primary big">
              Richiedi prova o demo
            </Link>
            <Link to="/login" className="btn-ghost big">
              Accedi al pannello
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
