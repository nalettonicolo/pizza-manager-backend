import { Link, useLocation } from "react-router-dom";

/**
 * Card attiva: pathname uguale; se `to` contiene #hash, serve anche lo stesso hash.
 * Es. /admin/dashboard vs /admin/dashboard#anchor se in uso
 */
function isNavItemCurrent(item, location) {
  const to = String(item.to || "");
  const [base, hashPart] = to.split("#");
  if (location.pathname !== base) return false;
  if (hashPart) {
    return location.hash === `#${hashPart}`;
  }
  return !location.hash;
}

/**
 * Griglia di card per navigazione (usa classi in style.css).
 * items: [{ to, label, description?, onClick? }]
 * Se `onClick` è presente, la card è un button (es. Area cliente demo → openDemoClienteArea).
 * currentPath: se passato, la card con to === currentPath è disattivata e mostra "Sei qui".
 * variant: "default" | "hub" — hub = tile compatte per home admin tenant.
 */
export default function DashboardNavCards({ items, columns = 4, currentPath, variant = "default" }) {
  const location = useLocation();
  const path = currentPath ?? location.pathname;
  const colsClass = { 2: "cols-2", 3: "cols-3", 4: "cols-4", 5: "cols-5" }[columns] || "cols-4";
  const isHub = variant === "hub";

  return (
    <div className={`nav-cards ${colsClass}${isHub ? " nav-cards--hub" : ""}`}>
      {items.map((item) => {
        const isCurrent = !item.onClick && isNavItemCurrent(item, { pathname: path, hash: location.hash });
        const cardClass = `nav-card${isHub ? " nav-card--hub" : ""}${isCurrent ? " nav-card-current" : ""}`;
        const key = `${item.to}-${item.label}`;

        if (isCurrent) {
          return (
            <div key={key} className={cardClass} aria-current="page">
              <div className="nav-card-body">
                <h3>{item.label}</h3>
                {item.description && <p>{item.description}</p>}
              </div>
              {isHub ? (
                <span className="nav-card-here">Attivo</span>
              ) : (
                <span className="nav-card-link">Sei qui</span>
              )}
            </div>
          );
        }

        if (typeof item.onClick === "function") {
          return (
            <button
              key={key}
              type="button"
              className={cardClass}
              onClick={(e) => {
                e.preventDefault();
                void item.onClick(e);
              }}
              style={{
                width: "100%",
                textAlign: "left",
                cursor: "pointer",
                font: "inherit",
                border: undefined,
                background: undefined,
              }}
            >
              {isHub ? (
                <>
                  <div className="nav-card-body">
                    <h3>{item.label}</h3>
                    {item.description && <p>{item.description}</p>}
                  </div>
                  <span className="nav-card-chevron" aria-hidden="true">
                    ›
                  </span>
                </>
              ) : (
                <>
                  <h3>{item.label}</h3>
                  {item.description && <p>{item.description}</p>}
                  <span className="nav-card-link">Vai →</span>
                </>
              )}
            </button>
          );
        }

        if (isHub) {
          return (
            <Link key={key} to={item.to} className={cardClass}>
              <div className="nav-card-body">
                <h3>{item.label}</h3>
                {item.description && <p>{item.description}</p>}
              </div>
              <span className="nav-card-chevron" aria-hidden="true">
                ›
              </span>
            </Link>
          );
        }

        return (
          <Link key={key} to={item.to} className={cardClass}>
            <h3>{item.label}</h3>
            {item.description && <p>{item.description}</p>}
            <span className="nav-card-link">Vai →</span>
          </Link>
        );
      })}
    </div>
  );
}
