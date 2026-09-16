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
