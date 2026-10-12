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

const meterNumber = z.string().describe("The electricity meter number");
const providerCode = z
  .string()
  .describe("Electricity provider (disco) code from nomba_get_electricity_providers");

export function registerElectricityTools(
  server: McpServer,
  client: NombaClient,
  guard: SpendingGuard
): void {
  server.registerTool(
    "nomba_get_electricity_providers",
    {
      title: "Get Electricity Providers",
      description:
        "Fetch the list of available electricity distribution companies (DisCos). Use this to get provider codes before purchasing electricity tokens.",
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async () => {
      logToolCall("nomba_get_electricity_providers");
      try {
        const result = await client.get("/v1/bill/electricity/discos");
        return jsonResponse(result);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  server.registerTool(
    "nomba_lookup_electricity_customer",
    {
      title: "Lookup Electricity Customer",
      description:
        "Validate an electricity meter number and get the customer's name. Always use this before purchasing electricity to confirm the meter details.",
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
      inputSchema: { meterNumber, providerCode },
    },
    async ({ meterNumber, providerCode }) => {
      logToolCall("nomba_lookup_electricity_customer", { meterNumber, providerCode });
      try {
        const result = await client.get("/v1/bill/electricity/lookup", {
          disco: providerCode,
          customerId: meterNumber,
        });
        return jsonResponse(result);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  server.registerTool(
    "nomba_buy_electricity",
    {
      title: "Buy Electricity",
      description:
        "Purchase electricity tokens for a prepaid meter or pay a postpaid electricity bill. Amount is in whole Naira.",
      annotations: { readOnlyHint: false, destructiveHint: true },
      inputSchema: {
        meterNumber,
        providerCode,
        meterType: z
          .enum(["prepaid", "postpaid"])
          .describe("Type of meter: prepaid or postpaid"),
        amount: z
          .number()
          .int()
          .positive()
          .max(guard.config.maxTransaction)
          .describe("Amount in whole Naira to pay"),
        payerName: z.string().optional().describe("Name of the person paying"),
      },
    },
    async ({ meterNumber, providerCode, meterType, amount, payerName }) => {
      logToolCall("nomba_buy_electricity", {
        meterNumber,
        providerCode,
        meterType,
        amount,
      });
      try {
        guard.validate(amount, meterNumber);
        const body: Record<string, unknown> = {
          disco: providerCode,
          customerId: meterNumber,
          meterType,
          amount,
          merchantTxRef: newMerchantTxRef(),
        };
        if (payerName) body.payerName = payerName;
        const result = await client.post("/v2/bill/electricity", body);
        guard.record(amount, meterNumber);
        return jsonResponse({ merchantTxRef: body.merchantTxRef, result });
      } catch (error) {
        return errorResponse(error);
      }
    }
  );
}
