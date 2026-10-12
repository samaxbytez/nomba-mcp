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

// The API has no providers endpoint; these are the cableTvType values it accepts
const CABLE_PROVIDERS = ["dstv", "gotv", "startimes", "showmax"] as const;

const smartcardNumber = z.string().describe("The smartcard or IUC number");
const providerCode = z
  .enum(CABLE_PROVIDERS)
  .describe("Cable TV provider: dstv, gotv, startimes or showmax");

export function registerCableTools(
  server: McpServer,
  client: NombaClient,
  guard: SpendingGuard
): void {
  server.registerTool(
    "nomba_get_cable_providers",
    {
      title: "Get Cable TV Providers",
      description:
        "List the supported cable TV providers (DSTV, GOtv, Startimes, Showmax). Use a provider code with nomba_list_cable_plans or nomba_lookup_cable_customer.",
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async () => {
      logToolCall("nomba_get_cable_providers");
      return jsonResponse({ providers: CABLE_PROVIDERS });
    }
  );

  server.registerTool(
    "nomba_list_cable_plans",
    {
      title: "List Cable TV Plans",
      description:
        "Fetch the subscription plans (bouquets) and prices for a cable TV provider.",
      annotations: { readOnlyHint: true, destructiveHint: false },
      inputSchema: { providerCode },
    },
    async ({ providerCode }) => {
      logToolCall("nomba_list_cable_plans", { providerCode });
      try {
        const result = await client.get("/v1/bill/cableTvProduct", {
          cableTvType: providerCode,
        });
        return jsonResponse(result);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  server.registerTool(
    "nomba_lookup_cable_customer",
    {
      title: "Lookup Cable TV Customer",
      description:
        "Validate a cable TV smartcard/IUC number and get the customer's name. Always use this before paying for a cable subscription.",
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
      inputSchema: { smartcardNumber, providerCode },
    },
    async ({ smartcardNumber, providerCode }) => {
      logToolCall("nomba_lookup_cable_customer", { smartcardNumber, providerCode });
      try {
        const result = await client.get("/v1/bill/cabletv/lookup", {
          customerId: smartcardNumber,
          cableTvType: providerCode,
        });
        return jsonResponse(result);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  server.registerTool(
    "nomba_pay_cable_subscription",
    {
      title: "Pay Cable TV Subscription",
      description:
        "Pay for a cable TV subscription (DSTV, GOtv, Startimes, Showmax). Amount is in whole Naira and should match a plan price from nomba_list_cable_plans.",
      annotations: { readOnlyHint: false, destructiveHint: true },
      inputSchema: {
        smartcardNumber,
        providerCode,
        amount: z
          .number()
          .int()
          .positive()
          .max(guard.config.maxTransaction)
          .describe("Amount in whole Naira to pay"),
        payerName: z.string().optional().describe("Name of the person paying"),
      },
    },
    async ({ smartcardNumber, providerCode, amount, payerName }) => {
      logToolCall("nomba_pay_cable_subscription", {
        smartcardNumber,
        providerCode,
        amount,
      });
      try {
        guard.validate(amount, smartcardNumber);
        const body: Record<string, unknown> = {
          cableTvType: providerCode,
          customerId: smartcardNumber,
          amount,
          merchantTxRef: newMerchantTxRef(),
        };
        if (payerName) body.payerName = payerName;
        const result = await client.post("/v2/bill/cabletv", body);
        guard.record(amount, smartcardNumber);
        return jsonResponse({ merchantTxRef: body.merchantTxRef, result });
      } catch (error) {
        return errorResponse(error);
      }
    }
  );
}
