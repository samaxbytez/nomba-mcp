import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { NombaClient } from "../../client.js";
import { jsonResponse, errorResponse, logToolCall } from "../../utils.js";
import { SpendingGuard } from "../../spending-guard.js";

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
        "Fetch the list of available cable TV providers (e.g., DSTV, GOtv, Startimes). Use this to get provider codes before paying for a cable subscription.",
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async () => {
      logToolCall("nomba_get_cable_providers");
      try {
        const result = await client.get("/v1/bills/cabletv/providers");
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
      inputSchema: {
        smartcardNumber: z
          .string()
          .describe("The smartcard or IUC number"),
        providerCode: z.string().describe("Cable TV provider code"),
      },
    },
    async ({ smartcardNumber, providerCode }) => {
      logToolCall("nomba_lookup_cable_customer", { smartcardNumber, providerCode });
      try {
        const result = await client.post(
          "/v1/bills/cabletv/customer-lookup",
          { smartcardNumber, providerCode }
        );
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
        "Pay for a cable TV subscription (DSTV, GOtv, Startimes, etc.). Amount is in Naira.",
      annotations: { readOnlyHint: false, destructiveHint: true },
      inputSchema: {
        smartcardNumber: z
          .string()
          .describe("The smartcard or IUC number"),
        providerCode: z.string().describe("Cable TV provider code"),
        productCode: z
          .string()
          .describe("The subscription plan/bouquet code"),
        amount: z
          .number()
          .positive()
          .max(guard.config.maxTransaction)
          .describe("Amount in Naira to pay"),
      },
    },
    async ({ smartcardNumber, providerCode, productCode, amount }) => {
      logToolCall("nomba_pay_cable_subscription", { smartcardNumber, providerCode, productCode, amount });
      try {
        guard.validate(amount, smartcardNumber);
        const result = await client.post("/v1/bills/cabletv/pay", {
          smartcardNumber,
          providerCode,
          productCode,
          amount,
        });
        guard.record(amount, smartcardNumber);
        return jsonResponse(result);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );
}
