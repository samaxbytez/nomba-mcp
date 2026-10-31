import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SENSITIVE_TOOLS, withToolPolicy } from "./policy.js";
import { SpendingGuard } from "./spending-guard.js";
import { registerAccountTools } from "./tools/accounts.js";
import { registerTransferTools } from "./tools/transfers.js";
import { registerCheckoutTools } from "./tools/checkout.js";
import { registerVirtualAccountTools } from "./tools/virtual-accounts.js";
import { registerTransactionTools } from "./tools/transactions.js";
import { registerBillTools } from "./tools/bills/index.js";
import { registerAirtimeTools } from "./tools/airtime.js";
import { registerSubAccountTools } from "./tools/sub-accounts.js";
import type { NombaClient } from "./client.js";

function build(allowSensitive: boolean) {
  const server = withToolPolicy(new McpServer({ name: "t", version: "0" }), { allowSensitive });
  const client = {} as NombaClient;
  const guard = new SpendingGuard({ maxTransaction: 1, sessionSpendingCap: 1, duplicateWindowMs: 1 });
  registerAccountTools(server, client);
  registerTransferTools(server, client, guard);
  registerCheckoutTools(server, client, guard);
  registerVirtualAccountTools(server, client);
  registerTransactionTools(server, client);
  registerBillTools(server, client, guard);
  registerAirtimeTools(server, client, guard);
  registerSubAccountTools(server, client);
  return (server as any)._registeredTools as Record<string, { annotations?: Record<string, unknown> }>;
}

describe("tool policy", () => {
  let spy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    spy = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => spy.mockRestore());

  it("hides every sensitive tool by default", () => {
    const names = Object.entries(build(false))
      .filter(([, t]) => (t as { enabled?: boolean }).enabled !== false)
      .map(([n]) => n);
    for (const s of SENSITIVE_TOOLS) expect(names).not.toContain(s);
    expect(names.length).toBeGreaterThan(0);
  });

  it("registers every sensitive tool when enabled, all marked destructive", () => {
    const tools = build(true);
    for (const s of SENSITIVE_TOOLS) {
      expect(tools[s], s).toBeDefined();
      expect(tools[s].annotations?.destructiveHint, s).toBe(true);
    }
  });

  it("keeps lookups read-only", () => {
    const tools = build(false);
    expect(tools["nomba_lookup_bank_account"].annotations?.readOnlyHint).toBe(true);
  });
});
