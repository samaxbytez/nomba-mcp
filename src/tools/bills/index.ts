import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { NombaClient } from "../../client.js";
import { registerElectricityTools } from "./electricity.js";
import { registerBettingTools } from "./betting.js";
import { registerCableTools } from "./cable.js";

export function registerBillTools(
  server: McpServer,
  client: NombaClient
): void {
  registerElectricityTools(server, client);
  registerBettingTools(server, client);
  registerCableTools(server, client);
}
