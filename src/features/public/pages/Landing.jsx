import { Link } from "react-router-dom"
import LandingPlansSection from "@/features/public/components/LandingPlansSection"
import FaqSection from "@/features/public/components/FaqSection"
import SoftwareApplicationSchema from "@/features/public/components/SoftwareApplicationSchema"
import "../../../styles/landing.css"

export default function Landing() {
  return (
    <div className="landing-wrapper">
      <div className="landing-bg" aria-hidden="true" />

      <section className="hero">
        <div className="hero-text">
          <p className="hero-badge">Gestionale per pizzerie</p>
          <h1>
            La tua pizzeria,{" "}
            <span className="hero-gradient">finalmente sotto controllo</span>
          </h1>
          <p className="hero-desc">
            Basta comande urlate in cucina, ordini persi su un foglietto, il fattorino che non sai
            dove sia arrivato. PizzaManager mette cassa, cucina, banco e consegne sullo stesso
            sistema, in tempo reale: quando prendi un ordine, tutto il tuo staff lo vede all’istante.
          </p>

          <div className="hero-buttons">
            <Link to="/contatti#prova-gratuita" className="btn-primary big">
              Registrati ora
            </Link>
            <Link to="/login" className="btn-outline big">
              Accedi al pannello
            </Link>
          </div>
          <p className="hero-hint">
            La licenza di prova si attiva contattando l’admin: ricevi credenziali dedicate per
            entrare in app.
          </p>

          <ul className="hero-trust" aria-label="Punti di forza">
            <li>
              <span className="trust-dot" /> Tempo reale tra le postazioni
            </li>
            <li>
              <span className="trust-dot" /> Cassa anche senza internet
            </li>
            <li>
              <span className="trust-dot" /> Consegne e forno sotto controllo
            </li>
          </ul>
        </div>

        <div className="hero-visual">
          <div className="hero-card hero-card-float">
            <div className="mock-kpi-row">
              <div className="mock-kpi">
                <span className="mock-kpi-label">Ordini live</span>
                <span className="mock-kpi-value">24</span>
              </div>
              <div className="mock-kpi mock-kpi-accent">
                <span className="mock-kpi-label">In coda cucina</span>
                <span className="mock-kpi-value">7</span>
              </div>
            </div>
            <div className="mock-pipeline">
              <div className="mock-stage">
                <span className="mock-stage-title">Cassa</span>
                <div className="mock-chip">#1042 Bancone</div>
                <div className="mock-chip dim">#1043 Delivery</div>
              </div>
              <div className="mock-stage mock-stage-hot">
                <span className="mock-stage-title">Cucina</span>
                <div className="mock-chip">3 in lavorazione</div>
              </div>
              <div className="mock-stage">
                <span className="mock-stage-title">Consegna</span>
                <div className="mock-chip ok">2 in viaggio</div>
              </div>
            </div>
            <div className="mock-footer-bar">
              <span className="mock-sync">Sync attivo</span>
              <span className="mock-dots" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
            </div>
          </div>
          <p className="hero-visual-caption">Un ordine preso → tutto lo staff lo vede subito</p>
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
