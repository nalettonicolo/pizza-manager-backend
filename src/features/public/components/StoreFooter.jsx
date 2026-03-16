export default function StoreFooter({ branding }) {
  const safe = branding ?? {};
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
      {safe.nome && <h3>{safe.nome}</h3>}
      {safe.indirizzo && <p>{safe.indirizzo}</p>}
      {safe.telefono && <p>{safe.telefono}</p>}
      {safe.email_assistenza && <p>{safe.email_assistenza}</p>}

      <p style={{ marginTop: 20, fontSize: 14, opacity: 0.6 }}>
        © {new Date().getFullYear()} {safe.nome ?? "Pizzeria"}
      </p>
    </footer>
  );
}
