import { z } from "zod";

export const TOKEN_BUFFER_MS = 60_000;
export const MAX_PAGE_SIZE = 50;
export const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

export const safeId = z
  .string()
  .regex(
    /^[a-zA-Z0-9_-]+$/,
    "ID must contain only alphanumeric characters, hyphens, and underscores"
  );

export function jsonResponse(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

export function errorResponse(error: unknown) {
  const msg = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: "text" as const, text: `Error: ${msg}` }],
    isError: true,
  };
}

export function buildParams(
  obj: Record<string, unknown>
): Record<string, string> {
  const params: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null) params[k] = String(v);
  }
  return params;
}

const SENSITIVE_LOG_FIELDS = new Set([
  "accountNumber",
  "phoneNumber",
  "customerEmail",
  "meterNumber",
  "smartcardNumber",
  "tokenizedCardId",
  "bvn",
]);

function maskValue(value: string): string {
  if (value.length <= 4) return "****";
  return "*".repeat(value.length - 4) + value.slice(-4);
}

export function logToolCall(tool: string, params?: Record<string, unknown>) {
  const sanitized: Record<string, unknown> = { ts: new Date().toISOString(), tool };
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (SENSITIVE_LOG_FIELDS.has(k) && typeof v === "string") {
        sanitized[k] = maskValue(v);
      } else if (typeof v === "string" && v.length > 100) {
        sanitized[k] = v.slice(0, 20) + "...";
      } else {
        sanitized[k] = v;
      }
    }
  }
  console.error(JSON.stringify(sanitized));
}
