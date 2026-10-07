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
        // Keep the HTML and hashed assets in the same precache revision so an
        // older page never asks a new deployment for a removed stylesheet.
        globPatterns: ["**/*.{html,js,css,png,jpg,jpeg,svg,woff,woff2}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
      },
    })],
    server: {
      port: 8787,
      strictPort: true,
      proxy: env.DEV_API_TARGET
        ? {
            "/api": {
              target: env.DEV_API_TARGET,
              changeOrigin: true,
              headers: { Origin: "https://app.bashkimtours.com" },
              rewrite: (path) => path.replace(/^\/api/, ""),
              configure: (proxy) => {
                proxy.on("proxyRes", (response) => {
                  const cookies = response.headers["set-cookie"];
                  if (!cookies) return;
                  response.headers["set-cookie"] = cookies.map((cookie) => cookie
                    .replace(/;\s*Path=\/auth(?=;|$)/i, "; Path=/api/auth")
                    .replace(/;\s*Secure(?=;|$)/i, "")
                    .replace(/;\s*SameSite=None(?=;|$)/i, "; SameSite=Lax")
                    .replace(/;\s*Domain=[^;]*/i, ""));
                });
              },
            },
          }
        : undefined,
    },
  };
});
