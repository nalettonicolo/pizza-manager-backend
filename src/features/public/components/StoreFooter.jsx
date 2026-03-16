export default function StoreFooter({ branding }) {
  return (
    <footer
      style={{
        background: "#111",
        color: "white",
        padding: "40px 20px",
        textAlign: "center",
        marginTop: 80,
      }}
    >
      <h3>{branding.nome}</h3>
      <p>{branding.indirizzo}</p>
      <p>{branding.telefono}</p>
      <p>{branding.email_assistenza}</p>

      <p style={{ marginTop: 20, fontSize: 14, opacity: 0.6 }}>
        © {new Date().getFullYear()} {branding.nome}
      </p>
    </footer>
  );
}
