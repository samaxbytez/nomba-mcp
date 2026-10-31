// Starts the bundled build/index.js over MCP stdio, exactly as an MCP client
// does, and checks it works. Type-check and vitest run the TypeScript sources,
// so they can't see failures that only exist in the bundle. Run after `npm run build`.
import { readFileSync } from "node:fs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const SENSITIVE_COUNT = 20;
const SENSITIVE_SAMPLE = [
  "nomba_transfer_to_bank",
  "nomba_transfer_between_accounts",
  "nomba_buy_airtime",
  "nomba_refund_transaction",
  "nomba_charge_tokenized_card",
  "nomba_suspend_sub_account",
];
const failures = [];
const check = (ok, message) => ok || failures.push(message);

const runtimeDeps = Object.keys(pkg.dependencies ?? {});
check(
  runtimeDeps.length === 0,
  `package.json has runtime dependencies (${runtimeDeps.join(", ")}); they belong in the bundle`
);

async function listTools(env) {
  const client = new Client({ name: "smoke", version: "0" });
  await client.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: ["build/index.js"],
      // Dummy credentials: listing tools makes no API calls.
      env: {
        PATH: process.env.PATH ?? "",
        NOMBA_CLIENT_ID: "smoke",
        NOMBA_CLIENT_SECRET: "smoke",
        NOMBA_ACCOUNT_ID: "smoke",
        ...env,
      },
      stderr: "ignore",
    })
  );
  const info = client.getServerVersion();
  const { tools } = await client.listTools();
  await client.close();
  return { info, tools };
}

const { info, tools } = await listTools({});
check(info?.version === pkg.version, `server reports version ${info?.version}, package.json says ${pkg.version}`);
check(tools.length >= 20, `only ${tools.length} tools registered`);
check(tools.every((t) => t.annotations), "a tool is missing its annotations");
for (const name of SENSITIVE_SAMPLE) check(!tools.some((t) => t.name === name), `${name} is exposed by default`);

const opted = await listTools({ NOMBA_ENABLE_SENSITIVE_TOOLS: "true" });
check(
  opted.tools.length === tools.length + SENSITIVE_COUNT,
  `with sensitive tools on, expected ${tools.length + SENSITIVE_COUNT} tools, got ${opted.tools.length}`
);
for (const name of SENSITIVE_SAMPLE) {
  check(opted.tools.find((t) => t.name === name)?.annotations?.destructiveHint === true, `${name} is not marked destructive`);
}

if (failures.length) {
  console.error(`Smoke test failed:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.log(`Smoke test passed: ${info.name} ${info.version}, ${tools.length} tools (${opted.tools.length} with sensitive tools on)`);
