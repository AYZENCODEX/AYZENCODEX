import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

const port = Number(process.env.PORT ?? 5173);
const basePath = process.env.BASE_PATH ?? "/";

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  define: {
    "import.meta.env.VITE_FIREBASE_API_KEY": JSON.stringify(process.env.VITE_FIREBASE_API_KEY ?? ""),
    "import.meta.env.VITE_FIREBASE_APP_ID": JSON.stringify(process.env.VITE_FIREBASE_APP_ID ?? ""),
    "import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID": JSON.stringify(process.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? ""),
    "import.meta.env.VITE_FIREBASE_PROJECT_ID": JSON.stringify(process.env.VITE_FIREBASE_PROJECT_ID ?? ""),
    "import.meta.env.VITE_FIREBASE_AUTH_DOMAIN": JSON.stringify(process.env.VITE_FIREBASE_AUTH_DOMAIN ?? ""),
    "import.meta.env.VITE_FIREBASE_STORAGE_BUCKET": JSON.stringify(process.env.VITE_FIREBASE_STORAGE_BUCKET ?? ""),
    "import.meta.env.VITE_FIREBASE_MEASUREMENT_ID": JSON.stringify(process.env.VITE_FIREBASE_MEASUREMENT_ID ?? ""),
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: { strict: true },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
