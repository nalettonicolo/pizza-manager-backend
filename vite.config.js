import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Chunk npm: React + tutte le altre dipendenze (tranne router e supabase) nello stesso `react-vendor`.
 * Separare micromark/mdast/hast/… in un chunk "vendor" generico crea import circolari
 * vendor ↔ react-vendor e in produzione: "Cannot access '…' before initialization" (TDZ).
 */
function manualChunks(id) {
  if (!id.includes("node_modules")) return;
  if (id.includes("node_modules/react-router")) return "router";
  if (id.includes("@supabase")) return "supabase";
  return "react-vendor";
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

  test: {
    environment: "jsdom",
    include: ["tests/unit/**/*.{test,spec}.{js,jsx}"],
    passWithNoTests: true,
  },
}));
