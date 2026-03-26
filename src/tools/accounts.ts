import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { NombaClient } from "../client.js";
import { jsonResponse, errorResponse, logToolCall, safeId } from "../utils.js";
import { redactResponse, PARENT_ACCOUNT_RULES } from "../redact.js";

export function registerAccountTools(
  server: McpServer,
  client: NombaClient
): void {
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
        const result = await client.get("/v1/accounts/parent/balance");
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
        "List all POS terminals assigned to the parent Nomba account. Returns terminal IDs, serial numbers, and labels.",
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async () => {
      logToolCall("nomba_list_terminals");
      try {
        const result = await client.get("/v1/accounts/terminals");
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
        "Assign a POS terminal to the parent Nomba account.",
      annotations: { readOnlyHint: false, destructiveHint: true },
      inputSchema: {
        terminalId: safeId.describe("The terminal ID to assign"),
        serialNumber: safeId.describe("The terminal serial number"),
      },
    },
    async ({ terminalId, serialNumber }) => {
      logToolCall("nomba_assign_terminal", { terminalId, serialNumber });
      try {
        const result = await client.post("/v1/terminals/assign", {
          terminalId,
          serialNumber,
        });
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
        "Unassign a POS terminal from the parent Nomba account.",
      annotations: { readOnlyHint: false, destructiveHint: true },
      inputSchema: {
        terminalId: safeId.describe("The terminal ID to unassign"),
      },
    },
    async ({ terminalId }) => {
      logToolCall("nomba_unassign_terminal", { terminalId });
      try {
        const result = await client.post("/v1/terminals/unassign", {
          terminalId,
        });
        return jsonResponse(result);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );
}
