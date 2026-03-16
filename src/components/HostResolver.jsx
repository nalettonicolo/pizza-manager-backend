import Landing from "@/features/public/pages/Landing";
import PublicStore from "@/features/public/PublicStore";

export default function HostResolver() {
  const host = window.location.hostname;

  // Dominio SaaS
  if (host.startsWith("app.") || host.includes("localhost")) {
    return <Landing />;
  }

  // Dominio pizzeria
  return <PublicStore />;
}
