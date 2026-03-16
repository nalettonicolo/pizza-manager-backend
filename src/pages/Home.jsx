import { useBranding } from "@/branding/BrandingContext";

export default function Home() {
  const { branding } = useBranding();

  return (
    <div>
      <h1>Benvenuti da {branding.nomePizzeria}</h1>

      <p><strong>Indirizzo:</strong> {branding.indirizzo}</p>
      <p><strong>Email:</strong> {branding.emailAssistenza}</p>

      <h3>Giorni di apertura:</h3>
      <ul>
        {Object.entries(branding.giorniApertura)
          .filter(([_, open]) => open)
          .map(([day]) => (
            <li key={day}>{day.toUpperCase()}</li>
          ))}
      </ul>
    </div>
  );
}
