import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Suddivide i vendor per cache; React deve restare nello stesso grafo di caricamento di librerie che usano
 * forwardRef/createContext (lucide-react, react-markdown, …), altrimenti in produzione si ottiene
 * "Cannot read properties of undefined (reading 'forwardRef')" tra chunk.
 */
function manualChunks(id) {
  if (!id.includes("node_modules")) return;
  if (id.includes("node_modules/react-dom") || id.includes("node_modules/react/")) return "react-vendor";
  if (id.includes("node_modules/scheduler")) return "react-vendor";
  if (id.includes("lucide-react") || id.includes("react-markdown") || id.includes("/prop-types/")) {
    return "react-vendor";
  }
  if (id.includes("react-router")) return "router";
  if (id.includes("@supabase")) return "supabase";
  return "vendor";
}

export default defineConfig(({ command }) => ({
  plugins: [react()],

  build: {
    outDir: "dist",
    target: "es2022",
    cssCodeSplit: true,
    reportCompressedSize: false,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks,
      },
    },
  },

  esbuild: {
    drop: command === "build" ? ["debugger"] : [],
    legalComments: "none",
  },

  server: {
    warmup: {
      clientFiles: [
        "./src/app/main.jsx",
        "./src/router/AppRouter.jsx",
        "./src/layouts/PublicLayout.jsx",
        "./src/layouts/AdminLayout.jsx",
      ],
    },
  },

  optimizeDeps: {
    include: ["react", "react-dom", "react-router-dom", "@supabase/supabase-js"],
  },

  resolve: {
    alias: {
      "@/contexts": resolve(__dirname, "src/app/contexts"),
      "@": resolve(__dirname, "src"),
      "@docs": resolve(__dirname, "docs"),
      "@root": resolve(__dirname),
    },
  },
}));
