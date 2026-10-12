import { randomUUID } from "node:crypto";
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
import { redactResponse, VIRTUAL_ACCOUNT_RULES } from "../redact.js";

const identifier = safeId.describe(
  "The virtual account's accountRef or its bank account number"
);

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
            "Your unique reference for this account (16-64 characters). Generated if omitted."
          ),
        expectedAmount: z
          .number()
          .positive()
          .optional()
          .describe("Only accept inflows of exactly this amount in Naira"),
      },
    },
    async ({ accountName, accountRef, expectedAmount }) => {
      logToolCall("nomba_create_virtual_account", { accountName });
      try {
        const body: Record<string, unknown> = {
          accountName,
          accountRef: accountRef ?? randomUUID().replaceAll("-", ""),
          currency: "NGN",
        };
        if (expectedAmount !== undefined) body.expectedAmount = expectedAmount;
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
        "Fetch details of a specific virtual account by its accountRef or bank account number. Returns account name, bank details, and status.",
      annotations: { readOnlyHint: true, destructiveHint: false },
      inputSchema: { identifier },
    },
    async ({ identifier }) => {
      logToolCall("nomba_get_virtual_account", { identifier });
      try {
        const result = await client.get(`/v1/accounts/virtual/${identifier}`);
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
        "Update an existing virtual account's name, reference, or expected amount.",
      annotations: { readOnlyHint: false, destructiveHint: true },
      inputSchema: {
        identifier,
        accountName: z
          .string()
          .min(8)
          .max(64)
          .optional()
          .describe("New account name (8-64 characters)"),
        newAccountRef: z
          .string()
          .min(16)
          .max(64)
          .optional()
          .describe("New accountRef (16-64 characters)"),
        expectedAmount: z
          .number()
          .positive()
          .optional()
          .describe("Only accept inflows of exactly this amount in Naira"),
      },
    },
    async ({ identifier, accountName, newAccountRef, expectedAmount }) => {
      logToolCall("nomba_update_virtual_account", { identifier });
      try {
        const body: Record<string, unknown> = {};
        if (accountName) body.accountName = accountName;
        if (newAccountRef) body.newAccountRef = newAccountRef;
        // The update endpoint types expectedAmount as a string
        if (expectedAmount !== undefined) body.expectedAmount = String(expectedAmount);
        const result = await client.put(`/v1/accounts/virtual/${identifier}`, body);
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
      inputSchema: { identifier },
    },
    async ({ identifier }) => {
      logToolCall("nomba_expire_virtual_account", { identifier });
      try {
        const result = await client.delete(`/v1/accounts/virtual/${identifier}`);
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
        "List or filter virtual accounts under the parent Nomba account. Supports pagination with limit and cursor.",
      annotations: { readOnlyHint: true, destructiveHint: false },
      inputSchema: {
        accountName: z.string().optional().describe("Filter by account name"),
        accountRef: z.string().optional().describe("Filter by accountRef"),
        expired: z.boolean().optional().describe("Filter by expired status"),
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
    async ({ accountName, accountRef, expired, limit, cursor }) => {
      logToolCall("nomba_list_virtual_accounts", { limit, cursor });
      try {
        const filter: Record<string, unknown> = {};
        if (accountName) filter.accountName = accountName;
        if (accountRef) filter.accountRef = accountRef;
        if (expired !== undefined) filter.expired = expired;
        const result = await client.post(
          "/v1/accounts/virtual/list",
          filter,
          buildParams({ limit, cursor })
        );
        return jsonResponse(redactResponse(result, VIRTUAL_ACCOUNT_RULES));
      } catch (error) {
        return errorResponse(error);
      }
    }
  );
}
