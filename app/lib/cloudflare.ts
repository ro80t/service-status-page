const API_BASE = "https://api.cloudflare.com/client/v4";

export type CloudflareRule = {
  id?: string;
  description?: string;
  action?: string;
  expression?: string;
  enabled?: boolean;
};

type CloudflareRuleset = {
  id: string;
  rules?: CloudflareRule[];
};

const cf = async <T>(apiToken: string, path: string, init?: RequestInit): Promise<T | null> => {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!response.ok) return null;
  const body = (await response.json()) as { success: boolean; result: T };
  return body.success ? body.result : null;
};

export const listRulesets = (apiToken: string, zoneId: string) =>
  cf<{ id: string }[]>(apiToken, `/zones/${zoneId}/rulesets`).then((r) => r ?? []);

export const getRuleset = (apiToken: string, zoneId: string, rulesetId: string) =>
  cf<CloudflareRuleset>(apiToken, `/zones/${zoneId}/rulesets/${rulesetId}`);

export const setRuleEnabled = (
  apiToken: string,
  zoneId: string,
  rulesetId: string,
  rule: CloudflareRule,
  enabled: boolean,
) =>
  cf(apiToken, `/zones/${zoneId}/rulesets/${rulesetId}/rules/${rule.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      enabled,
      action: rule.action ?? "block",
      expression: rule.expression,
      description: rule.description,
    }),
  });

// ponytail: zone-wide block/challenge ratio, not scoped to our auto: rules specifically.
// Narrow with a ruleId filter if that turns out too noisy.
export const recentBlockRatio = async (apiToken: string, zoneId: string, sinceMinutes: number) => {
  const since = new Date(Date.now() - sinceMinutes * 60 * 1000).toISOString();
  const response = await fetch("https://api.cloudflare.com/client/v4/graphql", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `query($zoneTag: String!, $since: Time!) {
        viewer {
          zones(filter: { zoneTag: $zoneTag }) {
            blocked: firewallEventsAdaptiveGroups(
              filter: { datetime_geq: $since, action_in: ["block", "challenge", "managed_challenge", "js_challenge"] }
              limit: 1
            ) { count }
            total: httpRequestsAdaptiveGroups(filter: { datetime_geq: $since }, limit: 1) { count }
          }
        }
      }`,
      variables: { zoneTag: zoneId, since },
    }),
  });
  // fail-safe: unknown ratio must not look "below threshold"
  if (!response.ok) return Number.POSITIVE_INFINITY;
  const body = (await response.json()) as {
    data?: {
      viewer?: {
        zones?: { blocked?: { count: number }[]; total?: { count: number }[] }[];
      };
    };
  };
  const zone = body.data?.viewer?.zones?.[0];
  const blocked = zone?.blocked?.[0]?.count ?? 0;
  const total = zone?.total?.[0]?.count ?? 0;
  return total > 0 ? blocked / total : 0;
};
