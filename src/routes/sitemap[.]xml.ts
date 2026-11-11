import { createFileRoute } from "@tanstack/react-router";

const SITE = "https://hasagold.store";
const STATIC_PUBLIC_PATHS = [
  "/",
  "/games",
  "/how-it-works",
  "/support",
  "/status",
  "/privacy-policy",
  "/refund-policy",
] as const;

function xmlEscape(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const urls = new Set<string>(STATIC_PUBLIC_PATHS.map((path) => `${SITE}${path}`));

        try {
          const response = await fetch("https://api.hasagold.store/v1/catalog", {
            headers: { Accept: "application/json" },
            cache: "no-store",
          });
          if (response.ok) {
            const catalog: unknown = await response.json();
            if (catalog && typeof catalog === "object" && "games" in catalog) {
              const games = (catalog as { games?: unknown }).games;
              if (Array.isArray(games)) {
                for (const game of games) {
                  if (
                    game &&
                    typeof game === "object" &&
                    "slug" in game &&
                    typeof game.slug === "string" &&
                    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(game.slug) &&
                    "active" in game &&
                    game.active === true
                  ) {
                    urls.add(`${SITE}/games/${encodeURIComponent(game.slug)}`);
                  }
                }
              }
            }
          }
        } catch {
          // Keep the sitemap available with verified static public routes if the catalog is down.
        }

        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[
          ...urls,
        ]
          .sort()
          .map((url) => `  <url><loc>${xmlEscape(url)}</loc></url>`)
          .join("\n")}\n</urlset>`;

        return new Response(xml, {
          status: 200,
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});
