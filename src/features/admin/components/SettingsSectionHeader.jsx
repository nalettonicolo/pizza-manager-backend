/**
 * Intestazione pagine Impostazioni admin tenant.
 */
export default function SettingsSectionHeader({ title, description, children }) {
  return (
    <header className="admin-settings-page-header">
      <div className="admin-settings-page-header-text">
        <h1 className="admin-settings-page-title">{title}</h1>
        {description ? <p className="admin-settings-page-desc">{description}</p> : null}
      </div>
      {children ? <div className="admin-settings-page-header-actions">{children}</div> : null}
    </header>
  )
}
