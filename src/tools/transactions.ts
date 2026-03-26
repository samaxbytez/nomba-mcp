import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { NombaClient } from "../client.js";
import { jsonResponse, errorResponse, logToolCall, buildParams } from "../utils.js";

export function registerTransactionTools(
  server: McpServer,
  client: NombaClient
): void {
  server.registerTool(
    "nomba_list_bank_transactions",
    {
      title: "List Bank Transactions",
      description:
        "Fetch bank transactions for the parent Nomba account. Supports filtering by date range and pagination. Returns transaction amounts, types (CREDIT/DEBIT), statuses, and metadata.",
      annotations: { readOnlyHint: true, destructiveHint: false },
      inputSchema: {
        limit: z
          .number()
          .int()
          .positive()
          .max(50)
          .optional()
          .describe("Number of results per page (max 50)"),
        cursor: z
          .string()
          .optional()
          .describe("Pagination cursor from a previous response"),
        dateFrom: z
          .string()
          .optional()
          .describe("Start date in UTC format (e.g., 2024-01-01T00:00:00Z)"),
        dateTo: z
          .string()
          .optional()
          .describe("End date in UTC format (e.g., 2024-12-31T23:59:59Z)"),
      },
    },
    async ({ limit, cursor, dateFrom, dateTo }) => {
      logToolCall("nomba_list_bank_transactions", { limit, dateFrom, dateTo });
      try {
        const params = buildParams({ limit, cursor, dateFrom, dateTo });
        const result = await client.get("/v1/transactions/bank", params);
        return jsonResponse(result);
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
        "Requery/check the status of a specific transaction using its session ID. Useful for verifying if a transfer or payment was successful.",
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
      inputSchema: {
        sessionId: z
          .string()
          .describe("The session ID of the transaction to requery"),
      },
    },
    async ({ sessionId }) => {
      logToolCall("nomba_requery_transaction", { sessionId });
      try {
        const result = await client.post(
          "/v1/transactions/accounts",
          { sessionId }
        );
        return jsonResponse(result);
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
        "Fetch details of a single transaction by its transaction ID.",
      annotations: { readOnlyHint: true, destructiveHint: false },
      inputSchema: {
        transactionId: z
          .string()
          .describe("The transaction ID to look up"),
      },
    },
    async ({ transactionId }) => {
      logToolCall("nomba_get_transaction", { transactionId });
      try {
        const result = await client.get(
          `/v1/transactions/${transactionId}`
        );
        return jsonResponse(result);
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
        "Filter transactions on the parent account with advanced filters. Supports filtering by type (CREDIT/DEBIT), date range, and pagination.",
      annotations: { readOnlyHint: true, destructiveHint: false },
      inputSchema: {
        type: z
          .enum(["CREDIT", "DEBIT"])
          .optional()
          .describe("Filter by transaction type: CREDIT or DEBIT"),
        limit: z
          .number()
          .int()
          .positive()
          .max(50)
          .optional()
          .describe("Number of results per page (max 50)"),
        cursor: z
          .string()
          .optional()
          .describe("Pagination cursor from a previous response"),
        dateFrom: z
          .string()
          .optional()
          .describe("Start date in UTC format (e.g., 2024-01-01T00:00:00Z)"),
        dateTo: z
          .string()
          .optional()
          .describe("End date in UTC format (e.g., 2024-12-31T23:59:59Z)"),
      },
    },
    async ({ type, limit, cursor, dateFrom, dateTo }) => {
      logToolCall("nomba_filter_transactions", { type, limit, dateFrom, dateTo });
      try {
        const params = buildParams({ type, limit, cursor, dateFrom, dateTo });
        const result = await client.get("/v1/transactions/filter", params);
        return jsonResponse(result);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );
}
