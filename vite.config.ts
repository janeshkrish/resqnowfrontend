import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";
import { resolveApiConfiguration } from "./src/lib/apiConfig";

// https://vitejs.dev/config/
export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const { apiBaseUrl } = resolveApiConfiguration({
    apiUrl: env.VITE_API_URL,
    frontendOnly: env.VITE_FRONTEND_ONLY,
    production: mode !== "development" && (command === "build" || mode === "production"),
  });

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
  const liveStreamRuntimePattern = escapedApiBaseUrl
    ? new RegExp(
      `^${escapedApiBaseUrl}/api/(admin|admin-extended)/notifications/stream(?:$|[/?].*)`,
      "i"
    )
    : /$a/;
  const razorpayScriptRuntimePattern = /^https:\/\/checkout\.razorpay\.com\/v1\/checkout\.js(?:\?.*)?$/i;

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
      mode === "development" && componentTagger(),
      VitePWA({
        registerType: "autoUpdate",
        injectRegister: "auto",
        manifestFilename: "manifest.json",
        includeAssets: [
          "robots.txt",
          "placeholder.svg",
          "icons/icon-192x192.png",
          "icons/icon-512x512.png",
        ],
        manifest: {
          name: "ResQNow",
          short_name: "ResQNow",
          description: "24/7 roadside assistance and puncture repair services.",
          theme_color: "#dc2626",
          background_color: "#ffffff",
          display: "standalone",
          start_url: "/",
          scope: "/",
          icons: [
            {
              src: "icons/icon-192x192.png",
              sizes: "192x192",
              type: "image/png",
              purpose: "any"
            },
            {
              src: "icons/icon-512x512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any",
            },
            {
              src: "icons/icon-512x512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable"
            }
          ],
        },
        workbox: {
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          // "Hey ResQNow" (about 15 MB) is fetched only by customers who turn it on, never precached for everyone.
          globIgnores: ["**/firebase-messaging-sw.js", "**/hey-resqnow/**"],
          navigateFallback: "/index.html",
          navigateFallbackDenylist: [/^\/api\//],
          runtimeCaching: [
            {
              // Authorization responses must not survive in the generic script cache.
              urlPattern: ({ url }) =>
                url.hostname === "sdk.mappls.com" || url.hostname === "apis.mappls.com",
              handler: "NetworkOnly",
              method: "GET",
            },
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
              urlPattern: liveStreamRuntimePattern,
              handler: "NetworkOnly",
              method: "GET",
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
                url.hostname !== "api.razorpay.com" &&
                // reCAPTCHA for mobile number login must always be Google's current script.
                url.hostname !== "www.google.com" &&
                url.hostname !== "www.gstatic.com" &&
                url.hostname !== "www.recaptcha.net",
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
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    // The log in page loads Firebase Auth on demand; bundling it up front stops the dev
    // server reloading the page the first time someone opens it.
    optimizeDeps: {
      include: ["firebase/auth"],
    },
  };
});
