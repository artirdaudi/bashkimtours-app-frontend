import { cwd } from "node:process";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, cwd(), "");
  return {
    plugins: [react(), tailwindcss(), VitePWA({
      registerType: "autoUpdate",
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
        // Fetch page HTML from the network on every navigation/reload so browser
        // tabs receive deployments without accepting a service-worker update.
        globPatterns: ["**/*.{js,css,png,jpg,jpeg,svg,woff,woff2}"],
        navigateFallback: null,
        runtimeCaching: [{
          urlPattern: ({ request, url, sameOrigin }) => sameOrigin && request.mode === "navigate" && (
            /^\/$/.test(url.pathname) ||
            /^\/(students|debts|cards|areas|vehicles|drivers|calendar|followup-rules|payments|account|income)\/?$/.test(url.pathname) ||
            /^\/student\/[^/]+\/?$/.test(url.pathname)
          ),
          handler: "NetworkFirst",
          options: {
            cacheName: "bt-page-shells",
            fetchOptions: { cache: "no-store" },
            cacheableResponse: { statuses: [200] },
            expiration: { maxEntries: 20 },
          },
        }],
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
