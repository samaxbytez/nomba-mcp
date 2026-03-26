import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { NombaClient } from "../client.js";
import { jsonResponse, errorResponse, logToolCall } from "../utils.js";
import { SpendingGuard } from "../spending-guard.js";

export function registerAirtimeTools(
  server: McpServer,
  client: NombaClient,
  guard: SpendingGuard
): void {
  server.registerTool(
    "nomba_buy_airtime",
    {
      title: "Buy Airtime",
      description:
        "Purchase airtime/credit for a Nigerian phone number. Amount is in Naira. Supports all major networks (MTN, Airtel, Glo, 9mobile).",
      annotations: { readOnlyHint: false, destructiveHint: true },
      inputSchema: {
        phoneNumber: z
          .string()
          .describe(
            "Nigerian phone number (e.g., 08012345678 or 2348012345678)"
          ),
        amount: z
          .number()
          .positive()
          .max(guard.config.maxTransaction)
          .describe("Amount of airtime in Naira"),
        network: z
          .string()
          .optional()
          .describe(
            "Network provider (e.g., MTN, AIRTEL, GLO, 9MOBILE). Auto-detected if omitted."
          ),
      },
    },
    async ({ phoneNumber, amount, network }) => {
      logToolCall("nomba_buy_airtime", { phoneNumber, amount, network });
      try {
        guard.validate(amount, phoneNumber);
        const body: Record<string, unknown> = { phoneNumber, amount };
        if (network) body.network = network;
        const result = await client.post("/v1/bills/airtime/pay", body);
        guard.record(amount, phoneNumber);
        return jsonResponse(result);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  server.registerTool(
    "nomba_list_data_plans",
    {
      title: "List Data Plans",
      description:
        "Fetch available data bundle plans for a specific network provider. Returns plan names, data amounts, prices, and plan codes needed for purchasing.",
      annotations: { readOnlyHint: true, destructiveHint: false },
      inputSchema: {
        network: z
          .string()
          .describe(
            "Network provider (e.g., MTN, AIRTEL, GLO, 9MOBILE)"
          ),
      },
    },
    async ({ network }) => {
      logToolCall("nomba_list_data_plans", { network });
      try {
        const result = await client.get(
          "/v1/bills/data/plans",
          { network }
        );
        return jsonResponse(result);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  server.registerTool(
    "nomba_buy_data",
    {
      title: "Buy Data Bundle",
      description:
        "Purchase a data bundle for a Nigerian phone number. Use nomba_list_data_plans first to get available plans and their codes.",
      annotations: { readOnlyHint: false, destructiveHint: true },
      inputSchema: {
        phoneNumber: z
          .string()
          .describe(
            "Nigerian phone number (e.g., 08012345678 or 2348012345678)"
          ),
        dataPlanCode: z
          .string()
          .describe(
            "Data plan code from nomba_list_data_plans"
          ),
        network: z
          .string()
          .describe(
            "Network provider (e.g., MTN, AIRTEL, GLO, 9MOBILE)"
          ),
      },
    },
    async ({ phoneNumber, dataPlanCode, network }) => {
      logToolCall("nomba_buy_data", { phoneNumber, dataPlanCode, network });
      try {
        guard.validate(0, `${phoneNumber}:${dataPlanCode}`);
        const result = await client.post("/v1/bills/data/pay", {
          phoneNumber,
          dataPlanCode,
          network,
        });
        guard.record(0, `${phoneNumber}:${dataPlanCode}`);
        return jsonResponse(result);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );
}
