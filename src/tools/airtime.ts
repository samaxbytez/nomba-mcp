import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { NombaClient } from "../client.js";
import {
  jsonResponse,
  errorResponse,
  logToolCall,
  NETWORKS,
  newMerchantTxRef,
} from "../utils.js";
import { SpendingGuard } from "../spending-guard.js";

const phoneNumber = z
  .string()
  .describe("Nigerian phone number (e.g., 08012345678 or 2348012345678)");
const network = z
  .enum(NETWORKS)
  .describe("Network provider: MTN, AIRTEL, GLO or 9MOBILE");

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
        "Purchase airtime/credit for a Nigerian phone number from the parent account. Amount is in Naira.",
      annotations: { readOnlyHint: false, destructiveHint: true },
      inputSchema: {
        phoneNumber,
        amount: z
          .number()
          .positive()
          .max(guard.config.maxTransaction)
          .describe("Amount of airtime in Naira"),
        network,
      },
    },
    async ({ phoneNumber, amount, network }) => {
      logToolCall("nomba_buy_airtime", { phoneNumber, amount, network });
      try {
        guard.validate(amount, phoneNumber);
        const body = { phoneNumber, amount, network, merchantTxRef: newMerchantTxRef() };
        const result = await client.post("/v2/bill/topup", body);
        guard.record(amount, phoneNumber);
        return jsonResponse({ merchantTxRef: body.merchantTxRef, result });
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
        "Fetch available data bundle plans for a network provider. Returns plan names, prices, and the productId needed to buy a bundle.",
      annotations: { readOnlyHint: true, destructiveHint: false },
      inputSchema: { network },
    },
    async ({ network }) => {
      logToolCall("nomba_list_data_plans", { network });
      try {
        const result = await client.get(`/v1/bill/data-plan/${network.toLowerCase()}`);
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
        "Purchase a data bundle for a Nigerian phone number. Use nomba_list_data_plans first to get the plan's productId and price.",
      annotations: { readOnlyHint: false, destructiveHint: true },
      inputSchema: {
        phoneNumber,
        dataPlanCode: z
          .string()
          .describe("The plan's productId from nomba_list_data_plans"),
        amount: z
          .number()
          .positive()
          .max(guard.config.maxTransaction)
          .describe("The plan's price in Naira, from nomba_list_data_plans"),
        network,
      },
    },
    async ({ phoneNumber, dataPlanCode, amount, network }) => {
      logToolCall("nomba_buy_data", { phoneNumber, dataPlanCode, network });
      try {
        guard.validate(amount, `${phoneNumber}:${dataPlanCode}`);
        const body = {
          productId: dataPlanCode,
          amount,
          phoneNumber,
          network,
          merchantTxRef: newMerchantTxRef(),
        };
        const result = await client.post("/v2/bill/data", body);
        guard.record(amount, `${phoneNumber}:${dataPlanCode}`);
        return jsonResponse({ merchantTxRef: body.merchantTxRef, result });
      } catch (error) {
        return errorResponse(error);
      }
    }
  );
}
