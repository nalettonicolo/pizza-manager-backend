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
 * items: [{ to, label, description? }]
 * currentPath: se passato, la card con to === currentPath è disattivata e mostra "Sei qui".
 */
export default function DashboardNavCards({ items, columns = 4, currentPath }) {
  const location = useLocation();
  const path = currentPath ?? location.pathname;
  const colsClass = { 2: "cols-2", 3: "cols-3", 4: "cols-4", 5: "cols-5" }[columns] || "cols-4";

  return (
    <div className={`nav-cards ${colsClass}`}>
      {items.map((item) => {
        const isCurrent = isNavItemCurrent(item, { pathname: path, hash: location.hash });
        if (isCurrent) {
          return (
            <div key={item.to} className="nav-card nav-card-current" style={{ cursor: "default", opacity: 0.95 }}>
              <h3>{item.label}</h3>
              {item.description && <p>{item.description}</p>}
              <span className="nav-card-link" style={{ color: "#2e7d32", fontWeight: 600 }}>Sei qui</span>
            </div>
          );
        }
        return (
          <Link key={`${item.to}-${item.label}`} to={item.to} className="nav-card">
            <h3>{item.label}</h3>
            {item.description && <p>{item.description}</p>}
            <span className="nav-card-link">Vai →</span>
          </Link>
        );
      })}
    </div>
  );
}
