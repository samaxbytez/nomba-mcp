#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { NombaClient } from "./client.js";
import { registerAccountTools } from "./tools/accounts.js";
import { registerTransferTools } from "./tools/transfers.js";
import { registerCheckoutTools } from "./tools/checkout.js";
import { registerVirtualAccountTools } from "./tools/virtual-accounts.js";
import { registerTransactionTools } from "./tools/transactions.js";
import { registerBillTools } from "./tools/bills/index.js";
import { registerAirtimeTools } from "./tools/airtime.js";
import { registerSubAccountTools } from "./tools/sub-accounts.js";
import { registerBankListResource } from "./resources/bank-list.js";

const NOMBA_CLIENT_ID = process.env.NOMBA_CLIENT_ID;
const NOMBA_CLIENT_SECRET = process.env.NOMBA_CLIENT_SECRET;
const NOMBA_ACCOUNT_ID = process.env.NOMBA_ACCOUNT_ID;
const NOMBA_BASE_URL =
  process.env.NOMBA_BASE_URL || "https://sandbox.nomba.com";

if (!NOMBA_CLIENT_ID || !NOMBA_CLIENT_SECRET || !NOMBA_ACCOUNT_ID) {
  console.error(
    "Missing required environment variables: NOMBA_CLIENT_ID, NOMBA_CLIENT_SECRET, NOMBA_ACCOUNT_ID"
  );
  process.exit(1);
}

if (NOMBA_BASE_URL.includes("api.nomba.com")) {
  console.error("WARNING: Running against PRODUCTION Nomba API");
}

const nombaClient = new NombaClient({
  baseUrl: NOMBA_BASE_URL,
  clientId: NOMBA_CLIENT_ID,
  clientSecret: NOMBA_CLIENT_SECRET,
  accountId: NOMBA_ACCOUNT_ID,
});

const server = new McpServer({
  name: "nomba-mcp",
  version: "1.0.0",
});

registerAccountTools(server, nombaClient);
registerTransferTools(server, nombaClient);
registerCheckoutTools(server, nombaClient);
registerVirtualAccountTools(server, nombaClient);
registerTransactionTools(server, nombaClient);
registerBillTools(server, nombaClient);
registerAirtimeTools(server, nombaClient);
registerSubAccountTools(server, nombaClient);
registerBankListResource(server, nombaClient);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Nomba MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
