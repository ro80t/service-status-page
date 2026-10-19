import type { Db } from "../db/client";
import { listApis, listTriggers, listWebsites, recordStatus, replaceTriggers } from "../db/repo";
import { getRuleset, listRulesets, recentBlockRatio, setRuleEnabled } from "./cloudflare";
import { checkUrl } from "./status-check";

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

const FLUSH_INTERVAL_MS = 10 * 60 * 1000;
const TRIGGER_TTL_MS = 60 * 60 * 1000;
const STATE_URL = "https://state.internal/monitor";

type Target = {
  url: string;
  method: string | null;
  header: Record<string, string> | null;
  body: unknown;
};
type Site = { domain: string; url: string; zoneId: string; apis: Target[] };
// Everything the per-minute cron needs, so it only touches the DB on a flush.
type State = {
  sites: Site[];
  triggers: Record<string, number>; // domain -> limit (ms)
  pending: Record<string, number[]>; // statuses not yet pushed to the DB
  flushedAt: number;
};

// ponytail: Cache API is per-colo and evictable, and a no-op on workers.dev. A miss just
// means an immediate flush (= the old behaviour); move to a Durable Object if it must be exact.
const loadState = async (): Promise<State | null> =>
  (await (caches as unknown as { default: Cache }).default.match(STATE_URL))?.json<State>() ?? null;

const saveState = (state: State) =>
  (caches as unknown as { default: Cache }).default.put(
    STATE_URL,
    Response.json(state, { headers: { "Cache-Control": "max-age=86400" } }),
  );

const loadSites = async (db: Db): Promise<Site[]> =>
  Promise.all(
    (await listWebsites(db)).map(async (w) => ({ ...w, apis: await listApis(db, w.domain) })),
  );

// Runs every minute; statuses are buffered in the cache and written to the DB every 10 minutes.
export const checkAllWebsites = async (db: Db, apiToken: string) => {
  const now = Date.now();
  let state = await loadState();
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
    state.sites = await loadSites(db); // pick up config changes
    state.pending = {};
    state.flushedAt = now;
  }

  await saveState(state);
};
