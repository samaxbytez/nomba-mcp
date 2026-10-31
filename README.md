# nomba-mcp

[![npm version](https://img.shields.io/npm/v/nomba-mcp.svg)](https://www.npmjs.com/package/nomba-mcp)
[![CI](https://github.com/samaxbytez/nomba-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/samaxbytez/nomba-mcp/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

An MCP server for the [Nomba API](https://developer.nomba.com). It lets an AI assistant check balances, read transactions, look up bank accounts and, if you allow it, pay people, buy airtime and bills, and manage sub-accounts and virtual accounts.

**Money tools are off by default.** Text from Nomba (narrations, account names) can be written by third parties, so the 20 tools that move money or change the account only exist when you set `NOMBA_ENABLE_SENSITIVE_TOOLS=true`. It starts in the sandbox. See [docs/security.md](docs/security.md).

## How it fits together

```
AI app  <--stdio-->  nomba-mcp (runs on your machine)  <--HTTPS-->  Nomba API
(Claude, Cursor, ...)  read-only tools always            sandbox.nomba.com
                       money tools only if enabled       or api.nomba.com
```

## Quick start

1. Get a client ID, client secret and account ID from the [Nomba developer dashboard](https://developer.nomba.com).
2. Add the server to your app (Node 24 or later):

   ```json
   {
     "mcpServers": {
       "nomba": {
         "command": "npx",
         "args": ["-y", "nomba-mcp"],
         "env": {
           "NOMBA_CLIENT_ID": "your_client_id",
           "NOMBA_CLIENT_SECRET": "your_client_secret",
           "NOMBA_ACCOUNT_ID": "your_account_id"
         }
       }
     }
   }
   ```

3. Restart the app and ask: "What's my Nomba account balance?"

Step by step, including Claude Code, Cursor, VS Code, Windsurf, Codex CLI and Gemini CLI: [docs/setup.md](docs/setup.md).

## What it can do

| Area | Always on | Needs `NOMBA_ENABLE_SENSITIVE_TOOLS` |
|------|-----------|--------------------------------------|
| Account | details, balance, terminals list | assign / unassign terminal |
| Sub-accounts | list, get, balance | create, update, suspend, reactivate |
| Transfers | bank list, account name lookup | transfer to bank, between Nomba accounts |
| Checkout | get transaction | create order, charge saved card, refund, cancel |
| Virtual accounts | get, list | create, update, expire |
| Transactions | list, filter, get, requery | none |
| Bills | provider lists, meter and smartcard lookup, data plans | electricity, cable, betting, airtime, data |

41 tools in total, 21 on by default. Full list: [docs/tools.md](docs/tools.md).

## Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `NOMBA_CLIENT_ID`, `NOMBA_CLIENT_SECRET`, `NOMBA_ACCOUNT_ID` | required | Your Nomba credentials |
| `NOMBA_ENABLE_SENSITIVE_TOOLS` | off | Register the money-moving tools |
| `NOMBA_BASE_URL` | `https://sandbox.nomba.com` | `https://api.nomba.com` for production |
| `NOMBA_PRODUCTION_CONFIRMED` | none | Must be `true` for production |
| `NOMBA_MAX_TRANSACTION` | `100000` | Largest single amount (NGN) |
| `NOMBA_SESSION_SPENDING_CAP` | `500000` | Total NGN per session |

All settings: [docs/configuration.md](docs/configuration.md).

## Development

```bash
npm ci --ignore-scripts
npm run lint && npm run type-check && npm test && npm run build && npm run smoke
```

Details: [docs/development.md](docs/development.md).

## Documentation

| Page | Read it to |
|------|-----------|
| [docs/setup.md](docs/setup.md) | Get credentials and connect |
| [docs/configuration.md](docs/configuration.md) | Look up every setting |
| [docs/tools.md](docs/tools.md) | See every tool |
| [docs/security.md](docs/security.md) | Understand the safeguards and their limits |
| [docs/troubleshooting.md](docs/troubleshooting.md) | Fix an error |
| [docs/development.md](docs/development.md) | Change the code |

## License

MIT
