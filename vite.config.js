import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { visualizer } from "rollup-plugin-visualizer";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Split vendor per cache HTTP parallela e lazy route.
 * `vendor-react` = solo runtime React (no altre lib) per evitare TDZ rispetto a stack markdown/stripe.
 * Ordine controlli: prima pacchetti "parasite" che contengono la stringa "react" nel nome.
 */
function manualChunks(id) {
  if (!id.includes("node_modules")) return;
  if (id.includes("node_modules/react-router")) return "router";
  if (id.includes("@supabase")) return "supabase";

  if (id.includes("@sentry")) return "vendor-sentry";

  if (id.includes("@stripe/") || id.includes("stripe-js")) return "vendor-stripe";

  if (
    id.includes("react-markdown") ||
    id.includes("/micromark") ||
    id.includes("\\micromark") ||
    id.includes("/mdast") ||
    id.includes("\\mdast") ||
    id.includes("/hast") ||
    id.includes("\\hast") ||
    id.includes("/unist") ||
    id.includes("\\unist") ||
    id.includes("/remark-") ||
    id.includes("\\remark-") ||
    id.includes("/unified") ||
    id.includes("\\unified") ||
    id.includes("decode-named-character-reference") ||
    id.includes("character-entities") ||
    id.includes("property-information") ||
    id.includes("comma-separated-tokens") ||
    id.includes("space-separated-tokens") ||
    id.includes("html-url-attributes") ||
    id.includes("estree-util") ||
    id.includes("devlop")
  ) {
    return "vendor-markdown";
  }

  if (id.includes("lucide-react")) return "vendor-icons";

  if (id.includes("qrcode.react")) return "vendor-qrcode";

  // Stesso motivo delle regole sopra: react-signature-canvas (firma documenti tenant) referenzia
  // React a livello di modulo (class ... extends React.Component valutata subito all'esecuzione
  // del chunk, non solo al render). Lasciata cadere nel fallback "vendor" generico insieme a
  // librerie eterogenee, l'ordine di esecuzione tra chunk non garantiva che vendor-react fosse
  // già inizializzato: "Cannot read properties of undefined (reading 'Component')" su OGNI
  // pagina (il chunk vendor è caricato sempre, non solo dove la firma serve).
  if (id.includes("react-signature-canvas") || id.includes("signature_pad")) return "vendor-signature";

  if (id.includes("/react-dom/") || id.includes("\\react-dom\\") || id.includes("node_modules/scheduler")) {
    return "vendor-react";
  }
  if (
    id.includes("/node_modules/react/") ||
    id.includes("\\node_modules\\react\\") ||
    id.endsWith("node_modules/react/index.js") ||
    id.endsWith("node_modules/react/jsx-runtime.js") ||
    id.endsWith("node_modules/react/jsx-dev-runtime.js")
  ) {
    return "vendor-react";
  }

  return "vendor";
}

export default defineConfig(({ command, mode }) => ({
  plugins: [
    react(),
    mode === "analyze" &&
      visualizer({
        filename: "dist/stats.html",
        gzipSize: true,
        brotliSize: true,
        template: "treemap",
      }),
  ].filter(Boolean),

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
