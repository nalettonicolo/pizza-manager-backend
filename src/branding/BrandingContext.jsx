import { createContext, useContext, useEffect, useState } from "react";

const BrandingContext = createContext();

const defaultBranding = {
  nomePizzeria: "La Mia Pizzeria",
  indirizzo: "",
  sedeLegale: "",
  emailAssistenza: "",
  telefoni: [""],
  logoUrl: "",
  faviconUrl: "",
  colori: {
    primary: "#e63946",
    secondary: "#1d3557",
    background: "#ffffff",
    text: "#111111",
  },
  giorniApertura: {
    lun: true,
    mar: true,
    mer: true,
    gio: true,
    ven: true,
    sab: true,
    dom: false,
  },
};

export function BrandingProvider({ children }) {
  const [branding, setBranding] = useState(() => {
    const saved = localStorage.getItem("branding");
    return saved ? JSON.parse(saved) : defaultBranding;
  });

  // Persistenza
  useEffect(() => {
    localStorage.setItem("branding", JSON.stringify(branding));
  }, [branding]);

  // Aggiorna titolo
  useEffect(() => {
    document.title = branding.nomePizzeria;
  }, [branding.nomePizzeria]);

  // Aggiorna favicon
  useEffect(() => {
    if (!branding.faviconUrl) return;

    let link = document.querySelector("link[rel='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = branding.faviconUrl;
  }, [branding.faviconUrl]);

  // Aggiorna CSS Variables globali
  useEffect(() => {
    const root = document.documentElement;

    Object.entries(branding.colori).forEach(([key, value]) => {
      root.style.setProperty(`--color-${key}`, value);
    });
  }, [branding.colori]);

  const updateBranding = (section, value) => {
    setBranding((prev) => ({
      ...prev,
      [section]: value,
    }));
  };

  const updateNested = (section, key, value) => {
    setBranding((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value,
      },
    }));
  };

  return (
    <BrandingContext.Provider
      value={{
        branding,
        setBranding,
        updateBranding,
        updateNested,
      }}
    >
      {children}
    </BrandingContext.Provider>
  );
}

export const useBranding = () => useContext(BrandingContext);
