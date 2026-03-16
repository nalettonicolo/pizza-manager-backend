import { Link, useLocation } from "react-router-dom";

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
        const isCurrent = path === item.to;
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
