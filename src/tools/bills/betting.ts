import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { NombaClient } from "../../client.js";
import { jsonResponse, errorResponse, logToolCall } from "../../utils.js";

export function registerBettingTools(
  server: McpServer,
  client: NombaClient
): void {
  server.registerTool(
    "nomba_get_betting_providers",
    {
      title: "Get Betting Providers",
      description:
        "Fetch the list of available betting platforms. Use this to get provider codes before funding a betting account.",
    },
    async () => {
      logToolCall("nomba_get_betting_providers");
      try {
        const result = await client.get("/v1/bills/betting/providers");
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
        "Fund a customer's betting account on a supported betting platform. Amount is in Naira.",
      inputSchema: {
        customerId: z
          .string()
          .describe("The customer's betting account ID/username"),
        providerCode: z.string().describe("Betting provider code"),
        amount: z
          .number()
          .positive()
          .describe("Amount in Naira to fund"),
      },
    },
    async ({ customerId, providerCode, amount }) => {
      logToolCall("nomba_fund_betting_account", { customerId, providerCode, amount });
      try {
        const result = await client.post("/v1/bills/betting/pay", {
          customerId,
          providerCode,
          amount,
        });
        return jsonResponse(result);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );
}
