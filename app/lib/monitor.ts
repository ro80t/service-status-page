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
import { getRuleset, listRulesets, setRuleEnabled } from "./cloudflare";
import { checkUrl } from "./status-check";

const RULE_PREFIX = "auto:";

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

    if (anyFailing && !trigger) {
      await changeRule(apiToken, zoneId, true);
      await insertTrigger(db, domain);
    } else if (!anyFailing && trigger) {
      await changeRule(apiToken, zoneId, false);
      await removeTrigger(db, domain);
    }
  }
};
