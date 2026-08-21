import { NavLink } from "react-router-dom"
import { withPreservedSupportSearch } from "@/utils/supportTenantOverride"

/**
 * Sidebar laterale admin con titoli di gruppo.
 */
export default function AdminGroupedSidebar({ title, groups, locationSearch, linkEndFor }) {
  return (
    <aside className="dashboard-sidebar admin-grouped-sidebar" style={{ flexShrink: 0 }}>
      <h2 className="dashboard-sidebar-title">{title}</h2>
      <nav className="admin-grouped-sidebar-nav">
        {groups.map((group) => (
          <div key={group.label} className="admin-sidebar-group">
            <p className="admin-sidebar-group-label">{group.label}</p>
            <div className="admin-sidebar-group-links">
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={withPreservedSupportSearch(item.to, locationSearch)}
                  end={item.end ?? item.to === linkEndFor}
                  className={({ isActive }) => (isActive ? "active" : "")}
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  )
}
