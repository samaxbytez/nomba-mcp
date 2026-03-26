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

export function registerSubAccountTools(
  server: McpServer,
  client: NombaClient
): void {
  server.registerTool(
    "nomba_create_sub_account",
    {
      title: "Create Sub-Account",
      description:
        "Create a new sub-account under the parent Nomba account. Sub-accounts can have their own balances and make transactions.",
      annotations: { readOnlyHint: false, destructiveHint: true },
      inputSchema: {
        accountName: z
          .string()
          .describe("Name for the sub-account"),
        email: z
          .string()
          .email()
          .optional()
          .describe("Email address for the sub-account holder"),
        phoneNumber: z
          .string()
          .optional()
          .describe("Phone number for the sub-account holder"),
      },
    },
    async ({ accountName, email, phoneNumber }) => {
      logToolCall("nomba_create_sub_account", { accountName });
      try {
        const body: Record<string, unknown> = { accountName };
        if (email) body.email = email;
        if (phoneNumber) body.phoneNumber = phoneNumber;
        const result = await client.post("/v1/accounts", body);
        return jsonResponse(result);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  server.registerTool(
    "nomba_list_sub_accounts",
    {
      title: "List Sub-Accounts",
      description:
        "List all sub-accounts under the parent Nomba account. Supports pagination.",
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
      },
    },
    async ({ limit, cursor }) => {
      logToolCall("nomba_list_sub_accounts", { limit, cursor });
      try {
        const params = buildParams({ limit, cursor });
        const result = await client.get("/v1/accounts", params);
        return jsonResponse(result);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  server.registerTool(
    "nomba_get_sub_account",
    {
      title: "Get Sub-Account",
      description:
        "Fetch details of a specific sub-account by its account ID.",
      annotations: { readOnlyHint: true, destructiveHint: false },
      inputSchema: {
        accountId: safeId.describe("The sub-account ID"),
      },
    },
    async ({ accountId }) => {
      logToolCall("nomba_get_sub_account", { accountId });
      try {
        const result = await client.get(`/v1/accounts/${accountId}`);
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
        const result = await client.get(
          `/v1/accounts/${accountId}/balance`
        );
        return jsonResponse(result);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  server.registerTool(
    "nomba_update_sub_account",
    {
      title: "Update Sub-Account",
      description:
        "Update the details of an existing sub-account.",
      annotations: { readOnlyHint: false, destructiveHint: true },
      inputSchema: {
        accountId: safeId.describe("The sub-account ID to update"),
        accountName: z
          .string()
          .optional()
          .describe("New account name"),
        email: z
          .string()
          .email()
          .optional()
          .describe("New email address"),
        phoneNumber: z
          .string()
          .optional()
          .describe("New phone number"),
      },
    },
    async ({ accountId, accountName, email, phoneNumber }) => {
      logToolCall("nomba_update_sub_account", { accountId });
      try {
        const body: Record<string, unknown> = {};
        if (accountName) body.accountName = accountName;
        if (email) body.email = email;
        if (phoneNumber) body.phoneNumber = phoneNumber;
        const result = await client.put(
          `/v1/accounts/${accountId}`,
          body
        );
        return jsonResponse(result);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  server.registerTool(
    "nomba_suspend_sub_account",
    {
      title: "Suspend Sub-Account",
      description:
        "Suspend a sub-account. Suspended accounts cannot make or receive transactions.",
      annotations: { readOnlyHint: false, destructiveHint: true },
      inputSchema: {
        accountId: safeId.describe("The sub-account ID to suspend"),
      },
    },
    async ({ accountId }) => {
      logToolCall("nomba_suspend_sub_account", { accountId });
      try {
        const result = await client.put(
          `/v1/accounts/${accountId}/suspend`,
          {}
        );
        return jsonResponse(result);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  server.registerTool(
    "nomba_reactivate_sub_account",
    {
      title: "Reactivate Sub-Account",
      description:
        "Reactivate a previously suspended sub-account.",
      annotations: { readOnlyHint: false, destructiveHint: true },
      inputSchema: {
        accountId: safeId.describe("The sub-account ID to reactivate"),
      },
    },
    async ({ accountId }) => {
      logToolCall("nomba_reactivate_sub_account", { accountId });
      try {
        const result = await client.put(
          `/v1/accounts/${accountId}/reactivate`,
          {}
        );
        return jsonResponse(result);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );
}
