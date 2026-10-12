import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { NombaClient } from "../client.js";
import {
  jsonResponse,
  errorResponse,
  logToolCall,
  safeId,
  newMerchantTxRef,
} from "../utils.js";
import { SpendingGuard } from "../spending-guard.js";

const merchantTxRef = z
  .string()
  .min(1)
  .max(64)
  .optional()
  .describe(
    "Your unique reference for this transfer. Nomba uses it to deduplicate. Generated if omitted and returned in the result."
  );

export function registerTransferTools(
  server: McpServer,
  client: NombaClient,
  guard: SpendingGuard
): void {
  server.registerTool(
    "nomba_list_banks",
    {
      title: "List Bank Codes",
      description:
        "Fetch the list of all Nigerian bank codes and names. Use this before making bank transfers to get the correct bankCode for the recipient's bank.",
      annotations: { readOnlyHint: true, destructiveHint: false },
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
        "Validate a bank account by looking up the account holder's name. Always call this before initiating a bank transfer to confirm the recipient is correct; the transfer needs the returned accountName.",
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
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
        const result = await client.post("/v1/transfers/bank/lookup", {
          accountNumber,
          bankCode,
        });
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
        "Transfer funds from the parent Nomba account to an external Nigerian bank account. Amount is in Naira (NGN). Call nomba_lookup_bank_account first and pass its accountName. The result status may be SUCCESS or PENDING_BILLING; use nomba_requery_transaction with the sessionId to confirm.",
      annotations: { readOnlyHint: false, destructiveHint: true },
      inputSchema: {
        amount: z
          .number()
          .positive()
          .max(guard.config.maxTransaction)
          .describe("Amount in Naira to transfer"),
        accountNumber: z
          .string()
          .length(10)
          .describe("Recipient 10-digit bank account number"),
        accountName: z
          .string()
          .min(1)
          .describe("Recipient account name, as returned by nomba_lookup_bank_account"),
        bankCode: z.string().describe("Recipient bank code"),
        narration: z.string().optional().describe("Transfer description/narration"),
        senderName: z.string().optional().describe("Sender name shown to the recipient"),
        merchantTxRef,
      },
    },
    async ({
      amount,
      accountNumber,
      accountName,
      bankCode,
      narration,
      senderName,
      merchantTxRef: ref,
    }) => {
      logToolCall("nomba_transfer_to_bank", { amount, accountNumber, bankCode });
      try {
        guard.validate(amount, accountNumber);
        const body: Record<string, unknown> = {
          amount,
          accountNumber,
          accountName,
          bankCode,
          merchantTxRef: ref ?? newMerchantTxRef(),
        };
        if (narration) body.narration = narration;
        if (senderName) body.senderName = senderName;
        const result = await client.post("/v2/transfers/bank", body);
        guard.record(amount, accountNumber);
        return jsonResponse({ merchantTxRef: body.merchantTxRef, result });
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
        "Transfer funds from the parent account to another Nomba account (wallet/P2P transfer). Settles near-instantly. Amount is in Naira (NGN). Wallet transfers return no sessionId; use nomba_get_transaction with the merchantTxRef to check status.",
      annotations: { readOnlyHint: false, destructiveHint: true },
      inputSchema: {
        amount: z
          .number()
          .positive()
          .max(guard.config.maxTransaction)
          .describe("Amount in Naira to transfer"),
        destinationAccountId: safeId.describe("Receiving Nomba account ID (UUID)"),
        narration: z.string().optional().describe("Transfer description/narration"),
        merchantTxRef,
      },
    },
    async ({ amount, destinationAccountId, narration, merchantTxRef: ref }) => {
      logToolCall("nomba_transfer_between_accounts", { amount, destinationAccountId });
      try {
        guard.validate(amount, destinationAccountId);
        const body: Record<string, unknown> = {
          amount,
          receiverAccountId: destinationAccountId,
          merchantTxRef: ref ?? newMerchantTxRef(),
        };
        if (narration) body.narration = narration;
        const result = await client.post("/v2/transfers/wallet", body);
        guard.record(amount, destinationAccountId);
        return jsonResponse({ merchantTxRef: body.merchantTxRef, result });
      } catch (error) {
        return errorResponse(error);
      }
    }
  );
}
