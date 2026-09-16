import { Hono } from "hono";
import { inertia } from "@hono/inertia";
import { createDb } from "./db/client";
import { listStatuses, listWebsites, removeOldStatuses, todayDate } from "./db/repo";
import { checkAllWebsites } from "./lib/monitor";
import type { ParsedStatus } from "./lib/status-check";
import { summarizeDay } from "./lib/status-check";
import { rootView } from "./root-view";

const HISTORY_DAYS = 90;
const RETENTION_DAYS = 91;

const app = new Hono<{ Bindings: CloudflareBindings }>();

app.use(inertia({ rootView }));

const buildHistory = (statusRows: { date: Date; status: number[] }[]): ParsedStatus[] => {
  const byDate = new Map(statusRows.map((row) => [row.date.getTime(), summarizeDay(row.status)]));
  const today = todayDate();
  const days: ParsedStatus[] = [];
  for (let i = HISTORY_DAYS - 1; i >= 0; i--) {
    const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
    days.push(byDate.get(date.getTime()) ?? "unknown");
  }
  return days;
};

const routes = app.get("/", async (c) => {
  const db = createDb(c.env.HYPERDRIVE.connectionString);
  const services = await Promise.all(
    (await listWebsites(db)).map(async ({ domain, label }) => ({
      domain,
      label,
      days: buildHistory(await listStatuses(db, domain)),
    })),
  );
  const isUnstable = services.some(
    (s) => s.days.at(-1) === "error" || s.days.at(-1) === "unstable",
  );
  return c.render("Home", {
    pageStatusLabel: isUnstable ? "Some services are unstable." : "All services are working fine.",
    services,
  });
});

export default {
  fetch: routes.fetch,
  scheduled: async (event: ScheduledController, env: CloudflareBindings) => {
    const db = createDb(env.HYPERDRIVE.connectionString);
    if (event.cron === "0 * * * *") {
      const expiration = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
      await removeOldStatuses(db, expiration);
    }
    await checkAllWebsites(db, env.CLOUDFLARE_API_TOKEN);
  },
};
