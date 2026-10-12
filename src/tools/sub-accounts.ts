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

// Nomba's public API only reads sub-accounts. They're created and managed from the
// dashboard (developer.nomba.com/nomba-api-reference/transfers), so there are no
// create/update/suspend tools here.
export function registerSubAccountTools(server: McpServer, client: NombaClient): void {
  server.registerTool(
    "nomba_get_sub_account",
    {
      title: "Get Sub-Account",
      description:
        "Fetch details of a sub-account by the accountRef it was created with.",
      annotations: { readOnlyHint: true, destructiveHint: false },
      inputSchema: {
        accountRef: z.string().min(1).describe("The sub-account's accountRef"),
      },
    },
    async ({ accountRef }) => {
      logToolCall("nomba_get_sub_account", { accountRef });
      try {
        const result = await client.get("/v1/accounts/sub-account-details", {
          accountRef,
        });
        return jsonResponse(result);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  server.registerTool(
    "nomba_get_sub_account_balance",
    {
      title: "Get Sub-Account Balance",
      description:
        "Fetch the current balance of a specific sub-account. Returns available balance in NGN.",
      annotations: { readOnlyHint: true, destructiveHint: false },
      inputSchema: {
        accountId: safeId.describe("The sub-account ID"),
      },
    },
    async ({ accountId }) => {
      logToolCall("nomba_get_sub_account_balance", { accountId });
      try {
        const result = await client.get(`/v1/accounts/${accountId}/balance`);
        return jsonResponse(result);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  server.registerTool(
    "nomba_list_sub_account_terminals",
    {
      title: "List Sub-Account Terminals",
      description: "List POS terminals assigned to a sub-account. Supports pagination.",
      annotations: { readOnlyHint: true, destructiveHint: false },
      inputSchema: {
        accountId: safeId.describe("The sub-account ID"),
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
      },
    },
    async ({ accountId, limit, cursor }) => {
      logToolCall("nomba_list_sub_account_terminals", { accountId });
      try {
        const result = await client.get(
          `/v1/accounts/${accountId}/terminals`,
          buildParams({ limit, cursor })
        );
        return jsonResponse(result);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );
}
