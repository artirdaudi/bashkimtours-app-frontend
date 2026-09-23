import { cwd } from "node:process";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, cwd(), "");
  return {
    plugins: [react(), tailwindcss(), VitePWA({
      registerType: "prompt",
      manifest: {
        id: "/",
        name: "Bashkim Tours",
        short_name: "Bashkim Tours",
        description: "Menaxhimi i transportit dhe pagesave të Bashkim Tours.",
        lang: "sq",
        start_url: "/",
        scope: "/",
        display: "standalone",
        theme_color: "#073878",
        background_color: "#ffffff",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,jpg,jpeg,svg,woff,woff2}"],
        navigateFallback: "index.html",
        // Only app pages receive the shell. API responses are never cached.
        navigateFallbackAllowlist: [/^\/$/, /^\/(students|debts|cards|areas|vehicles|drivers|calendar|followup-rules|payments|account|income)\/?$/, /^\/student\/[^/]+\/?$/],
        runtimeCaching: [],
        cleanupOutdatedCaches: true,
      },
    })],
    server: {
      proxy: env.DEV_API_TARGET
        ? {
            "/api": {
              target: env.DEV_API_TARGET,
              changeOrigin: true,
              rewrite: (path) => path.replace(/^\/api/, ""),
            },
          }
        : undefined,
    },
  };
});
