import type { McpServer, RegisteredTool } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";

// Tools that move money or change the account. Text returned by Nomba
// (narrations, account names, references) can be written by third parties, so an
// injected instruction must not be able to reach these unless the user has opted
// in with NOMBA_ENABLE_SENSITIVE_TOOLS=true.
export const SENSITIVE_TOOLS = new Set([
  "nomba_transfer_to_bank",
  "nomba_transfer_between_accounts",
  "nomba_buy_airtime",
  "nomba_buy_data",
  "nomba_buy_electricity",
  "nomba_pay_cable_subscription",
  "nomba_fund_betting_account",
  "nomba_refund_transaction",
  "nomba_cancel_transaction",
  "nomba_charge_tokenized_card",
  "nomba_create_checkout_order",
  "nomba_create_sub_account",
  "nomba_update_sub_account",
  "nomba_suspend_sub_account",
  "nomba_reactivate_sub_account",
  "nomba_create_virtual_account",
  "nomba_update_virtual_account",
  "nomba_expire_virtual_account",
  "nomba_assign_terminal",
  "nomba_unassign_terminal",
]);

// Sensitive tools that send money or data to a party outside the account.
const OPEN_WORLD_TOOLS = new Set([
  "nomba_transfer_to_bank",
  "nomba_buy_airtime",
  "nomba_buy_data",
  "nomba_buy_electricity",
  "nomba_pay_cable_subscription",
  "nomba_fund_betting_account",
  "nomba_refund_transaction",
  "nomba_charge_tokenized_card",
]);

export function annotationsFor(name: string, existing?: ToolAnnotations): ToolAnnotations {
  return {
    ...existing,
    openWorldHint: OPEN_WORLD_TOOLS.has(name),
    ...(SENSITIVE_TOOLS.has(name) ? { readOnlyHint: false, destructiveHint: true } : {}),
  };
}

/**
 * Wraps the server so every tool registered through it gets MCP annotations,
 * and sensitive tools are dropped unless `allowSensitive` is set.
 */
export function withToolPolicy(
  server: McpServer,
  options: { allowSensitive: boolean }
): McpServer {
  return new Proxy(server, {
    get(target, prop, receiver) {
      if (prop !== "registerTool") return Reflect.get(target, prop, receiver);
      const original = Reflect.get(target, prop, receiver) as (
        ...args: unknown[]
      ) => RegisteredTool;
      return (...args: unknown[]) => {
        const name = args[0] as string;
        const config = args[1] as { annotations?: ToolAnnotations };
        const registered = original.apply(target, args);
        if (SENSITIVE_TOOLS.has(name) && !options.allowSensitive) {
          registered.remove();
        } else {
          registered.update({ annotations: annotationsFor(name, config.annotations) });
        }
        return registered;
      };
    },
  });
}
