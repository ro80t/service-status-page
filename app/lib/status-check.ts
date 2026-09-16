const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export type CheckResult = { ok: boolean; status: number };

export const checkUrl = async (url: string, init?: RequestInit): Promise<CheckResult | null> => {
  try {
    const response = await fetch(url, { method: "GET", ...init });
    if (response.status === 429) {
      await sleep(3000);
      return checkUrl(url, init);
    }
    return { ok: response.ok, status: response.status };
  } catch {
    return null;
  }
};

export type ParsedStatus = "ok" | "unstable" | "error" | "unknown";

const classify = (status: number): ParsedStatus => {
  if (status >= 200 && status < 300) return "ok";
  if (status >= 400) return "error";
  return "unknown";
};

export const summarizeDay = (statusCodes: number[]): ParsedStatus => {
  if (statusCodes.length === 0) return "unknown";
  const errorCount = statusCodes.filter((code) => classify(code) === "error").length;
  if (errorCount >= statusCodes.length / 2) return "error";
  if (errorCount >= statusCodes.length / 4) return "unstable";
  return "ok";
};
