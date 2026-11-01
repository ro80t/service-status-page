import { Hono } from "hono";
import { inertia } from "@hono/inertia";
import { createDb } from "./db/client";
import { removeOldStatuses } from "./db/repo";
import {
  checkAllWebsites,
  FLUSH_INTERVAL_MS,
  oldestVisibleDate,
  readCachedServices,
  refreshServices,
} from "./lib/monitor";
export { MonitorState } from "./lib/monitor-state";
import { rootView } from "./root-view";
import pkg from "../package.json";

const app = new Hono<{ Bindings: CloudflareBindings }>();

app.use(inertia({ rootView }));

const fetchServices = async (connectionString: string) =>
  (await readCachedServices()) ?? refreshServices(createDb(connectionString));

// ponytail: per-isolate layer on top of the Cache API, so a page can lag the DB by up to two
// intervals. It keeps a request from hitting the DB when the Cache API misses or is a no-op.
let cache: { at: number; services: ReturnType<typeof fetchServices> } | null = null;

const loadServices = (connectionString: string) => {
  if (!cache || Date.now() - cache.at >= FLUSH_INTERVAL_MS) {
    const entry = { at: Date.now(), services: fetchServices(connectionString) };
    // Drop a failed fetch right away rather than caching the error for a minute.
    entry.services.catch(() => {
      if (cache === entry) cache = null;
    });
    cache = entry;
  }
  return cache.services;
};

const routes = app
  .get("/", async (c) => {
    const services = await loadServices(c.env.HYPERDRIVE.connectionString);
    const isUnstable = services.some(
      (s) => s.days.at(-1) === "error" || s.days.at(-1) === "unstable",
    );
    return c.render("Home", {
      url: new URL(c.req.url).toString(),
      version: pkg.version,
      pageStatusLabel: isUnstable
        ? "Some services are unstable."
        : "All services are working fine.",
      services,
    });
  })
  .get("/robots.txt", (c) => {
    const origin = new URL(c.req.url).origin;
    return c.text(`User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`);
  })
  .get("/sitemap.xml", (c) => {
    const origin = new URL(c.req.url).origin;
    return c.body(
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>${origin}/</loc>\n  </url>\n</urlset>\n`,
      200,
      { "Content-Type": "application/xml" },
    );
  })
  .all("*", (c) => {
    c.status(404);
    return c.render("Error404", { url: new URL(c.req.url).toString(), version: pkg.version });
  });

export default {
  fetch: routes.fetch,
  scheduled: async (event: ScheduledController, env: CloudflareBindings) => {
    const db = createDb(env.HYPERDRIVE.connectionString);
    if (event.cron === "0 * * * *") {
      await removeOldStatuses(db, oldestVisibleDate());
      return;
    }
    const store = env.MONITOR_STATE.get(env.MONITOR_STATE.idFromName("monitor"));
    await checkAllWebsites(db, env.CLOUDFLARE_API_TOKEN, event.scheduledTime, store);
  },
};
