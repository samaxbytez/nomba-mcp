import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { NombaClient } from "../../client.js";
import {
  jsonResponse,
  errorResponse,
  logToolCall,
  newMerchantTxRef,
} from "../../utils.js";
import { SpendingGuard } from "../../spending-guard.js";

const customerId = z.string().describe("The customer's betting account ID/username");
const providerCode = z
  .string()
  .describe("Betting provider code from nomba_get_betting_providers");

export function registerBettingTools(
  server: McpServer,
  client: NombaClient,
  guard: SpendingGuard
): void {
  server.registerTool(
    "nomba_get_betting_providers",
    {
      title: "Get Betting Providers",
      description:
        "Fetch the list of available betting platforms. Use this to get provider codes before funding a betting account.",
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async () => {
      logToolCall("nomba_get_betting_providers");
      try {
        const result = await client.get("/v1/bill/betting/providers");
        return jsonResponse(result);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  server.registerTool(
    "nomba_lookup_betting_customer",
    {
      title: "Lookup Betting Customer",
      description:
        "Validate a betting account and get the customer's name. Use this before funding the account.",
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
      inputSchema: { customerId, providerCode },
    },
    async ({ customerId, providerCode }) => {
      logToolCall("nomba_lookup_betting_customer", { customerId, providerCode });
      try {
        const result = await client.get("/v1/bill/betting/lookup", {
          providerId: providerCode,
          customerId,
        });
        return jsonResponse(result);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  server.registerTool(
    "nomba_fund_betting_account",
    {
      title: "Fund Betting Account",
      description:
        "Fund a customer's betting account on a supported betting platform. Amount is in whole Naira.",
      annotations: { readOnlyHint: false, destructiveHint: true },
      inputSchema: {
        customerId,
        providerCode,
        amount: z
          .number()
          .int()
          .positive()
          .max(guard.config.maxTransaction)
          .describe("Amount in whole Naira to fund"),
        payerName: z.string().optional().describe("Name of the person paying"),
        phoneNumber: z.string().optional().describe("Customer's phone number"),
      },
    },
    async ({ customerId, providerCode, amount, payerName, phoneNumber }) => {
      logToolCall("nomba_fund_betting_account", { customerId, providerCode, amount });
      try {
        guard.validate(amount, customerId);
        const body: Record<string, unknown> = {
          bettingProvider: providerCode,
          customerId,
          amount,
          merchantTxRef: newMerchantTxRef(),
        };
        if (payerName) body.payerName = payerName;
        if (phoneNumber) body.phoneNumber = phoneNumber;
        const result = await client.post("/v2/bill/betting", body);
        guard.record(amount, customerId);
        return jsonResponse({ merchantTxRef: body.merchantTxRef, result });
      } catch (error) {
        return errorResponse(error);
      }
    }
  );
}
