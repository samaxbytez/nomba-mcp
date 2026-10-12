import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { NombaClient } from "../client.js";
import {
  jsonResponse,
  errorResponse,
  logToolCall,
  buildParams,
  safeId,
} from "../utils.js";
import { redactResponse, TRANSACTION_RULES } from "../redact.js";

const paging = {
  limit: z
    .number()
    .int()
    .positive()
    .max(50)
    .optional()
    .describe("Number of results per page (max 50)"),
  cursor: z.string().optional().describe("Pagination cursor from a previous response"),
  dateFrom: z
    .string()
    .optional()
    .describe("Start date in UTC format (e.g., 2024-01-01T00:00:00Z)"),
  dateTo: z
    .string()
    .optional()
    .describe("End date in UTC format (e.g., 2024-12-31T23:59:59Z)"),
};

export function registerTransactionTools(server: McpServer, client: NombaClient): void {
  server.registerTool(
    "nomba_list_bank_transactions",
    {
      title: "List Bank Transactions",
      description:
        "Fetch credit/debit (bank) transactions for the parent Nomba account. Supports filtering by date range and pagination. Returns transaction amounts, types, statuses, and metadata.",
      annotations: { readOnlyHint: true, destructiveHint: false },
      inputSchema: paging,
    },
    async ({ limit, cursor, dateFrom, dateTo }) => {
      logToolCall("nomba_list_bank_transactions", { limit, dateFrom, dateTo });
      try {
        const params = buildParams({ limit, cursor, dateFrom, dateTo });
        const result = await client.get("/v1/transactions/bank", params);
        return jsonResponse(redactResponse(result, TRANSACTION_RULES));
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  server.registerTool(
    "nomba_requery_transaction",
    {
      title: "Requery Transaction",
      description:
        "Confirm the status of a transaction using its session ID. Final statuses: SUCCESS (delivered), REFUND (funds returned; refund your customer), CANCELLED. PENDING_BILLING, PROCESSING, PAYMENT_FAILED and REVERSED_BY_VENDOR may still change.",
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
      inputSchema: {
        sessionId: safeId.describe("The session ID of the transaction to requery"),
      },
    },
    async ({ sessionId }) => {
      logToolCall("nomba_requery_transaction", { sessionId });
      try {
        const result = await client.get(`/v1/transactions/requery/${sessionId}`);
        return jsonResponse(redactResponse(result, TRANSACTION_RULES));
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  server.registerTool(
    "nomba_get_transaction",
    {
      title: "Get Transaction Details",
      description:
        "Fetch a single transaction on the parent account by its Nomba transaction reference or your merchantTxRef. Pass exactly one.",
      annotations: { readOnlyHint: true, destructiveHint: false },
      inputSchema: {
        transactionId: z
          .string()
          .optional()
          .describe("Nomba transaction ID/reference (e.g. API-TRANSFER-...)"),
        merchantTxRef: z
          .string()
          .optional()
          .describe("The merchantTxRef you sent with the transaction"),
      },
    },
    async ({ transactionId, merchantTxRef }) => {
      logToolCall("nomba_get_transaction", { transactionId, merchantTxRef });
      try {
        if (!transactionId === !merchantTxRef) {
          throw new Error("Pass exactly one of transactionId or merchantTxRef");
        }
        const params = buildParams({ transactionRef: transactionId, merchantTxRef });
        const result = await client.get("/v1/transactions/accounts/single", params);
        return jsonResponse(redactResponse(result, TRANSACTION_RULES));
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  server.registerTool(
    "nomba_filter_transactions",
    {
      title: "Filter Transactions",
      description:
        "List or filter transactions on the parent account by status, type, source, terminal or reference, with date range and pagination. With no filters, lists all transactions.",
      annotations: { readOnlyHint: true, destructiveHint: false },
      inputSchema: {
        status: z
          .enum([
            "NEW",
            "PENDING_PAYMENT",
            "PAYMENT_SUCCESSFUL",
            "PAYMENT_FAILED",
            "PENDING_BILLING",
            "SUCCESS",
            "REFUND",
          ])
          .optional()
          .describe("Filter by transaction status"),
        type: z
          .enum([
            "withdrawal",
            "purchase",
            "transfer",
            "p2p",
            "online_checkout",
            "qrt_credit",
            "qrt_debit",
          ])
          .optional()
          .describe("Filter by transaction type"),
        source: z
          .enum(["api", "pos", "web", "android_app", "ios_app"])
          .optional()
          .describe("Filter by where the transaction originated"),
        terminalId: z.string().optional().describe("Filter by terminal ID"),
        transactionRef: z
          .string()
          .optional()
          .describe("Filter by Nomba transaction reference"),
        merchantTxRef: z.string().optional().describe("Filter by your merchantTxRef"),
        ...paging,
      },
    },
    async ({
      status,
      type,
      source,
      terminalId,
      transactionRef,
      merchantTxRef,
      limit,
      cursor,
      dateFrom,
      dateTo,
    }) => {
      logToolCall("nomba_filter_transactions", {
        status,
        type,
        source,
        limit,
        dateFrom,
        dateTo,
      });
      try {
        const filter = buildParams({
          status,
          type,
          source,
          terminalId,
          transactionRef,
          merchantTxRef,
        });
        const params = buildParams({ limit, cursor, dateFrom, dateTo });
        const result = await client.post("/v1/transactions/accounts", filter, params);
        return jsonResponse(redactResponse(result, TRANSACTION_RULES));
      } catch (error) {
        return errorResponse(error);
      }
    }
  );
}
