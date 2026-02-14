import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { NombaClient } from "../client.js";
import { jsonResponse, errorResponse, logToolCall } from "../utils.js";

export function registerTransferTools(
  server: McpServer,
  client: NombaClient
): void {
  server.registerTool(
    "nomba_list_banks",
    {
      title: "List Bank Codes",
      description:
        "Fetch the list of all Nigerian bank codes and names. Use this before making bank transfers to get the correct bankCode for the recipient's bank.",
    },
    async () => {
      logToolCall("nomba_list_banks");
      try {
        const result = await client.get("/v1/transfers/banks");
        return jsonResponse(result);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  server.registerTool(
    "nomba_lookup_bank_account",
    {
      title: "Lookup Bank Account",
      description:
        "Validate a bank account by looking up the account holder's name. Always call this before initiating a bank transfer to confirm the recipient is correct.",
      inputSchema: {
        accountNumber: z
          .string()
          .length(10)
          .describe("10-digit Nigerian bank account number"),
        bankCode: z
          .string()
          .describe("Bank code obtained from the nomba_list_banks tool"),
      },
    },
    async ({ accountNumber, bankCode }) => {
      logToolCall("nomba_lookup_bank_account", { accountNumber, bankCode });
      try {
        const result = await client.post(
          "/v1/transfers/bank-account-lookup",
          { accountNumber, bankCode }
        );
        return jsonResponse(result);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  server.registerTool(
    "nomba_transfer_to_bank",
    {
      title: "Transfer to Bank Account",
      description:
        // Nomba is NGN-only
        "Transfer funds from the Nomba account to an external Nigerian bank account. Amount is in Naira (NGN). Always use nomba_lookup_bank_account first to verify the recipient.",
      inputSchema: {
        amount: z.number().positive().describe("Amount in Naira to transfer"),
        accountNumber: z
          .string()
          .length(10)
          .describe("Recipient 10-digit bank account number"),
        bankCode: z.string().describe("Recipient bank code"),
        narration: z
          .string()
          .optional()
          .describe("Transfer description/narration"),
      },
    },
    async ({ amount, accountNumber, bankCode, narration }) => {
      logToolCall("nomba_transfer_to_bank", { amount, accountNumber, bankCode });
      try {
        const result = await client.post("/v1/transfers/to-banks", {
          amount,
          accountNumber,
          bankCode,
          narration,
        });
        return jsonResponse(result);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  server.registerTool(
    "nomba_transfer_between_accounts",
    {
      title: "Transfer Between Nomba Accounts",
      description:
        // Nomba is NGN-only
        "Transfer funds between two Nomba accounts (e.g., parent to sub-account or between sub-accounts). Amount is in Naira (NGN).",
      inputSchema: {
        amount: z.number().positive().describe("Amount in Naira to transfer"),
        destinationAccountId: z
          .string()
          .describe("Destination Nomba account ID (UUID)"),
        narration: z
          .string()
          .optional()
          .describe("Transfer description/narration"),
      },
    },
    async ({ amount, destinationAccountId, narration }) => {
      logToolCall("nomba_transfer_between_accounts", { amount, destinationAccountId });
      try {
        const result = await client.post(
          "/v1/transfers/between-accounts",
          { amount, destinationAccountId, narration }
        );
        return jsonResponse(result);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );
}
