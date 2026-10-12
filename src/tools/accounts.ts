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
import { redactResponse, PARENT_ACCOUNT_RULES } from "../redact.js";

export function registerAccountTools(server: McpServer, client: NombaClient): void {
  server.registerTool(
    "nomba_get_parent_account",
    {
      title: "Get Parent Account",
      description:
        "Fetch the parent account details for the authenticated Nomba business. Returns account ID, name, type, status, BVN, and linked bank accounts.",
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async () => {
      logToolCall("nomba_get_parent_account");
      try {
        const result = await client.get("/v1/accounts/parent");
        return jsonResponse(redactResponse(result, PARENT_ACCOUNT_RULES));
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  server.registerTool(
    "nomba_get_parent_balance",
    {
      title: "Get Parent Account Balance",
      description:
        "Fetch the current balance of the parent Nomba business account. Returns available balance in NGN.",
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async () => {
      logToolCall("nomba_get_parent_balance");
      try {
        const result = await client.get("/v1/accounts/balance");
        return jsonResponse(result);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  server.registerTool(
    "nomba_list_terminals",
    {
      title: "List Terminals",
      description:
        "List POS terminals assigned to the parent Nomba account. Returns terminal IDs, serial numbers, and labels. Supports pagination.",
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
      logToolCall("nomba_list_terminals", { limit });
      try {
        const result = await client.get(
          "/v1/accounts/terminals",
          buildParams({ limit, cursor })
        );
        return jsonResponse(result);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  server.registerTool(
    "nomba_assign_terminal",
    {
      title: "Assign Terminal",
      description:
        "Assign a POS terminal to the parent Nomba account using its serial number.",
      annotations: { readOnlyHint: false, destructiveHint: true },
      inputSchema: {
        serialNumber: safeId.describe("The terminal serial number"),
        terminalLabel: z
          .string()
          .max(64)
          .optional()
          .describe("Optional label to show for the terminal"),
      },
    },
    async ({ serialNumber, terminalLabel }) => {
      logToolCall("nomba_assign_terminal", { serialNumber });
      try {
        const body: Record<string, unknown> = { serialNumber };
        if (terminalLabel) body.terminalLabel = terminalLabel;
        const result = await client.post("/v1/terminals/assign", body);
        return jsonResponse(result);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  server.registerTool(
    "nomba_unassign_terminal",
    {
      title: "Unassign Terminal",
      description:
        "Unassign a POS terminal from the parent Nomba account using its serial number.",
      annotations: { readOnlyHint: false, destructiveHint: true },
      inputSchema: {
        serialNumber: safeId.describe("The terminal serial number"),
      },
    },
    async ({ serialNumber }) => {
      logToolCall("nomba_unassign_terminal", { serialNumber });
      try {
        const result = await client.post("/v1/terminals/unassign", {
          serialNumber,
        });
        return jsonResponse(result);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );
}
