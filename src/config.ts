const KNOWN_HOSTS = new Set(["sandbox.nomba.com", "api.nomba.com"]);

export function parsePositive(name: string, raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`${name} must be a positive number, got "${raw}"`);
  }
  return n;
}

export function parseCount(name: string, raw: string | undefined, fallback: number): number {
  const n = parsePositive(name, raw, fallback);
  if (!Number.isInteger(n)) throw new Error(`${name} must be a whole number, got "${raw}"`);
  return n;
}

/** Decides from the parsed hostname, so API.NOMBA.COM and lookalike hosts can't slip past. */
export function classifyBaseUrl(baseUrl: string, allowOtherHosts: boolean): "sandbox" | "production" | "other" {
  let host: string;
  try {
    host = new URL(baseUrl).hostname.toLowerCase();
  } catch {
    throw new Error("NOMBA_BASE_URL is not a valid URL");
  }
  if (host === "api.nomba.com") return "production";
  if (KNOWN_HOSTS.has(host)) return "sandbox";
  if (!allowOtherHosts) {
    throw new Error(
      `NOMBA_BASE_URL host "${host}" is not a Nomba host. Set NOMBA_ALLOW_INSECURE=true only for a local test API.`
    );
  }
  return "other";
}

/** NOMBA_ALLOWED_CALLBACK_HOSTS="example.com,app.example.com": empty means no restriction. */
export function parseHostList(raw: string | undefined): string[] {
  return (raw ?? "").split(",").map((h) => h.trim().toLowerCase()).filter(Boolean);
}

export function callbackHostAllowed(url: string, allowed: string[]): boolean {
  if (allowed.length === 0) return true;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return allowed.some((a) => host === a || host.endsWith(`.${a}`));
  } catch {
    return false;
  }
}
