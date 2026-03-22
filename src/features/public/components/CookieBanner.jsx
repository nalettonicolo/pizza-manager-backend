import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

const STORAGE_KEY = "pm_cookie_consent_v1";

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === "1") return;
    } catch {
      /* ignore */
    }
    setVisible(true);
  }, []);

  const accept = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="cookie-banner" role="dialog" aria-label="Informativa sui cookie" aria-live="polite">
      <div className="cookie-banner-inner">
        <p className="cookie-banner-text">
          Questo sito utilizza cookie tecnici necessari alla navigazione e alla sessione di accesso sicura. Per maggiori
          dettagli consulta l&apos;{" "}
          <Link to="/cookie" className="cookie-banner-link">
            informativa sui cookie
          </Link>{" "}
          e l&apos;{" "}
          <Link to="/privacy" className="cookie-banner-link">
            privacy policy
          </Link>
          .
        </p>
        <button type="button" className="cookie-banner-btn" onClick={accept}>
          Ho capito
        </button>
      </div>
    </div>
  );
}
