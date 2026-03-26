import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { NombaClient } from "../../client.js";
import { SpendingGuard } from "../../spending-guard.js";
import { registerElectricityTools } from "./electricity.js";
import { registerBettingTools } from "./betting.js";
import { registerCableTools } from "./cable.js";

export function registerBillTools(
  server: McpServer,
  client: NombaClient,
  guard: SpendingGuard
): void {
  registerElectricityTools(server, client, guard);
  registerBettingTools(server, client, guard);
  registerCableTools(server, client, guard);
}
