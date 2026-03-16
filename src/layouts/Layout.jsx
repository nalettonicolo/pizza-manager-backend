import { Outlet, Link } from "react-router-dom";
import { useBranding } from "@/branding/BrandingContext";

export default function Layout() {
  const { branding } = useBranding();

  return (
    <div
      style={{
        background: "var(--color-background)",
        color: "var(--color-text)",
        minHeight: "100vh",
      }}
    >
      <header
        style={{
          background: "var(--color-primary)",
          padding: "16px",
          color: "#fff",
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {branding.logoUrl && (
            <img
              src={branding.logoUrl}
              alt="logo"
              style={{ height: 40 }}
            />
          )}
          <h2>{branding.nomePizzeria}</h2>
        </div>

        <nav>
          <Link to="/" style={{ color: "#fff", marginRight: 15 }}>
            Home
          </Link>
          <Link to="/admin/branding" style={{ color: "#fff" }}>
            Admin
          </Link>
        </nav>
      </header>

      <main style={{ padding: 24 }}>
        <Outlet />
      </main>
    </div>
  );
}
