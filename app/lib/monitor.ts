import type { Db } from "../db/client";
import {
  listApis,
  listStatuses,
  listTriggers,
  listWebsites,
  recordStatus,
  replaceTriggers,
  todayDate,
} from "../db/repo";
import type { MonitorState, Site, State } from "./monitor-state";
import { getRuleset, listRulesets, recentBlockRatio, setRuleEnabled } from "./cloudflare";
import type { ParsedStatus } from "./status-check";
import { checkUrl, summarizeDay } from "./status-check";

const RULE_PREFIX = "auto:";
const ATTACK_CHECK_WINDOW_MINUTES = 5;
const ATTACK_BLOCK_RATIO_THRESHOLD = 0.05; // ponytail: 5% default, tune against real traffic

export const changeRule = async (apiToken: string, zoneId: string, enabled: boolean) => {
  for (const { id: rulesetId } of await listRulesets(apiToken, zoneId)) {
    const ruleset = await getRuleset(apiToken, zoneId, rulesetId);
    for (const rule of ruleset?.rules ?? []) {
      if (rule.id && rule.description?.startsWith(RULE_PREFIX)) {
        await setRuleEnabled(apiToken, zoneId, rulesetId, rule, enabled);
      }
    }
  }
};

export const FLUSH_INTERVAL_MS = 15 * 60 * 1000;
const TRIGGER_TTL_MS = 60 * 60 * 1000;
const SERVICES_URL = "https://status.ro80t.com/internal/services";
const HISTORY_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

type Service = { domain: string; label: string | null; days: ParsedStatus[] };

// ponytail: Cache API is per-colo and evictable, and a no-op on workers.dev. A miss just
// means an immediate DB round trip, which is fine for data that can be rebuilt from it.
const servicesCache = () => (caches as unknown as { default: Cache }).default;

// Oldest date the page shows. Anything before this is invisible, so it gets deleted.
export const oldestVisibleDate = () =>
  new Date(todayDate().getTime() - (HISTORY_DAYS - 1) * DAY_MS);

const buildHistory = (statusRows: { date: Date; status: number[] }[]): ParsedStatus[] => {
  const byDate = new Map(statusRows.map((row) => [row.date.getTime(), summarizeDay(row.status)]));
  const oldest = oldestVisibleDate();
  const days: ParsedStatus[] = [];
  for (let i = 0; i < HISTORY_DAYS; i++) {
    days.push(byDate.get(oldest.getTime() + i * DAY_MS) ?? "unknown");
  }
  return days;
};

export const readCachedServices = async () =>
  (await servicesCache().match(SERVICES_URL))?.json<Service[]>() ?? null;

// Page data lives for one flush interval. The cron only refills its own colo, so other
// colos fall back to this on a miss.
export const refreshServices = async (db: Db): Promise<Service[]> => {
  const services = await Promise.all(
    (await listWebsites(db)).map(async ({ domain, label }) => ({
      domain,
      label,
      days: buildHistory(await listStatuses(db, domain)),
    })),
  );
  await servicesCache().put(
    SERVICES_URL,
    Response.json(services, {
      headers: { "Cache-Control": `max-age=${FLUSH_INTERVAL_MS / 1000}` },
    }),
  );
  return services;
};

const loadSites = async (db: Db): Promise<Site[]> =>
  Promise.all(
    (await listWebsites(db)).map(async (w) => ({ ...w, apis: await listApis(db, w.domain) })),
  );

// Runs every minute; statuses are buffered in the Durable Object, and every 15 minutes they are
// written to the DB, then the site list and page cache are refreshed from it. `now` is the cron's exact scheduled time, so
// run-to-run jitter can't push a flush back a minute.
export const checkAllWebsites = async (
  db: Db,
  apiToken: string,
  now: number,
  store: DurableObjectStub<MonitorState>,
) => {
  let state = (await store.load()) as State | undefined;
  if (!state) {
    state = {
      sites: await loadSites(db),
      triggers: Object.fromEntries((await listTriggers(db)).map((t) => [t.domain, +t.limit])),
      pending: {},
      flushedAt: 0,
    };
  }

  for (const [domain, limit] of Object.entries(state.triggers)) {
    if (limit <= now - TRIGGER_TTL_MS) delete state.triggers[domain];
  }

  for (const { domain, url, zoneId, apis } of state.sites) {
    if (state.triggers[domain]) {
      const ratio = await recentBlockRatio(apiToken, zoneId, ATTACK_CHECK_WINDOW_MINUTES);
      if (ratio <= ATTACK_BLOCK_RATIO_THRESHOLD) {
        await changeRule(apiToken, zoneId, false);
        delete state.triggers[domain];
      }
      continue;
    }

    let anyFailing = false;
    for (const api of [...apis, { url, method: null, header: null, body: null }]) {
      const method = api.method ?? "GET";
      const result = await checkUrl(api.url, {
        method,
        headers: api.header ?? undefined,
        body: method !== "GET" ? JSON.stringify(api.body) : undefined,
      });
      if (!result) continue;
      (state.pending[domain] ??= []).push(result.status);
      if (!result.ok) anyFailing = true;
    }

    if (anyFailing) {
      await changeRule(apiToken, zoneId, true);
      state.triggers[domain] = now + TRIGGER_TTL_MS;
    }
  }

  if (now - state.flushedAt >= FLUSH_INTERVAL_MS) {
    for (const [domain, statuses] of Object.entries(state.pending)) {
      await recordStatus(db, domain, statuses);
    }
    await replaceTriggers(
      db,
      Object.entries(state.triggers).map(([domain, limit]) => ({ domain, limit: new Date(limit) })),
    );
    state.pending = {};
    state.flushedAt = now;
    await store.save(state); // a failed refresh below must not push these statuses twice
    state.sites = await loadSites(db); // pick up config changes
    await refreshServices(db);
  }

  await store.save(state);
};
