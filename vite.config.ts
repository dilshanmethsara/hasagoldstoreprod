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
        ...(isVercelBuild
          ? {}
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
      // EBUSY on the watched file, which crashes the dev server.
      watch: {
        ignored: ["**/.output/**", "**/.wrangler/**", "**/.nitro/**", "**/.vinxi/**"],
      },
    },
  };
});
