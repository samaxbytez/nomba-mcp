export type RedactMode = "full" | "mask4";

export interface RedactRule {
  field: string;
  mode: RedactMode;
}

export const PARENT_ACCOUNT_RULES: RedactRule[] = [
  { field: "bvn", mode: "full" },
  { field: "bankAccountNumber", mode: "mask4" },
];

export const CHECKOUT_RULES: RedactRule[] = [
  { field: "tokenizedCardId", mode: "mask4" },
  { field: "tokenKey", mode: "mask4" },
];

export const TRANSACTION_RULES: RedactRule[] = [
  { field: "ktaSenderAccountNumber", mode: "mask4" },
  { field: "recipientAccountNumber", mode: "mask4" },
  { field: "bankAccountNumber", mode: "mask4" },
  { field: "bvn", mode: "full" },
];

export const VIRTUAL_ACCOUNT_RULES: RedactRule[] = [
  { field: "bvn", mode: "full" },
  { field: "bankAccountNumber", mode: "mask4" },
];

function mask4(value: string): string {
  if (value.length <= 4) return "****";
  return "*".repeat(value.length - 4) + value.slice(-4);
}

function applyRedaction(value: string, mode: RedactMode): string {
  return mode === "full" ? "***REDACTED***" : mask4(value);
}

export function redactResponse(
  data: unknown,
  rules: RedactRule[]
): unknown {
  if (data === null || data === undefined) return data;
  if (typeof data !== "object") return data;

  const fieldMap = new Map(rules.map((r) => [r.field, r.mode]));

  if (Array.isArray(data)) {
    return data.map((item) => redactResponse(item, rules));
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    const mode = fieldMap.get(key);
    if (mode && typeof value === "string") {
      result[key] = applyRedaction(value, mode);
    } else if (typeof value === "object" && value !== null) {
      result[key] = redactResponse(value, rules);
    } else {
      result[key] = value;
    }
  }
  return result;
}
