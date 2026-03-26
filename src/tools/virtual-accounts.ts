import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { NombaClient } from "../client.js";
import { jsonResponse, errorResponse, logToolCall, buildParams, safeId } from "../utils.js";
import { redactResponse, VIRTUAL_ACCOUNT_RULES } from "../redact.js";

export function registerVirtualAccountTools(
  server: McpServer,
  client: NombaClient
): void {
  server.registerTool(
    "nomba_create_virtual_account",
    {
      title: "Create Virtual Account",
      description:
        "Create a new virtual bank account under the parent Nomba account. Virtual accounts can receive bank transfers and are useful for collecting payments from specific customers.",
      annotations: { readOnlyHint: false, destructiveHint: true },
      inputSchema: {
        accountName: z
          .string()
          .min(8)
          .max(64)
          .describe("Name for the virtual account holder (8-64 characters)"),
        accountRef: z
          .string()
          .min(16)
          .max(64)
          .optional()
          .describe(
            "Your unique reference for this account (16-64 characters)"
          ),
      },
    },
    async ({ accountName, accountRef }) => {
      logToolCall("nomba_create_virtual_account", { accountName });
      try {
        const body: Record<string, unknown> = { accountName };
        if (accountRef) body.accountRef = accountRef;
        const result = await client.post("/v1/accounts/virtual", body);
        return jsonResponse(redactResponse(result, VIRTUAL_ACCOUNT_RULES));
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  server.registerTool(
    "nomba_get_virtual_account",
    {
      title: "Get Virtual Account",
      description:
        "Fetch details of a specific virtual account by its account ID. Returns account name, bank details, status, and balance.",
      annotations: { readOnlyHint: true, destructiveHint: false },
      inputSchema: {
        accountId: safeId.describe("The virtual account ID (UUID)"),
      },
    },
    async ({ accountId }) => {
      logToolCall("nomba_get_virtual_account", { accountId });
      try {
        const result = await client.get(
          `/v1/accounts/virtual/${accountId}`
        );
        return jsonResponse(redactResponse(result, VIRTUAL_ACCOUNT_RULES));
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  server.registerTool(
    "nomba_update_virtual_account",
    {
      title: "Update Virtual Account",
      description:
        "Update the details of an existing virtual account, such as the account name or callback URL.",
      annotations: { readOnlyHint: false, destructiveHint: true },
      inputSchema: {
        accountId: safeId.describe("The virtual account ID (UUID) to update"),
        accountName: z
          .string()
          .min(8)
          .max(64)
          .optional()
          .describe("New account name (8-64 characters)"),
        callbackUrl: z
          .string()
          .url()
          .startsWith("https://", "Callback URL must use HTTPS")
          .optional()
          .describe("HTTPS webhook URL for payment notifications on this account"),
      },
    },
    async ({ accountId, accountName, callbackUrl }) => {
      logToolCall("nomba_update_virtual_account", { accountId });
      try {
        const body: Record<string, unknown> = {};
        if (accountName) body.accountName = accountName;
        if (callbackUrl) body.callbackUrl = callbackUrl;
        const result = await client.patch(
          `/v1/accounts/virtual/${accountId}`,
          body
        );
        return jsonResponse(redactResponse(result, VIRTUAL_ACCOUNT_RULES));
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  server.registerTool(
    "nomba_expire_virtual_account",
    {
      title: "Expire Virtual Account",
      description:
        "Expire/deactivate a virtual account so it can no longer receive payments. This action cannot be undone.",
      annotations: { readOnlyHint: false, destructiveHint: true },
      inputSchema: {
        accountId: safeId.describe("The virtual account ID (UUID) to expire"),
      },
    },
    async ({ accountId }) => {
      logToolCall("nomba_expire_virtual_account", { accountId });
      try {
        const result = await client.post(
          `/v1/accounts/virtual/${accountId}/expire`,
          {}
        );
        return jsonResponse(redactResponse(result, VIRTUAL_ACCOUNT_RULES));
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  server.registerTool(
    "nomba_list_virtual_accounts",
    {
      title: "List Virtual Accounts",
      description:
        "List all virtual accounts under the parent Nomba account. Supports pagination with limit and cursor.",
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
      logToolCall("nomba_list_virtual_accounts", { limit, cursor });
      try {
        const params = buildParams({ limit, cursor });
        const result = await client.get("/v1/accounts/virtual", params);
        return jsonResponse(redactResponse(result, VIRTUAL_ACCOUNT_RULES));
      } catch (error) {
        return errorResponse(error);
      }
    }
  );
}
