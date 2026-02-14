import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { NombaClient } from "../../client.js";
import { jsonResponse, errorResponse, logToolCall } from "../../utils.js";

export function registerElectricityTools(
  server: McpServer,
  client: NombaClient
): void {
  server.registerTool(
    "nomba_get_electricity_providers",
    {
      title: "Get Electricity Providers",
      description:
        "Fetch the list of available electricity distribution companies (DisCos). Use this to get provider codes before purchasing electricity tokens.",
    },
    async () => {
      logToolCall("nomba_get_electricity_providers");
      try {
        const result = await client.get("/v1/bills/electricity/providers");
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
      inputSchema: {
        meterNumber: z.string().describe("The electricity meter number"),
        providerCode: z
          .string()
          .describe(
            "Electricity provider code from nomba_get_electricity_providers"
          ),
        meterType: z
          .enum(["prepaid", "postpaid"])
          .describe("Type of meter: prepaid or postpaid"),
      },
    },
    async ({ meterNumber, providerCode, meterType }) => {
      logToolCall("nomba_lookup_electricity_customer", { meterNumber, providerCode, meterType });
      try {
        const result = await client.post(
          "/v1/bills/electricity/customer-lookup",
          { meterNumber, providerCode, meterType }
        );
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
        "Purchase electricity tokens for a prepaid meter or pay a postpaid electricity bill. Amount is in Naira.",
      inputSchema: {
        meterNumber: z.string().describe("The electricity meter number"),
        providerCode: z.string().describe("Electricity provider code"),
        meterType: z
          .enum(["prepaid", "postpaid"])
          .describe("Type of meter: prepaid or postpaid"),
        amount: z
          .number()
          .positive()
          .describe("Amount in Naira to pay"),
      },
    },
    async ({ meterNumber, providerCode, meterType, amount }) => {
      logToolCall("nomba_buy_electricity", { meterNumber, providerCode, meterType, amount });
      try {
        const result = await client.post("/v1/bills/electricity/pay", {
          meterNumber,
          providerCode,
          meterType,
          amount,
        });
        return jsonResponse(result);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );
}
