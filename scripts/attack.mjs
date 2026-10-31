// Live attack test: runs build/index.js over MCP stdio against a fake local API
// plus an "evil" listener, firing hostile values at every string argument.
// Usage: npm run build && node scripts/attack.mjs
import http from "node:http";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const SECRET = "SECRET-CLIENT-SECRET-123";
const TOKEN = "TOKEN-ACCESS-456";
const HOSTILE = [
  "../x", "..%2fx", "%2e%2e/x", "1?inj=1", "1#x", "a/b", "a\\b", "https://evil.test/x",
  "//evil.test/x", "http://127.0.0.1:1/x", "＠evil", "a\r\nX-Injected: 1", "a\0b",
  "A".repeat(5000), "__proto__", "constructor", "1&inj=1",
];

const listen = (handler) =>
  new Promise((res) => {
    const s = http.createServer(handler);
    s.listen(0, "127.0.0.1", () => res(s));
  });

async function run({ sensitive, redirect }) {
  const evilHits = [];
  const apiHits = [];
  const evil = await listen((req, r) => {
    evilHits.push({ url: req.url, headers: req.headers });
    r.end("{}");
  });
  const evilOrigin = `http://127.0.0.1:${evil.address().port}`;
  const api = await listen((req, r) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      if (req.url.startsWith("/v1/auth/token/")) {
        r.setHeader("content-type", "application/json");
        return r.end(JSON.stringify({ code: "00", description: "ok", data: { access_token: TOKEN, refresh_token: "R", expiresAt: new Date(Date.now() + 3.6e6).toISOString() } }));
      }
      apiHits.push({ method: req.method, url: req.url, headers: req.headers, body });
      if (redirect) {
        r.statusCode = 302;
        r.setHeader("location", `${evilOrigin}/stolen`);
        return r.end();
      }
      r.setHeader("content-type", "application/json");
      r.end(JSON.stringify({ code: "00", description: "ok", data: {} }));
    });
  });
  const base = `http://127.0.0.1:${api.address().port}`;

  const transport = new StdioClientTransport({
    command: "node",
    args: ["build/index.js"],
    stderr: "ignore",
    env: {
      PATH: process.env.PATH,
      NOMBA_CLIENT_ID: "cid",
      NOMBA_CLIENT_SECRET: SECRET,
      NOMBA_ACCOUNT_ID: "acct",
      NOMBA_BASE_URL: base,
      NOMBA_ALLOW_INSECURE: "true",
      NOMBA_MAX_TRANSACTION: "1000000000",
      NOMBA_SESSION_SPENDING_CAP: "1000000000",
      ...(sensitive ? { NOMBA_ENABLE_SENSITIVE_TOOLS: "true" } : {}),
    },
  });
  const client = new Client({ name: "attack", version: "0" });
  await client.connect(transport);
  const { tools } = await client.listTools();

  const fill = (schema, hostileKey, hostile) => {
    const args = {};
    for (const [k, p] of Object.entries(schema.properties ?? {})) {
      if (k === hostileKey) args[k] = hostile;
      else if (p.enum) args[k] = p.enum[0];
      else if (p.type === "number" || p.type === "integer") args[k] = Math.max(p.minimum ?? 1, 100);
      else if (p.type === "boolean") args[k] = false;
      else if (p.type === "string") args[k] = "1".repeat(p.minLength ?? p.maxLength ?? 10);
      else if (p.type === "array") args[k] = [];
      else if (p.type === "object") args[k] = {};
    }
    // extra prototype-pollution style keys
    return args;
  };

  let calls = 0;
  for (const tool of tools) {
    const schema = tool.inputSchema ?? {};
    const keys = Object.entries(schema.properties ?? {}).filter(([, p]) => p.type === "string").map(([k]) => k);
    const targets = keys.length ? keys : [null];
    for (const key of targets) {
      for (const h of key ? HOSTILE : [null]) {
        calls++;
        try {
          const res = await client.callTool({ name: tool.name, arguments: fill(schema, key, h) });
          if (process.env.DBG && calls < 8) console.error(tool.name, JSON.stringify(res).slice(0, 250));
        } catch (e) {
          if (process.env.DBG && calls < 8) console.error(tool.name, "THROW", String(e.message).slice(0, 200));
        }
      }
    }
  }
  await client.close();

  // Raw JSON-RPC: prototype-pollution style extra keys (the SDK client refuses to send these).
  const { spawn } = await import("node:child_process");
  const child = spawn("node", ["build/index.js"], { env: transport._serverParams.env, stdio: ["pipe", "pipe", "ignore"] });
  const seen = new Set();
  let buf = "";
  child.stdout.on("data", (d) => {
    buf += d;
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      try { seen.add(JSON.parse(buf.slice(0, i)).id); } catch {}
      buf = buf.slice(i + 1);
    }
  });
  const send = (o) => child.stdin.write(JSON.stringify(o).replace(/\}$/, "") + "\n");
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "raw", version: "0" } } }) + "\n");
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");
  let id = 100;
  for (const tool of tools) {
    calls++;
    const args = JSON.stringify(fill(tool.inputSchema ?? {}, null, null)).slice(0, -1);
    const extra = '"__proto__":{"polluted":1},"constructor":{"prototype":{"polluted":1}}';
    child.stdin.write(`{"jsonrpc":"2.0","id":${id++},"method":"tools/call","params":{"name":"${tool.name}","arguments":${args}${args.length > 1 ? "," : ""}${extra}}}\n`);
  }
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: 9999, method: "tools/list" }) + "\n");
  for (let t = 0; t < 100 && !seen.has(9999); t++) await new Promise((r) => setTimeout(r, 50));
  const alive = seen.has(9999);
  child.kill();

  const problems = [];
  if (!alive) problems.push("server stopped answering after prototype-pollution keys");
  const allowed = new Set(["host", "connection", "accept", "accept-language", "sec-fetch-mode", "user-agent", "accept-encoding", "content-type", "content-length", "authorization", "accountid"]);
  for (const h of apiHits) {
    const u = new URL(h.url, base);
    if (!u.pathname.startsWith("/v1/")) problems.push(`path escape: ${h.url}`);
    if (/\.\./.test(u.pathname) || /%2e/i.test(u.pathname)) problems.push(`traversal in: ${h.url}`);
    if (u.searchParams.has("inj")) problems.push(`injected query: ${h.url}`);
    for (const n of Object.keys(h.headers)) if (!allowed.has(n)) problems.push(`unexpected header ${n} on ${h.url}`);
    if (h.headers["x-injected"]) problems.push("header injection");
    if (h.body.includes(SECRET)) problems.push("secret in request body of non-auth call");
  }
  for (const h of evilHits) problems.push(`evil host reached: ${h.url} headers=${Object.keys(h.headers).join(",")}`);
  if (!sensitive) {
    const moves = apiHits.filter((h) => /transfers\/to-banks|transfers\/between|bills\/.*\/pay|bills\/(airtime|data)\/pay|checkout\/(order|refund|cancel)|charge|\/suspend|\/reactivate|\/expire|terminals\/(un)?assign/.test(h.url) && h.method !== "GET");
    for (const m of moves) problems.push(`money/account-changing request with sensitive tools off: ${m.method} ${m.url}`);
  }
  evil.close(); api.close();
  return { sensitive, redirect, tools: tools.length, calls, apiRequests: apiHits.length, problems: [...new Set(problems)] };
}

let failed = false;
for (const mode of [{ sensitive: false, redirect: false }, { sensitive: true, redirect: false }, { sensitive: true, redirect: true }]) {
  const r = await run(mode);
  console.log(JSON.stringify({ ...r, problems: r.problems.slice(0, 10), problemCount: r.problems.length }));
  if (r.problems.length) failed = true;
}
process.exit(failed ? 1 : 0);
