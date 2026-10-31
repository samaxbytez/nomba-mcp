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
import { SpendingGuard } from "./spending-guard.js";
import { classifyBaseUrl, parseCount, parsePositive } from "./config.js";
import { withToolPolicy } from "./policy.js";
import { VERSION } from "./version.js";

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

let environment: ReturnType<typeof classifyBaseUrl>;
let spendingGuard: SpendingGuard;
try {
  environment = classifyBaseUrl(NOMBA_BASE_URL, process.env.NOMBA_ALLOW_INSECURE === "true");
  spendingGuard = new SpendingGuard({
    maxTransaction: parsePositive("NOMBA_MAX_TRANSACTION", process.env.NOMBA_MAX_TRANSACTION, 100_000),
    sessionSpendingCap: parsePositive("NOMBA_SESSION_SPENDING_CAP", process.env.NOMBA_SESSION_SPENDING_CAP, 500_000),
    duplicateWindowMs: 60_000,
    maxUnpricedPerSession: parseCount("NOMBA_MAX_UNPRICED_PURCHASES", process.env.NOMBA_MAX_UNPRICED_PURCHASES, 10),
  });
} catch (error) {
  console.error(`ERROR: ${(error as Error).message}`);
  process.exit(1);
}

if (environment === "production") {
  if (process.env.NOMBA_PRODUCTION_CONFIRMED !== "true") {
    console.error(
      "ERROR: Base URL points to production (api.nomba.com). Set NOMBA_PRODUCTION_CONFIRMED=true to confirm."
    );
    process.exit(1);
  }
  console.error("NOTICE: Running against PRODUCTION Nomba API");
}

const nombaClient = new NombaClient({
  baseUrl: NOMBA_BASE_URL,
  clientId: NOMBA_CLIENT_ID,
  clientSecret: NOMBA_CLIENT_SECRET,
  accountId: NOMBA_ACCOUNT_ID,
});

const allowSensitive = process.env.NOMBA_ENABLE_SENSITIVE_TOOLS === "true";
const server = withToolPolicy(
  new McpServer({ name: "nomba-mcp", version: VERSION }),
  { allowSensitive }
);
if (!allowSensitive) {
  console.error(
    "Money-moving and account-changing tools are disabled. Set NOMBA_ENABLE_SENSITIVE_TOOLS=true to enable them."
  );
}

registerAccountTools(server, nombaClient);
registerTransferTools(server, nombaClient, spendingGuard);
registerCheckoutTools(server, nombaClient, spendingGuard);
registerVirtualAccountTools(server, nombaClient);
registerTransactionTools(server, nombaClient);
registerBillTools(server, nombaClient, spendingGuard);
registerAirtimeTools(server, nombaClient, spendingGuard);
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
