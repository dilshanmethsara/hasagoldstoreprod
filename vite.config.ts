import { defineConfig, loadEnv, type PluginOption, type UserConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Standalone Vite configuration for this TanStack Start app.
//
// Plugin order matters:
//   1. @tanstack/devtools-vite  (dev-only, must come first)
//   2. @tailwindcss/vite
//   3. @tanstack/react-start/plugin/vite  (router + SSR)
//   4. nitro/vite               (build-only; bundles the server for deployment)
//   5. @vitejs/plugin-react
//
// The "@/*" -> "./src/*" alias is resolved by Vite natively from tsconfig.json
// (`resolve.tsconfigPaths`), so no path-alias plugin is needed.
export default defineConfig(async ({ command, mode }): Promise<UserConfig> => {
  const isBuild = command === "build";
  const isDevBuild = isBuild && mode === "development";
  // Vercel sets VERCEL=1 for every build. Its preset writes the Build Output
  // API tree to .vercel/output, so the Cloudflare output options must not apply.
  const isVercelBuild = Boolean(process.env["VERCEL"]) || process.env["NITRO_PRESET"] === "vercel";

  // Security headers applied to every response (HTML + server functions).
  // The allow-list covers only the origins this app actually talks to:
  // the Express API, Firebase Auth (Google endpoints + the auth iframe),
  // Google Fonts and Supabase storage for payment receipts.
  const securityHeaders: Record<string, string> = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "geolocation=(), microphone=(), camera=(), interest-cohort=()",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "Content-Security-Policy": [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "script-src 'self' 'unsafe-inline' https://apis.google.com https://www.gstatic.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      "img-src 'self' data: blob: https:",
      "media-src 'self' data: blob: https:",
      "connect-src 'self' https://api.hasagold.store https://*.googleapis.com https://*.firebaseio.com https://*.firebaseapp.com https://*.supabase.co wss://*.firebaseio.com",
      "frame-src 'self' https://*.firebaseapp.com https://accounts.google.com",
      "worker-src 'self' blob:",
      "upgrade-insecure-requests",
    ].join("; "),
  };

  const plugins: PluginOption[] = [];

  if (mode === "development") {
    const { devtools } = await import("@tanstack/devtools-vite");
    plugins.push(
      devtools({
        logging: false,
        eventBusConfig: { enabled: false },
        enhancedLogs: { enabled: false },
        consolePiping: { enabled: false },
        removeDevtoolsOnBuild: false,
        injectSource: { enabled: true },
      }),
    );
  }

  plugins.push(tailwindcss());
  plugins.push(
    tanstackStart({
      // Block server-only modules from leaking into the client bundle.
      importProtection: {
        behavior: "error",
        client: {
          files: ["**/server/**"],
          specifiers: ["server-only"],
        },
      },
      // Point TanStack Start's bundled server entry at src/server.ts (the SSR
      // error wrapper in this repo).
      server: { entry: "server" },
    }),
  );

  // Nitro only participates in production builds; the dev server uses Vite's
  // own SSR pipeline.
  if (isBuild) {
    plugins.push(
      nitro({
        defaultPreset: isVercelBuild ? "vercel" : "cloudflare-module",
        // Baseline security headers on every response.
        routeRules: {
          "/**": { headers: securityHeaders },
        },
        ...(isVercelBuild
          ? {
              // Firebase Admin's Firestore client locates its gRPC proto files
              // with __dirname. Bundling it into the ESM Vercel function makes
              // that identifier undefined, so keep it external and let Node
              // load the package's CommonJS build at runtime.
              rolldownConfig: {
                external: [
                  "firebase-admin",
                  "firebase-admin/app",
                  "firebase-admin/auth",
                  "firebase-admin/firestore",
                  "@google-cloud/firestore",
                  "@google-cloud/storage",
                ],
              },
              // The tracer copies only the files it deems reachable, so the
              // externalized Firestore client's runtime requirements would
              // land in the function incomplete (missing entries such as
              // protobufjs/minimal or whole packages like google-gax).
              // scripts/vercel-postbuild.mjs, chained after `vite build` in
              // package.json, replaces them with full copies. It must stay a
              // post-build script: defining a Nitro `compiled` hook here
              // shadows the Vercel preset's own compiled hook, which is what
              // writes config.json and .vc-config.json into the Build Output
              // API — without them Vercel cannot consume the output and the
              // deployment fails with STATIC_BUILD_NO_OUT_DIR.
              traceDeps: [
                "firebase-admin",
                "@google-cloud/firestore",
                "@google-cloud/storage",
                "@grpc/grpc-js",
                "@grpc/proto-loader",
                "protobufjs",
              ],
            }
          : {
              output: {
                dir: ".output",
                serverDir: ".output/server",
                publicDir: ".output/public",
              },
              cloudflare: {
                nodeCompat: true,
                deployConfig: true,
              },
            }),
      }),
    );
  }
  plugins.push(viteReact());

  // Load server-only variables into the dev/build process without defining them
  // for the client bundle. Only VITE_* values are exposed through import.meta.env.
  const envDefine: Record<string, string> = {};
  const loadedEnv = loadEnv(mode, process.cwd(), "");
  for (const [key, value] of Object.entries(loadedEnv)) {
    if (key.startsWith("VITE_")) {
      envDefine[`import.meta.env.${key}`] = JSON.stringify(value);
    } else {
      if (process.env[key] === undefined || process.env[key] === "") {
        process.env[key] = value;
      }
    }
  }

  return {
    define: envDefine,
    ...(isDevBuild
      ? {
          environments: {
            client: { define: { "process.env.NODE_ENV": JSON.stringify("development") } },
          },
          // Vite 8 bundles with Rolldown, so the former `esbuild.keepNames`
          // equivalent now lives on the Rolldown output options. Keeps function
          // and class names intact so dev-mode stack traces stay readable.
          build: { rolldownOptions: { output: { keepNames: true } } },
        }
      : {}),
    css: { transformer: "lightningcss" },
    resolve: {
      // Read the "@/*" alias from tsconfig.json (Vite 8 built-in).
      tsconfigPaths: true,
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "react-dom/client",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
      ],
      ignoreOutdatedRequests: true,
    },
    plugins,
    server: {
      host: "::",
      port: 8080,
      allowedHosts: ["fine-frogs-kneel.loca.lt"],
      // Keep generated build output out of the dev watcher. These dirs are
      // gitignored, and on Windows a concurrent build writing into them raises
      // EBUSY on the watched file, which crashes the dev server. Binary assets
      // are excluded for the same reason: an image opened in another app (file
      // preview, editor, Explorer thumbnailing) locks the file and takes the
      // dev server down with EBUSY. Refresh the page after changing an image.
      watch: {
        ignored: [
          "**/.output/**",
          "**/.wrangler/**",
          "**/.nitro/**",
          "**/.vinxi/**",
          "**/src/assets/**",
        ],
      },
    },
  };
});
