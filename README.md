# nomba-mcp

[![npm version](https://img.shields.io/npm/v/nomba-mcp.svg)](https://www.npmjs.com/package/nomba-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

An MCP (Model Context Protocol) server for the [Nomba API](https://developer.nomba.com). Connect any MCP-compatible AI assistant to your Nomba business account to check balances, send money, generate payment links, manage virtual accounts, buy airtime, pay utility bills, and more.

Works with any MCP client including Claude Desktop, Claude Code, Cursor, Windsurf, Cline, and other MCP-compatible tools.

Built on Nomba's API with OAuth2 authentication, this server provides 39 tools covering accounts, sub-accounts, terminals, transfers, online checkout, virtual accounts, transactions, bills (electricity, cable TV, betting), and airtime/data. Every tool's endpoint is pinned to the [official API reference](https://developer.nomba.com/nomba-api-reference/introduction) by a contract test (`src/tools/endpoints.test.ts`).

> **Note:** The server defaults to the **sandbox** environment. All transactions in sandbox mode use test data and do not move real money. Set `NOMBA_BASE_URL=https://api.nomba.com` only when you are ready to go live.

## Features

- **Accounts & Terminals** - View parent account details, check balance, list/assign/unassign POS terminals
- **Sub-Accounts** - Look up sub-account details, balances and terminals (sub-accounts are created in the Nomba dashboard)
- **Transfers** - Bank list lookup, account validation, bank transfers, internal transfers between Nomba accounts
- **Online Checkout** - Payment links, tokenized card charges, refunds, transaction status, cancellation
- **Virtual Accounts** - Create, update, expire, and list virtual bank accounts for receiving payments
- **Transactions** - Transaction history, filtering by status/type/source/date, single transaction lookup, status requery
- **Bills - Electricity** - List providers, validate meter numbers, purchase tokens (prepaid/postpaid)
- **Bills - Cable TV** - List providers and plans, validate smartcards, pay subscriptions (DSTV, GOtv, Startimes, Showmax)
- **Bills - Betting** - List providers, validate customers, fund betting accounts
- **Airtime & Data** - Buy airtime, list data plans, purchase data bundles (MTN, Airtel, Glo, 9mobile)

## Security

The server includes built-in security safeguards for financial operations:

- **Spending limits** - Configurable per-transaction maximum and session spending cap
- **Duplicate detection** - Blocks identical transactions (same amount + recipient) within 60 seconds
- **PII redaction** - BVN, bank account numbers, and card tokens are masked before being returned to the AI
- **Log redaction** - Sensitive fields (account numbers, phone numbers, emails) are masked in log output
- **HTTPS enforcement** - Refuses to start with non-HTTPS base URLs unless explicitly overridden
- **Production safeguard** - Requires explicit opt-in to use the production API
- **Tool annotations** - All tools are annotated with `destructiveHint`/`readOnlyHint` so MCP clients can enforce confirmation dialogs on financial operations
- **Path traversal protection** - Strict validation on all ID fields used in API paths

## Prerequisites

You need **Nomba API credentials** from the [Nomba Developer Dashboard](https://developer.nomba.com):

1. **Client ID** - your API client ID
2. **Client Secret** - your API client secret
3. **Account ID** - your parent account ID (UUID format)

Authentication is handled automatically. The server obtains an OAuth2 access token on the first request and refreshes it transparently using the refresh token endpoint.

## Installation

### Using npx (recommended)

```bash
npx nomba-mcp
```

Also available as `@nomba-inc/mcp-server`:

```bash
npx @nomba-inc/mcp-server
```

### Global install

```bash
npm install -g nomba-mcp
```

### Build from source

```bash
git clone https://github.com/samaxbytez/nomba-mcp.git
cd nomba-mcp
npm install
npm run build
node build/index.js
```

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NOMBA_CLIENT_ID` | Yes | -- | Your client ID from the Nomba developer dashboard |
| `NOMBA_CLIENT_SECRET` | Yes | -- | Your client secret from the Nomba developer dashboard |
| `NOMBA_ACCOUNT_ID` | Yes | -- | Your parent account ID (UUID format) |
| `NOMBA_BASE_URL` | No | `https://sandbox.nomba.com` | API base URL. Set to `https://api.nomba.com` for production |
| `NOMBA_MAX_TRANSACTION` | No | `100000` | Maximum amount (NGN) allowed per transaction |
| `NOMBA_SESSION_SPENDING_CAP` | No | `500000` | Maximum cumulative spending (NGN) per session |
| `NOMBA_PRODUCTION_CONFIRMED` | No | -- | Must be `true` when using `api.nomba.com` |
| `NOMBA_ALLOW_INSECURE` | No | -- | Set to `true` to allow non-HTTPS URLs (local dev only) |

### Claude Desktop

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

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

### Claude Code

Add to your project's `.mcp.json`:

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

### Cursor / Windsurf

Add to your MCP settings (Settings > MCP Servers):

```json
{
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
```

### Any MCP Client

Set the environment variables and run:

```bash
NOMBA_CLIENT_ID=your_id NOMBA_CLIENT_SECRET=your_secret NOMBA_ACCOUNT_ID=your_account npx nomba-mcp
```

The server communicates over stdio using the standard MCP transport, so it works with any client that supports the MCP protocol.

## Architecture

```
nomba-mcp/
├── src/
│   ├── index.ts              # Entry point, server setup, spending guard config
│   ├── client.ts             # Nomba API client (OAuth2 token + refresh management)
│   ├── utils.ts              # Shared utilities (jsonResponse, logToolCall, safeId)
│   ├── redact.ts             # Response field filtering (BVN, account numbers, card tokens)
│   ├── spending-guard.ts     # Transaction limits, session caps, duplicate detection
│   ├── resources/
│   │   └── bank-list.ts      # Cached bank code list (MCP resource, 24h TTL)
│   └── tools/
│       ├── accounts.ts       # Parent account details, balance, terminals
│       ├── sub-accounts.ts   # Sub-account details, balance, terminals
│       ├── transfers.ts      # Bank list, account lookup, bank/internal transfers
│       ├── checkout.ts       # Payment links, tokenized cards, refunds
│       ├── virtual-accounts.ts  # Virtual account create, update, expire, filter
│       ├── transactions.ts   # Transaction history, details, filtering, requery
│       ├── airtime.ts        # Airtime and data bundles
│       └── bills/
│           ├── index.ts      # Hub re-exporting all bill tool registrations
│           ├── electricity.ts  # Electricity providers, meter lookup, token purchase
│           ├── cable.ts      # Cable TV providers, smartcard lookup, subscriptions
│           └── betting.ts    # Betting providers, account funding
├── package.json
├── tsconfig.json
└── README.md
```

**Design decisions:**
- Uses OAuth2 Client Credentials with automatic token refresh via `/v1/auth/token/refresh` and 401 auto-retry
- A promise lock prevents concurrent token refresh when multiple tools execute in parallel
- Financial tools are guarded by a shared `SpendingGuard` instance with configurable limits
- Sensitive data (BVN, bank account numbers, card tokens) is redacted from API responses before reaching the AI
- Bills are split into sub-files (electricity, cable, betting) with a hub for clean organization
- Bank list is exposed as an MCP resource with 24h cache TTL
- All tools annotated with MCP `destructiveHint`/`readOnlyHint` for client-side confirmation enforcement
- Tool names prefixed with `nomba_` to avoid collisions with other MCP servers

## Tools Reference

Outflow tools (transfers, airtime, data, bills) send a `merchantTxRef`, which Nomba uses to deduplicate. Pass your own or let the server generate one; it's returned alongside the API result.

### Accounts & Terminals (5 tools)

| Tool | Description | API Endpoint |
|------|-------------|-------------|
| `nomba_get_parent_account` | Get parent account details (ID, name, type, status, linked banks) | `GET /v1/accounts/parent` |
| `nomba_get_parent_balance` | Get current balance of parent account (NGN) | `GET /v1/accounts/balance` |
| `nomba_list_terminals` | List POS terminals assigned to the account, paginated | `GET /v1/accounts/terminals` |
| `nomba_assign_terminal` | Assign a POS terminal by serial number | `POST /v1/terminals/assign` |
| `nomba_unassign_terminal` | Unassign a POS terminal by serial number | `POST /v1/terminals/unassign` |

### Sub-Accounts (3 tools)

| Tool | Description | API Endpoint |
|------|-------------|-------------|
| `nomba_get_sub_account` | Get a sub-account's details by its accountRef | `GET /v1/accounts/sub-account-details` |
| `nomba_get_sub_account_balance` | Get current balance of a sub-account | `GET /v1/accounts/{subAccountId}/balance` |
| `nomba_list_sub_account_terminals` | List terminals assigned to a sub-account | `GET /v1/accounts/{subAccountId}/terminals` |

### Transfers (4 tools)

| Tool | Description | API Endpoint |
|------|-------------|-------------|
| `nomba_list_banks` | Fetch all Nigerian bank codes and names | `GET /v1/transfers/banks` |
| `nomba_lookup_bank_account` | Validate account number and get holder name (call before transfers) | `POST /v1/transfers/bank/lookup` |
| `nomba_transfer_to_bank` | Transfer funds to an external Nigerian bank account | `POST /v2/transfers/bank` |
| `nomba_transfer_between_accounts` | Transfer funds to another Nomba account (wallet/P2P) | `POST /v2/transfers/wallet` |

### Online Checkout (5 tools)

| Tool | Description | API Endpoint |
|------|-------------|-------------|
| `nomba_create_checkout_order` | Create payment link (card, bank transfer, or USSD) | `POST /v1/checkout/order` |
| `nomba_charge_tokenized_card` | Charge a previously saved card for recurring payments | `POST /v1/checkout/tokenized-card-payment` |
| `nomba_refund_transaction` | Process full or partial refund for a checkout transaction | `POST /v1/checkout/refund` |
| `nomba_get_checkout_transaction` | Get checkout transaction details and status | `GET /v1/checkout/transaction` |
| `nomba_cancel_transaction` | Cancel an incomplete/pending checkout order | `POST /v1/checkout/order/cancel` |

### Virtual Accounts (5 tools)

| Tool | Description | API Endpoint |
|------|-------------|-------------|
| `nomba_create_virtual_account` | Create a new virtual bank account (optional expected amount) | `POST /v1/accounts/virtual` |
| `nomba_get_virtual_account` | Get virtual account details by accountRef or account number | `GET /v1/accounts/virtual/{identifier}` |
| `nomba_update_virtual_account` | Update name, accountRef or expected amount | `PUT /v1/accounts/virtual/{identifier}` |
| `nomba_expire_virtual_account` | Permanently deactivate a virtual account | `DELETE /v1/accounts/virtual/{identifier}` |
| `nomba_list_virtual_accounts` | List or filter virtual accounts, paginated | `POST /v1/accounts/virtual/list` |

### Transactions (4 tools)

| Tool | Description | API Endpoint |
|------|-------------|-------------|
| `nomba_list_bank_transactions` | List credit/debit transactions with optional date filtering | `GET /v1/transactions/bank` |
| `nomba_requery_transaction` | Confirm transaction status by session ID | `GET /v1/transactions/requery/{sessionId}` |
| `nomba_get_transaction` | Get one transaction by transaction ID or merchantTxRef | `GET /v1/transactions/accounts/single` |
| `nomba_filter_transactions` | Filter transactions by status, type, source, terminal, reference, date | `POST /v1/transactions/accounts` |

### Bills - Electricity (3 tools)

| Tool | Description | API Endpoint |
|------|-------------|-------------|
| `nomba_get_electricity_providers` | List available electricity distribution companies | `GET /v1/bill/electricity/discos` |
| `nomba_lookup_electricity_customer` | Validate meter number and get customer name | `GET /v1/bill/electricity/lookup` |
| `nomba_buy_electricity` | Purchase electricity tokens (prepaid) or pay bill (postpaid) | `POST /v2/bill/electricity` |

### Bills - Cable TV (4 tools)

| Tool | Description | API Endpoint |
|------|-------------|-------------|
| `nomba_get_cable_providers` | List supported cable TV providers (DSTV, GOtv, Startimes, Showmax) | none (documented values) |
| `nomba_list_cable_plans` | List plans and prices for a provider | `GET /v1/bill/cableTvProduct` |
| `nomba_lookup_cable_customer` | Validate smartcard/IUC number and get customer name | `GET /v1/bill/cabletv/lookup` |
| `nomba_pay_cable_subscription` | Pay for a cable TV subscription | `POST /v2/bill/cabletv` |

### Bills - Betting (3 tools)

| Tool | Description | API Endpoint |
|------|-------------|-------------|
| `nomba_get_betting_providers` | List available betting platforms | `GET /v1/bill/betting/providers` |
| `nomba_lookup_betting_customer` | Validate a betting account and get customer name | `GET /v1/bill/betting/lookup` |
| `nomba_fund_betting_account` | Fund a customer's betting account | `POST /v2/bill/betting` |

### Airtime & Data (3 tools)

| Tool | Description | API Endpoint |
|------|-------------|-------------|
| `nomba_buy_airtime` | Purchase airtime for a Nigerian phone number (MTN, Airtel, Glo, 9mobile) | `POST /v2/bill/topup` |
| `nomba_list_data_plans` | List available data plans for a network provider | `GET /v1/bill/data-plan/{telco}` |
| `nomba_buy_data` | Purchase a data bundle for a phone number | `POST /v2/bill/data` |

## Resources

### `nomba://banks`

A cached list of all Nigerian bank codes and names in JSON format. Fetched once and cached for 24 hours. Clients can read this resource instead of calling `nomba_list_banks` to avoid repeat API calls.

## Example Prompts

- "What's my Nomba account balance?"
- "What's the balance on sub-account sub_123?"
- "Transfer 5000 Naira to account 0123456789 at GTBank"
- "Look up account 0123456789 at Access Bank"
- "Create a payment link for 10,000 Naira for customer@email.com"
- "Show me my last 10 transactions"
- "Show me all failed transfers from January 2024"
- "Create a virtual account named 'John Doe Payments'"
- "Buy 1000 Naira airtime for 08012345678"
- "What MTN data plans are available?"
- "Buy 5000 Naira electricity for meter 12345678 on Ikeja Electric prepaid"
- "What DSTV plans are available?"

## Development

### Build

```bash
npm run build
```

### Run tests

```bash
npm test
```

### Watch mode

```bash
npm run test:watch
```

### Lint

```bash
npm run lint
```

### Format

```bash
npm run format
```

### Testing with MCP Inspector

```bash
NOMBA_CLIENT_ID=your_id NOMBA_CLIENT_SECRET=your_secret NOMBA_ACCOUNT_ID=your_account_id \
npx @modelcontextprotocol/inspector node build/index.js
```

### Adding new tools

1. Create a new file in `src/tools/` or add to an existing category
2. Follow the pattern: `registerXxxTools(server, client)` or `registerXxxTools(server, client, guard)` for financial tools
3. Import and call the register function in `src/index.ts`
4. Add `annotations` with appropriate `readOnlyHint`/`destructiveHint` values
5. Add tests in `src/tools/tools.test.ts`
6. Update this README

## Troubleshooting

### "Missing required environment variables"

Ensure `NOMBA_CLIENT_ID`, `NOMBA_CLIENT_SECRET`, and `NOMBA_ACCOUNT_ID` are set in your MCP server config under the `env` key.

### "NOMBA_BASE_URL must use HTTPS"

The server requires HTTPS by default. For local development, set `NOMBA_ALLOW_INSECURE=true`.

### "Base URL points to production"

Set `NOMBA_PRODUCTION_CONFIRMED=true` to confirm you intend to use the production API.

### "Token issue failed (401)"

Your client credentials are invalid. Verify your `NOMBA_CLIENT_ID` and `NOMBA_CLIENT_SECRET` on the [Nomba Developer Dashboard](https://developer.nomba.com).

### "Token issue failed (403)"

Your account may not have the required API permissions. Check your Nomba dashboard for access settings.

### "Nomba API ... failed (429)"

You've hit the rate limit (default 15 POST requests per second). Wait a moment and retry.

### "Amount exceeds per-transaction limit"

The transaction exceeds `NOMBA_MAX_TRANSACTION` (default 100,000 NGN). Increase the limit via the environment variable if needed.

### "Session spending cap exceeded"

Cumulative spending has exceeded `NOMBA_SESSION_SPENDING_CAP` (default 500,000 NGN). Restart the server to reset the session counter, or increase the cap.

### Sandbox vs Production

The server defaults to sandbox (`https://sandbox.nomba.com`). To use production, set both `NOMBA_BASE_URL=https://api.nomba.com` and `NOMBA_PRODUCTION_CONFIRMED=true`.

### Tools not appearing

- Restart your MCP client after updating config
- Verify your config uses `"command": "npx"` with `"args": ["-y", "nomba-mcp"]`

## License

MIT
