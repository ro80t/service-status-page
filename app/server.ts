import { Hono } from "hono";
import { inertia } from "@hono/inertia";
import { createDb } from "./db/client";
import { listStatuses, listWebsites, removeOldStatuses, todayDate } from "./db/repo";
import { checkAllWebsites } from "./lib/monitor";
import type { ParsedStatus } from "./lib/status-check";
import { summarizeDay } from "./lib/status-check";
import { rootView } from "./root-view";
import pkg from "../package.json";

const HISTORY_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;
const CACHE_TTL_MS = 60 * 1000;

// 画面に出る最古の日付。これより前は表示されないので削除対象。
const oldestVisibleDate = () => new Date(todayDate().getTime() - (HISTORY_DAYS - 1) * DAY_MS);

const app = new Hono<{ Bindings: CloudflareBindings }>();

app.use(inertia({ rootView }));

const buildHistory = (statusRows: { date: Date; status: number[] }[]): ParsedStatus[] => {
  const byDate = new Map(statusRows.map((row) => [row.date.getTime(), summarizeDay(row.status)]));
  const oldest = oldestVisibleDate();
  const days: ParsedStatus[] = [];
  for (let i = 0; i < HISTORY_DAYS; i++) {
    days.push(byDate.get(oldest.getTime() + i * DAY_MS) ?? "unknown");
  }
  return days;
};

const fetchServices = async (connectionString: string) => {
  const db = createDb(connectionString);
  return Promise.all(
    (await listWebsites(db)).map(async ({ domain, label }) => ({
      domain,
      label,
      days: buildHistory(await listStatuses(db, domain)),
    })),
  );
};

// ponytail: isolate単位のメモリキャッシュ。コロ間で共有したくなったらCache API/KVへ
let cache: { at: number; services: ReturnType<typeof fetchServices> } | null = null;

// 監視cronは1分間隔なので、同じTTLならDB接続とN+1クエリをまるごと省ける。
const loadServices = (connectionString: string) => {
  if (!cache || Date.now() - cache.at >= CACHE_TTL_MS) {
    const entry = { at: Date.now(), services: fetchServices(connectionString) };
    // 失敗を60秒キャッシュして画面を落とさないよう、エラー時は即破棄する。
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
    }
    await checkAllWebsites(db, env.CLOUDFLARE_API_TOKEN);
  },
};
