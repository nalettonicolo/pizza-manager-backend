import { useBranding } from "@/branding/BrandingContext";

export default function HeroSection() {
  const { branding } = useBranding();

  if (!branding) return null;

  return (
    <section
      style={{
        background: "var(--color-primary)",
        color: "white",
        padding: "80px 20px",
        textAlign: "center",
      }}
    >
      {branding.logo_url && (
        <img
          src={branding.logo_url}
          alt="Logo"
          style={{ width: 120, marginBottom: 20 }}
        />
      )}

      <h1 style={{ fontSize: 40 }}>{branding.nome}</h1>

      <p style={{ marginTop: 20 }}>
        Ordina le nostre pizze artigianali online
      </p>

      <button className="button-primary" style={{ marginTop: 30 }}>
        Ordina Online
      </button>
    </section>
  );
}
