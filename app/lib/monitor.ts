import type { Db } from "../db/client";
import {
  deleteExpiredTriggers,
  findTrigger,
  insertTrigger,
  listApis,
  listWebsites,
  recordStatus,
  removeTrigger,
} from "../db/repo";
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

export const checkAllWebsites = async (db: Db, apiToken: string) => {
  await deleteExpiredTriggers(db);

  for (const { domain, url, zoneId } of await listWebsites(db)) {
    const trigger = await findTrigger(db, domain);

    if (trigger) {
      const ratio = await recentBlockRatio(apiToken, zoneId, ATTACK_CHECK_WINDOW_MINUTES);
      if (ratio <= ATTACK_BLOCK_RATIO_THRESHOLD) {
        await changeRule(apiToken, zoneId, false);
        await removeTrigger(db, domain);
      }
      continue;
    }

    const targets = (await listApis(db, domain)).concat({
      domain,
      url,
      method: null,
      header: null,
      body: null,
    });

    let anyFailing = false;
    for (const api of targets) {
      const method = api.method ?? "GET";
      const result = await checkUrl(api.url, {
        method,
        headers: api.header ?? undefined,
        body: method !== "GET" ? JSON.stringify(api.body) : undefined,
      });
      if (!result) continue;
      await recordStatus(db, domain, result.status);
      if (!result.ok) anyFailing = true;
    }

    if (anyFailing) {
      await changeRule(apiToken, zoneId, true);
      await insertTrigger(db, domain);
    }
  }
};
