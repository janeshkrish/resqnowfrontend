import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "node:fs";
import { componentTagger } from "lovable-tagger";
import basicSsl from '@vitejs/plugin-basic-ssl';
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiBaseUrl = (env.VITE_API_URL || "").replace(/\/+$/, "");
  const escapedApiBaseUrl = apiBaseUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const apiRuntimePattern = escapedApiBaseUrl
    ? new RegExp(`^${escapedApiBaseUrl}/api/.*`)
    : /$a/;
  const paymentNoCacheRuntimePattern = escapedApiBaseUrl
    ? new RegExp(
      `^${escapedApiBaseUrl}/api/(payments/(confirm|verify|confirm-status|verify-subscription-payment|verify-service-payment|verify-registration-payment)|technicians/me/(verify-dues|pay-dues/verify))(?:$|[/?].*)`,
      "i"
    )
    : /$a/;
  const razorpayScriptRuntimePattern = /^https:\/\/checkout\.razorpay\.com\/v1\/checkout\.js(?:\?.*)?$/i;
  const cloudflareSpaFallback = {
    name: "cloudflare-spa-404-fallback",
    apply: "build" as const,
    closeBundle() {
      const distDir = path.resolve(__dirname, "dist");
      const indexFile = path.join(distDir, "index.html");
      const fallbackFile = path.join(distDir, "404.html");

      if (fs.existsSync(indexFile)) {
        fs.copyFileSync(indexFile, fallbackFile);
      }
    },
  };

  return {
    build: {
      outDir: "dist",
    },
    server: {
      host: "::",
      port: 8080,
    },
    plugins: [
      react(),
      basicSsl(),
      mode === "development" && componentTagger(),
      VitePWA({
        registerType: "autoUpdate",
        injectRegister: "auto",
        manifestFilename: "manifest.json",
        includeAssets: [
          "robots.txt",
          "placeholder.svg",
          "pwa-192x192.png",
          "pwa-512x512.png",
          "apple-touch-icon.png",
        ],
        manifest: {
          name: "ResQNow Roadside Assistance",
          short_name: "ResQNow",
          description: "24/7 roadside assistance and puncture repair services.",
          theme_color: "#dc2626",
          background_color: "#ffffff",
          display: "standalone",
          start_url: "/",
          scope: "/",
          icons: [
            {
              src: "/pwa-192x192.png",
              sizes: "192x192",
              type: "image/png",
              purpose: "any maskable",
            },
            {
              src: "/pwa-512x512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any maskable",
            },
            {
              src: "/apple-touch-icon.png",
              sizes: "192x192",
              type: "image/png",
              purpose: "any",
            },
          ],
        },
        workbox: {
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          navigateFallback: "/index.html",
          navigateFallbackDenylist: [/^\/api\//],
          runtimeCaching: [
            {
              urlPattern: paymentNoCacheRuntimePattern,
              handler: "NetworkOnly",
              method: "GET",
            },
            {
              urlPattern: paymentNoCacheRuntimePattern,
              handler: "NetworkOnly",
              method: "POST",
            },
            {
              urlPattern: razorpayScriptRuntimePattern,
              handler: "NetworkOnly",
              method: "GET",
            },
            {
              urlPattern: apiRuntimePattern,
              handler: "NetworkFirst",
              options: {
                cacheName: "resqnow-api-cache",
                networkTimeoutSeconds: 10,
                expiration: {
                  maxEntries: 120,
                  maxAgeSeconds: 60 * 60 * 24,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: ({ request }) => request.destination === "document",
              handler: "NetworkFirst",
              options: {
                cacheName: "resqnow-pages-cache",
                expiration: {
                  maxEntries: 20,
                  maxAgeSeconds: 60 * 60 * 24 * 7,
                },
              },
            },
            {
              urlPattern: ({ request, url }) =>
                (request.destination === "script" ||
                  request.destination === "style" ||
                  request.destination === "worker") &&
                url.hostname !== "checkout.razorpay.com" &&
                url.hostname !== "api.razorpay.com",
              handler: "StaleWhileRevalidate",
              options: {
                cacheName: "resqnow-static-cache",
                expiration: {
                  maxEntries: 80,
                  maxAgeSeconds: 60 * 60 * 24 * 30,
                },
              },
            },
            {
              urlPattern: ({ request }) => request.destination === "image",
              handler: "StaleWhileRevalidate",
              options: {
                cacheName: "resqnow-image-cache",
                expiration: {
                  maxEntries: 200,
                  maxAgeSeconds: 60 * 60 * 24 * 30,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: true,
          suppressWarnings: true,
        },
      }),
      cloudflareSpaFallback,
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
